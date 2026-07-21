import { PermissionModule, Permissions } from '@erp/shared';

export const PERMISSION_CATALOG: Array<{
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
    code: Permissions.PERMISSION_GROUP_VIEW,
    name: 'Xem nhóm quyền',
    module: PermissionModule.PERMISSION_GROUP,
    description: 'Xem danh sách nhóm quyền',
  },
  {
    code: Permissions.PERMISSION_GROUP_CREATE,
    name: 'Tạo nhóm quyền',
    module: PermissionModule.PERMISSION_GROUP,
    description: 'Tạo nhóm quyền mới',
  },
  {
    code: Permissions.PERMISSION_GROUP_UPDATE,
    name: 'Cập nhật nhóm quyền',
    module: PermissionModule.PERMISSION_GROUP,
    description: 'Cập nhật nhóm quyền',
  },
  {
    code: Permissions.PERMISSION_GROUP_DELETE,
    name: 'Xóa nhóm quyền',
    module: PermissionModule.PERMISSION_GROUP,
    description: 'Xóa nhóm quyền',
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
