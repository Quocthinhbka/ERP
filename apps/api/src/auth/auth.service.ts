import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import {
  AuthTokens,
  formatAccountCode,
  JwtPayload,
  parseAccountCodeSequence,
  SystemRole,
} from '@erp/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  BootstrapAdminDto,
  ChangePasswordDto,
  LoginDto,
} from './dto/auth.dto';
import { PositionPermissionsService } from '../organization/position-permissions.service';
import {
  durationToMs,
  hashToken,
  newTokenId,
  parseExpiresIn,
} from './auth-cookies';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private positionPermissions: PositionPermissionsService,
  ) {}

  get accessExpiresIn() {
    return parseExpiresIn(this.config.get<string>('JWT_ACCESS_EXPIRES_IN'), 900);
  }

  get refreshExpiresIn() {
    return parseExpiresIn(this.config.get<string>('JWT_REFRESH_EXPIRES_IN'), 604800);
  }

  private get accessSecret() {
    return this.config.getOrThrow<string>('JWT_SECRET');
  }

  private get refreshSecret() {
    return (
      this.config.get<string>('JWT_REFRESH_SECRET') ??
      this.config.getOrThrow<string>('JWT_SECRET')
    );
  }

  async login(dto: LoginDto) {
    const user = await this.findUserForLogin(dto);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });

      if (payload.typ !== 'refresh' || !payload.jti) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const stored = await this.prisma.refreshToken.findUnique({
        where: { id: payload.jti },
      });

      if (
        !stored ||
        stored.revokedAt ||
        stored.expiresAt.getTime() <= Date.now() ||
        stored.tokenHash !== hashToken(refreshToken)
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      return this.generateTokens(user.id, user.email);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
        ignoreExpiration: true,
      });
      if (payload.jti) {
        await this.prisma.refreshToken.updateMany({
          where: { id: payload.jti, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // Token không hợp lệ — vẫn coi logout thành công phía client.
    }
  }

  async validateUserPayload(payload: JwtPayload) {
    if (payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid access token');
    }

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
      fullName: user.fullName,
      mustChangePassword: user.mustChangePassword,
      permissions: auth.permissions,
      isSystemAdmin: auth.isSystemAdmin,
      orgScopes: auth.orgScopes,
    };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const currentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!currentPasswordValid) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    const passwordHash = await this.hashPassword(dto.newPassword);
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: { passwordHash, mustChangePassword: false },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return updated;
    });

    return this.issueSession(updatedUser);
  }

  /**
   * Tạo Super Admin đầu tiên khi chưa có user nào.
   * Thay thế prisma seed — chỉ gọi được một lần trên DB trống.
   */
  async bootstrapAdmin(dto: BootstrapAdminDto) {
    const userCount = await this.prisma.user.count();
    if (userCount > 0) {
      throw new ForbiddenException('Bootstrap is only allowed on an empty database');
    }

    const email = dto.email.toLowerCase();
    await this.ensureEmailAvailable(email);
    if (dto.phone) {
      await this.ensurePhoneAvailable(dto.phone);
    }

    const superAdminRole = await this.prisma.role.findUnique({
      where: { code: SystemRole.SUPER_ADMIN },
    });
    if (!superAdminRole) {
      throw new ConflictException('System roles are not initialized yet');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const accountCode = await this.allocateNextAccountCode();

    const user = await this.prisma.user.create({
      data: {
        email,
        fullName: dto.fullName,
        phone: dto.phone,
        passwordHash,
        accountCode,
        isActive: true,
        roles: { create: [{ roleId: superAdminRole.id }] },
      },
    });

    return this.login({ identifier: email, password: dto.password });
  }

  async ensureEmailAvailable(email: string, excludeUserId?: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existing && existing.id !== excludeUserId) {
      throw new ConflictException('Email already exists');
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

  /** Sinh mã tài khoản tiếp theo dạng TK-00001 (tăng dần). */
  async allocateNextAccountCode(
    db: Pick<PrismaService, 'user'> = this.prisma,
  ): Promise<string> {
    const users = await db.user.findMany({
      where: { accountCode: { startsWith: 'TK-' } },
      select: { accountCode: true },
    });
    let max = 0;
    for (const user of users) {
      const seq = parseAccountCodeSequence(user.accountCode);
      if (seq !== null && seq > max) max = seq;
    }
    return formatAccountCode(max + 1);
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
      case 'accountCode':
        return this.prisma.user.findUnique({
          where: { accountCode: identifier.toUpperCase() },
        });
    }
  }

  private detectLoginField(identifier: string): 'email' | 'phone' | 'accountCode' {
    if (identifier.includes('@')) {
      return 'email';
    }

    const normalized = this.normalizePhone(identifier);
    if (/^\+?\d{9,15}$/.test(normalized)) {
      return 'phone';
    }

    return 'accountCode';
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/[\s\-().]/g, '');
  }

  private async issueSession(user: {
    id: string;
    email: string | null;
    fullName: string;
    mustChangePassword: boolean;
  }) {
    const auth = await this.positionPermissions.resolveAuthContext(user.id);
    const tokens = await this.generateTokens(user.id, user.email);
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        mustChangePassword: user.mustChangePassword,
        permissions: auth.permissions,
        isSystemAdmin: auth.isSystemAdmin,
        orgScopes: auth.orgScopes,
      },
    };
  }

  private async generateTokens(
    userId: string,
    email: string | null,
  ): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
        typ: 'access',
      } satisfies JwtPayload,
      {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresIn as never,
      },
    );

    const jti = newTokenId();
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        email,
        typ: 'refresh',
        jti,
      } satisfies JwtPayload,
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshExpiresIn as never,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + durationToMs(this.refreshExpiresIn)),
      },
    });

    return { accessToken, refreshToken };
  }
}
