import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthTokens, JwtPayload, OrgScopeNode, PermissionCode } from '@erp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/auth.dto';
import { PositionPermissionsService } from '../organization/position-permissions.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private positionPermissions: PositionPermissionsService,
  ) {}

  async login(
    dto: LoginDto,
  ): Promise<
    AuthTokens & {
      user: {
        id: string;
        email: string;
        fullName: string;
        permissions: PermissionCode[];
        isSystemAdmin: boolean;
        orgScopes: OrgScopeNode[];
      };
    }
  > {
    const user = await this.findUserForLogin(dto);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const auth = await this.positionPermissions.resolveAuthContext(user.id);
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      permissions: auth.permissions,
      isSystemAdmin: auth.isSystemAdmin,
      orgScopes: auth.orgScopes,
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        permissions: auth.permissions,
        isSystemAdmin: auth.isSystemAdmin,
        orgScopes: auth.orgScopes,
      },
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const auth = await this.positionPermissions.resolveAuthContext(user.id);
      return this.generateTokens({
        sub: user.id,
        email: user.email,
        permissions: auth.permissions,
        isSystemAdmin: auth.isSystemAdmin,
        orgScopes: auth.orgScopes,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateUserPayload(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const auth = await this.positionPermissions.resolveAuthContext(user.id);
    return {
      id: user.id,
      email: user.email,
      permissions: auth.permissions,
      isSystemAdmin: auth.isSystemAdmin,
      orgScopes: auth.orgScopes,
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async ensureEmailAvailable(email: string, excludeUserId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException('Email already exists');
    }
  }

  async ensureEmployeeCodeAvailable(employeeCode: string, excludeUserId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { employeeCode },
    });
    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException('Employee code already exists');
    }
  }

  async ensurePhoneAvailable(phone: string, excludeUserId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { phone },
    });
    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException('Phone already exists');
    }
  }

  private async findUserForLogin(dto: LoginDto) {
    const identifier = dto.identifier.trim();
    const loginField = this.detectLoginField(identifier);

    switch (loginField) {
      case 'email':
        return this.prisma.user.findUnique({
          where: { email: identifier.toLowerCase() },
        });
      case 'phone':
        return this.prisma.user.findUnique({
          where: { phone: this.normalizePhone(identifier) },
        });
      case 'employeeCode':
        return this.prisma.user.findUnique({
          where: { employeeCode: identifier },
        });
    }
  }

  private detectLoginField(identifier: string): 'email' | 'phone' | 'employeeCode' {
    if (identifier.includes('@')) {
      return 'email';
    }

    const normalized = this.normalizePhone(identifier);
    if (/^\+?\d{9,15}$/.test(normalized)) {
      return 'phone';
    }

    return 'employeeCode';
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[\s\-().]/g, '');
  }

  private async generateTokens(payload: JwtPayload): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: 900,
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: 604800,
    });
    return { accessToken, refreshToken };
  }
}
