import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import {
  ALL_PERMISSIONS,
  PermissionModule,
  Permissions,
  SystemRole,
} from '@erp/shared';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PERMISSION_DEFINITIONS: Array<{
  code: string;
  name: string;
  module: string;
  description: string;
}> = [
  {
    code: Permissions.SETUP_VIEW,
    name: 'Xem thiết lập',
    module: PermissionModule.SETUP,
    description: 'Xem module thiết lập hệ thống',
  },
  {
    code: Permissions.SETUP_MANAGE,
    name: 'Quản lý thiết lập',
    module: PermissionModule.SETUP,
    description: 'Quản lý cấu hình thiết lập',
  },
  {
    code: Permissions.USER_VIEW,
    name: 'Xem người dùng',
    module: PermissionModule.USER,
    description: 'Xem danh sách người dùng',
  },
  {
    code: Permissions.USER_CREATE,
    name: 'Tạo người dùng',
    module: PermissionModule.USER,
    description: 'Tạo người dùng mới',
  },
  {
    code: Permissions.USER_UPDATE,
    name: 'Cập nhật người dùng',
    module: PermissionModule.USER,
    description: 'Cập nhật thông tin người dùng',
  },
  {
    code: Permissions.USER_DELETE,
    name: 'Xóa người dùng',
    module: PermissionModule.USER,
    description: 'Xóa người dùng',
  },
  {
    code: Permissions.ROLE_VIEW,
    name: 'Xem vai trò',
    module: PermissionModule.ROLE,
    description: 'Xem danh sách vai trò',
  },
  {
    code: Permissions.ROLE_CREATE,
    name: 'Tạo vai trò',
    module: PermissionModule.ROLE,
    description: 'Tạo vai trò mới',
  },
  {
    code: Permissions.ROLE_UPDATE,
    name: 'Cập nhật vai trò',
    module: PermissionModule.ROLE,
    description: 'Cập nhật vai trò',
  },
  {
    code: Permissions.ROLE_DELETE,
    name: 'Xóa vai trò',
    module: PermissionModule.ROLE,
    description: 'Xóa vai trò',
  },
  {
    code: Permissions.PERMISSION_VIEW,
    name: 'Xem quyền',
    module: PermissionModule.ROLE,
    description: 'Xem danh sách quyền',
  },
  {
    code: Permissions.PERMISSION_ASSIGN,
    name: 'Gán quyền',
    module: PermissionModule.ROLE,
    description: 'Gán quyền cho vai trò',
  },
  {
    code: Permissions.ORGANIZATION_VIEW,
    name: 'Xem tổ chức',
    module: PermissionModule.ORGANIZATION,
    description: 'Xem sơ đồ tổ chức',
  },
  {
    code: Permissions.ORGANIZATION_MANAGE,
    name: 'Quản lý tổ chức',
    module: PermissionModule.ORGANIZATION,
    description: 'Cập nhật thông tin tổ chức',
  },
  {
    code: Permissions.COMPANY_VIEW,
    name: 'Xem công ty',
    module: PermissionModule.ORGANIZATION,
    description: 'Xem danh sách công ty',
  },
  {
    code: Permissions.COMPANY_CREATE,
    name: 'Tạo công ty',
    module: PermissionModule.ORGANIZATION,
    description: 'Tạo công ty mới',
  },
  {
    code: Permissions.COMPANY_UPDATE,
    name: 'Cập nhật công ty',
    module: PermissionModule.ORGANIZATION,
    description: 'Cập nhật công ty',
  },
  {
    code: Permissions.COMPANY_DELETE,
    name: 'Xóa công ty',
    module: PermissionModule.ORGANIZATION,
    description: 'Xóa công ty',
  },
  {
    code: Permissions.ORG_UNIT_VIEW,
    name: 'Xem đơn vị',
    module: PermissionModule.ORGANIZATION,
    description: 'Xem đơn vị tổ chức',
  },
  {
    code: Permissions.ORG_UNIT_CREATE,
    name: 'Tạo đơn vị',
    module: PermissionModule.ORGANIZATION,
    description: 'Tạo đơn vị tổ chức',
  },
  {
    code: Permissions.ORG_UNIT_UPDATE,
    name: 'Cập nhật đơn vị',
    module: PermissionModule.ORGANIZATION,
    description: 'Cập nhật đơn vị tổ chức',
  },
  {
    code: Permissions.ORG_UNIT_DELETE,
    name: 'Xóa đơn vị',
    module: PermissionModule.ORGANIZATION,
    description: 'Xóa đơn vị tổ chức',
  },
  {
    code: Permissions.ORG_UNIT_MOVE,
    name: 'Di chuyển đơn vị',
    module: PermissionModule.ORGANIZATION,
    description: 'Di chuyển đơn vị trong cây tổ chức',
  },
];

