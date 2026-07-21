import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SystemRole } from '@erp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PositionPermissionsService } from '../organization/position-permissions.service';
import { CreateUserDto } from '../auth/dto/auth.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private positionPermissions: PositionPermissionsService,
  ) {}

  async findAll(page: number, pageSize: number, search?: string) {
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { employeeCode: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          roles: { include: { role: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => this.toResponse(u)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('Account not found');
    }

    return this.toResponse(user);
  }

  async create(dto: CreateUserDto) {
    await this.authService.ensureEmailAvailable(dto.email);
    if (dto.employeeCode) {
      await this.authService.ensureEmployeeCodeAvailable(dto.employeeCode);
    }
    if (dto.phone) {
      await this.authService.ensurePhoneAvailable(dto.phone);
    }
    await this.ensureNoSuperAdminAssignment(dto.roleIds);

    const passwordHash = await this.authService.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        fullName: dto.fullName,
        employeeCode: dto.employeeCode,
        phone: dto.phone,
        passwordHash,
        roles: {
          create: dto.roleIds.map((roleId) => ({ roleId })),
        },
      },
      include: {
        roles: { include: { role: true } },
      },
    });

    return this.toResponse(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.email) {
      await this.authService.ensureEmailAvailable(dto.email, id);
    }
    if (dto.employeeCode) {
      await this.authService.ensureEmployeeCodeAvailable(dto.employeeCode, id);
    }
    if (dto.phone) {
      await this.authService.ensurePhoneAvailable(dto.phone, id);
    }
    if (dto.roleIds) {
      await this.ensureNoSuperAdminAssignment(dto.roleIds, id);
    }

    const data: {
      email?: string;
      fullName?: string;
      employeeCode?: string | null;
      phone?: string | null;
      passwordHash?: string;
      isActive?: boolean;
    } = {};

    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.employeeCode !== undefined) data.employeeCode = dto.employeeCode || null;
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) {
      data.passwordHash = await this.authService.hashPassword(dto.password);
    }

    if (dto.roleIds) {
      await this.prisma.userRole.deleteMany({ where: { userId: id } });
      await this.prisma.userRole.createMany({
        data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
      });
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      include: {
        roles: { include: { role: true } },
      },
    });

    return this.toResponse(user);
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException('Account not found');
    }
    if (user.roles.some((r) => r.role.code === SystemRole.SUPER_ADMIN)) {
      throw new BadRequestException('Cannot delete the system administrator account');
    }
    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }

  async getPermissions(id: string) {
    await this.findOne(id);
    const auth = await this.positionPermissions.resolveAuthContext(id);
    const allPermissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { name: 'asc' }],
    });
    const grouped: Record<string, typeof allPermissions> = {};
    for (const permission of allPermissions) {
      grouped[permission.module] ??= [];
      grouped[permission.module].push(permission);
    }

    return {
      isSystemAdmin: auth.isSystemAdmin,
      permissions: grouped,
      effectivePermissionCodes: auth.permissions,
      orgScopes: auth.orgScopes,
      note: 'Quyền hiệu lực được suy ra từ vị trí trên cây tổ chức (union).',
    };
  }

  private async ensureNoSuperAdminAssignment(roleIds: string[], excludeUserId?: string) {
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    });
    const assigningSuperAdmin = roles.some((r) => r.code === SystemRole.SUPER_ADMIN);
    if (!assigningSuperAdmin) {
      return;
    }

    const existing = await this.prisma.userRole.findFirst({
      where: {
        role: { code: SystemRole.SUPER_ADMIN },
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
    });
    if (existing || !excludeUserId) {
      throw new BadRequestException(
        'Only one system administrator account is allowed',
      );
    }
  }

  private toResponse(user: {
    id: string;
    email: string;
    fullName: string;
    isActive: boolean;
    employeeCode: string | null;
    phone: string | null;
    linkedEmployeeProfileId: string | null;
    createdAt: Date;
    updatedAt: Date;
    roles: Array<{ role: { id: string; code: string; name: string } }>;
  }) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      employeeCode: user.employeeCode,
      phone: user.phone,
      linkedEmployeeProfileId: user.linkedEmployeeProfileId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.roles.map((r) => ({
        id: r.role.id,
        code: r.role.code,
        name: r.role.name,
      })),
    };
  }
}
