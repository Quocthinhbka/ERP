import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ALL_PERMISSIONS, Permissions, SystemRole } from '@erp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSION_CATALOG } from './permission-catalog';

/**
 * Đồng bộ catalog quyền + system roles khi API khởi động.
 * Không tạo user / tổ chức / nhóm quyền mẫu (không còn prisma seed).
 */
@Injectable()
export class PermissionsSyncService implements OnModuleInit {
  private readonly logger = new Logger(PermissionsSyncService.name);

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.sync();
  }

  async sync() {
    for (const def of PERMISSION_CATALOG) {
      await this.prisma.permission.upsert({
        where: { code: def.code },
        update: {
          name: def.name,
          module: def.module,
          description: def.description,
        },
        create: def,
      });
    }

    const allPermissions = await this.prisma.permission.findMany({
      where: { code: { in: ALL_PERMISSIONS } },
    });

    const superAdminRole = await this.prisma.role.upsert({
      where: { code: SystemRole.SUPER_ADMIN },
      update: {
        name: 'Super Admin',
        description: 'Toàn quyền hệ thống',
        isSystem: true,
      },
      create: {
        code: SystemRole.SUPER_ADMIN,
        name: 'Super Admin',
        description: 'Toàn quyền hệ thống',
        isSystem: true,
      },
    });

    await this.prisma.rolePermission.deleteMany({
      where: { roleId: superAdminRole.id },
    });
    await this.prisma.rolePermission.createMany({
      data: allPermissions.map((p) => ({
        roleId: superAdminRole.id,
        permissionId: p.id,
      })),
      skipDuplicates: true,
    });

    const adminRole = await this.prisma.role.upsert({
      where: { code: SystemRole.ADMIN },
      update: {
        name: 'Admin',
        description: 'Quản trị viên',
        isSystem: true,
      },
      create: {
        code: SystemRole.ADMIN,
        name: 'Admin',
        description: 'Quản trị viên',
        isSystem: true,
      },
    });

    const adminPermissionCodes = [
      Permissions.SETUP_VIEW,
      Permissions.SETUP_MANAGE,
      Permissions.USER_VIEW,
      Permissions.USER_CREATE,
      Permissions.USER_UPDATE,
      Permissions.HR_VIEW,
      Permissions.HR_EMPLOYEE_VIEW,
      Permissions.HR_EMPLOYEE_CREATE,
      Permissions.HR_EMPLOYEE_UPDATE,
      Permissions.HR_EMPLOYEE_DELETE,
      Permissions.ROLE_VIEW,
      Permissions.ROLE_CREATE,
      Permissions.ROLE_UPDATE,
      Permissions.PERMISSION_VIEW,
      Permissions.PERMISSION_ASSIGN,
      Permissions.PERMISSION_GROUP_VIEW,
      Permissions.PERMISSION_GROUP_CREATE,
      Permissions.PERMISSION_GROUP_UPDATE,
      Permissions.ORGANIZATION_VIEW,
      Permissions.ORGANIZATION_MANAGE,
      Permissions.COMPANY_VIEW,
      Permissions.COMPANY_CREATE,
      Permissions.COMPANY_UPDATE,
      Permissions.COMPANY_DELETE,
      Permissions.ORG_UNIT_VIEW,
      Permissions.ORG_UNIT_CREATE,
      Permissions.ORG_UNIT_UPDATE,
      Permissions.ORG_UNIT_DELETE,
      Permissions.ORG_UNIT_MOVE,
    ];
    const adminPermissions = allPermissions.filter((p) =>
      (adminPermissionCodes as string[]).includes(p.code),
    );

    await this.prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
    await this.prisma.rolePermission.createMany({
      data: adminPermissions.map((p) => ({
        roleId: adminRole.id,
        permissionId: p.id,
      })),
      skipDuplicates: true,
    });

    const userRole = await this.prisma.role.upsert({
      where: { code: SystemRole.USER },
      update: {
        name: 'User',
        description: 'Người dùng thường',
        isSystem: true,
      },
      create: {
        code: SystemRole.USER,
        name: 'User',
        description: 'Người dùng thường',
        isSystem: true,
      },
    });

    const userPermission = allPermissions.find(
      (p) => p.code === Permissions.SETUP_VIEW,
    );
    if (userPermission) {
      await this.prisma.rolePermission.deleteMany({ where: { roleId: userRole.id } });
      await this.prisma.rolePermission.create({
        data: { roleId: userRole.id, permissionId: userPermission.id },
      });
    }

    this.logger.log('Synced permission catalog and system roles');
  }
}
