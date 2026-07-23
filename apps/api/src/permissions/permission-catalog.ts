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
    code: Permissions.HR_VIEW,
    name: 'Xem nhân sự',
    module: PermissionModule.HR,
    description: 'Truy cập module nhân sự',
  },
  {
    code: Permissions.HR_EMPLOYEE_VIEW,
    name: 'Xem hồ sơ nhân viên',
    module: PermissionModule.HR,
    description: 'Xem danh sách hồ sơ nhân viên',
  },
  {
    code: Permissions.HR_EMPLOYEE_CREATE,
    name: 'Tạo hồ sơ nhân viên',
    module: PermissionModule.HR,
    description: 'Tạo hồ sơ nhân viên mới',
  },
  {
    code: Permissions.HR_EMPLOYEE_UPDATE,
    name: 'Cập nhật hồ sơ nhân viên',
    module: PermissionModule.HR,
    description: 'Cập nhật thông tin hồ sơ nhân viên',
  },
  {
    code: Permissions.HR_EMPLOYEE_DELETE,
    name: 'Khóa hồ sơ nhân viên',
    module: PermissionModule.HR,
    description: 'Khóa hồ sơ nhân viên (LOCKED)',
  },
  {
    code: Permissions.HR_EMPLOYEE_VERIFY,
    name: 'Xác thực hồ sơ nhân viên',
    module: PermissionModule.HR,
    description:
      'Chuyển trạng thái xác thực hồ sơ: đang xác thực, cần điều chỉnh, đã xác thực',
  },
  {
    code: Permissions.HR_EMPLOYEE_STATUS_UPDATE,
    name: 'Đổi trạng thái hồ sơ',
    module: PermissionModule.HR,
    description:
      'Đổi trạng thái hồ sơ theo ma trận hợp lệ, kể cả khi hồ sơ đang khóa',
  },
  {
    code: Permissions.HR_EMPLOYEE_EDIT_REQUEST_REVIEW,
    name: 'Duyệt yêu cầu chỉnh sửa hồ sơ',
    module: PermissionModule.HR,
    description: 'Duyệt hoặc từ chối yêu cầu chỉnh sửa hồ sơ từ nhân viên',
  },
  {
    code: Permissions.HR_EMPLOYEE_EXPORT,
    name: 'Xuất hồ sơ nhân viên',
    module: PermissionModule.HR,
    description: 'Xuất Excel danh sách hồ sơ nhân viên',
  },
  {
    code: Permissions.HR_EMPLOYEE_IMPORT,
    name: 'Nhập hồ sơ nhân viên',
    module: PermissionModule.HR,
    description: 'Nhập Excel và áp dụng thay đổi hồ sơ nhân viên',
  },
  {
    code: Permissions.PERMISSION_VIEW,
    name: 'Xem quyền',
    module: PermissionModule.PERMISSION_GROUP,
    description: 'Xem danh sách quyền hạn trong catalog',
  },
  {
    code: Permissions.PERMISSION_ASSIGN,
    name: 'Gán quyền',
    module: PermissionModule.PERMISSION_GROUP,
    description: 'Gán nhóm quyền cho vị trí trên cây tổ chức',
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