async function main() {
  for (const def of PERMISSION_DEFINITIONS) {
    await prisma.permission.upsert({
      where: { code: def.code },
      update: { name: def.name, module: def.module, description: def.description },
      create: def,
    });
  }

  const allPermissions = await prisma.permission.findMany({
    where: { code: { in: ALL_PERMISSIONS } },
  });

  const superAdminRole = await prisma.role.upsert({
    where: { code: SystemRole.SUPER_ADMIN },
    update: { name: 'Super Admin', description: 'Toàn quyền hệ thống', isSystem: true },
    create: {
      code: SystemRole.SUPER_ADMIN,
      name: 'Super Admin',
      description: 'Toàn quyền hệ thống',
      isSystem: true,
    },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: superAdminRole.id } });
  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({
      roleId: superAdminRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  const adminRole = await prisma.role.upsert({
    where: { code: SystemRole.ADMIN },
    update: { name: 'Admin', description: 'Quản trị viên', isSystem: true },
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
    Permissions.ROLE_VIEW,
    Permissions.ROLE_CREATE,
    Permissions.ROLE_UPDATE,
    Permissions.PERMISSION_VIEW,
    Permissions.PERMISSION_ASSIGN,
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
    adminPermissionCodes.includes(p.code as (typeof Permissions)[keyof typeof Permissions]),
  );

  await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
  await prisma.rolePermission.createMany({
    data: adminPermissions.map((p) => ({
      roleId: adminRole.id,
      permissionId: p.id,
    })),
    skipDuplicates: true,
  });

  const userRole = await prisma.role.upsert({
    where: { code: SystemRole.USER },
    update: { name: 'User', description: 'Người dùng thường', isSystem: true },
    create: {
      code: SystemRole.USER,
      name: 'User',
      description: 'Người dùng thường',
      isSystem: true,
    },
  });

  const userPermission = allPermissions.find((p) => p.code === Permissions.SETUP_VIEW);
  if (userPermission) {
    await prisma.rolePermission.deleteMany({ where: { roleId: userRole.id } });
    await prisma.rolePermission.create({
      data: { roleId: userRole.id, permissionId: userPermission.id },
    });
  }

  const passwordHash = await bcrypt.hash('Admin@123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@hyperlabs.vn' },
    update: {
      fullName: 'System Administrator',
      passwordHash,
      isActive: true,
      employeeCode: 'NV001',
    },
    create: {
      email: 'admin@hyperlabs.vn',
      fullName: 'System Administrator',
      passwordHash,
      isActive: true,
      employeeCode: 'NV001',
    },
  });

  await prisma.userRole.deleteMany({ where: { userId: adminUser.id } });
  await prisma.userRole.create({
    data: { userId: adminUser.id, roleId: superAdminRole.id },
  });

  const existingOrg = await prisma.organization.findFirst();
  if (existingOrg) {
    await prisma.organization.update({
      where: { id: existingOrg.id },
      data: {
        name: 'Tổ chức HyperLabs',
        representativeName: 'System Administrator',
        additionalInfo: 'Tổ chức mặc định',
      },
    });
  } else {
    await prisma.organization.create({
      data: {
        name: 'Tổ chức HyperLabs',
        representativeName: 'System Administrator',
        additionalInfo: 'Tổ chức mặc định',
      },
    });
  }

  console.log('Seed completed: permissions, roles, admin user, organization.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
