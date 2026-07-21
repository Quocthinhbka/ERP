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
            { accountCode: { contains: search, mode: 'insensitive' as const } },
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
    if (dto.phone) {
      await this.authService.ensurePhoneAvailable(dto.phone);
    }
    await this.rejectSuperAdminRoleAssignment(dto.roleIds);

    const passwordHash = await this.authService.hashPassword(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const accountCode = await this.authService.allocateNextAccountCode(tx);
      return tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          fullName: dto.fullName,
          accountCode,
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
    });

    return this.toResponse(user);
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Account not found');
    }

    const isSuperAdmin = existing.roles.some(
      (r) => r.role.code === SystemRole.SUPER_ADMIN,
    );

    if (isSuperAdmin) {
      if (dto.roleIds !== undefined) {
        throw new BadRequestException(
          'Cannot change roles of the Super Admin account',
        );
      }
      if (dto.isActive === false) {
        throw new BadRequestException(
          'Cannot deactivate the Super Admin account',
        );
      }
    }

    if (dto.email) {
      await this.authService.ensureEmailAvailable(dto.email, id);
    }
    if (dto.phone) {
      await this.authService.ensurePhoneAvailable(dto.phone, id);
    }
    if (dto.roleIds) {
      await this.rejectSuperAdminRoleAssignment(dto.roleIds);
    }

    const data: {
      email?: string;
      fullName?: string;
      phone?: string | null;
      passwordHash?: string;
      isActive?: boolean;
    } = {};

    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
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
      throw new BadRequestException('Cannot delete the Super Admin account');
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
      note: auth.isSystemAdmin
        ? 'Super Admin có toàn quyền hệ thống theo mặc định và không thể thay đổi.'
        : 'Quyền hiệu lực = union RolePermission và quyền từ vị trí trên cây tổ chức.',
    };
  }

  /** Super Admin chỉ tạo qua /auth/bootstrap (DB trống) — không cho gán qua API. */
  private async rejectSuperAdminRoleAssignment(roleIds: string[]) {
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    });
    if (roles.some((r) => r.code === SystemRole.SUPER_ADMIN)) {
      throw new BadRequestException(
        'Cannot assign Super Admin role through the API',
      );
    }
  }

  private toResponse(user: {
    id: string;
    email: string;
    fullName: string;
    isActive: boolean;
    accountCode: string;
    phone: string | null;
    linkedEmployeeProfileId: string | null;
    createdAt: Date;
    updatedAt: Date;
    roles: Array<{ role: { id: string; code: string; name: string } }>;
  }) {
    const isSuperAdmin = user.roles.some((r) => r.role.code === SystemRole.SUPER_ADMIN);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      accountCode: user.accountCode,
      phone: user.phone,
      linkedEmployeeProfileId: user.linkedEmployeeProfileId,
      isSuperAdmin,
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
