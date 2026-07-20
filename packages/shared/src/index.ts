export enum PermissionModule {
  SETUP = 'setup',
  USER = 'user',
  ROLE = 'role',
  ORGANIZATION = 'organization',
}

export enum EntityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum OrgNodeType {
  ORGANIZATION = 'organization',
  COMPANY = 'company',
  UNIT = 'unit',
}

export const Permissions = {
  SETUP_VIEW: 'setup:view',
  SETUP_MANAGE: 'setup:manage',
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_UPDATE: 'user:update',
  USER_DELETE: 'user:delete',
  ROLE_VIEW: 'role:view',
  ROLE_CREATE: 'role:create',
  ROLE_UPDATE: 'role:update',
  ROLE_DELETE: 'role:delete',
  PERMISSION_VIEW: 'permission:view',
  PERMISSION_ASSIGN: 'permission:assign',
  ORGANIZATION_VIEW: 'organization:view',
  ORGANIZATION_MANAGE: 'organization:manage',
  COMPANY_VIEW: 'company:view',
  COMPANY_CREATE: 'company:create',
  COMPANY_UPDATE: 'company:update',
  COMPANY_DELETE: 'company:delete',
  ORG_UNIT_VIEW: 'org_unit:view',
  ORG_UNIT_CREATE: 'org_unit:create',
  ORG_UNIT_UPDATE: 'org_unit:update',
  ORG_UNIT_DELETE: 'org_unit:delete',
  ORG_UNIT_MOVE: 'org_unit:move',
} as const;

export type PermissionCode = (typeof Permissions)[keyof typeof Permissions];

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(Permissions);

export enum SystemRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  USER = 'user',
}

export interface JwtPayload {
  sub: string;
  email: string;
  permissions: PermissionCode[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrgTreeNode {
  id: string;
  type: OrgNodeType;
  code: string;
  name: string;
  description?: string | null;
  status: EntityStatus;
  managerName?: string | null;
  managerEmployeeCode?: string | null;
  managerUserId?: string | null;
  displayOrder: number;
  childCount: number;
  companyId?: string;
  parentUnitId?: string | null;
  organizationId?: string;
  children: OrgTreeNode[];
}

export function hasPermission(
  userPermissions: PermissionCode[],
  required: PermissionCode | PermissionCode[],
): boolean {
  const requiredList = Array.isArray(required) ? required : [required];
  return requiredList.every((p) => userPermissions.includes(p));
}

export function hasAnyPermission(
  userPermissions: PermissionCode[],
  required: PermissionCode[],
): boolean {
  return required.some((p) => userPermissions.includes(p));
}

/** Quy tắc mã: C01, C02... cho công ty; C01-001, C01-002... cho đơn vị trong công ty */
export function formatCompanyCode(sequence: number): string {
  return `C${String(sequence).padStart(2, '0')}`;
}

export function formatUnitCode(companyCode: string, sequence: number): string {
  return `${companyCode}-${String(sequence).padStart(3, '0')}`;
}

export const ORGANIZATION_CODE = 'ORG';
