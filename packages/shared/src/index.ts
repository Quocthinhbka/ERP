export enum PermissionModule {
  SETUP = 'setup',
  USER = 'user',
  ROLE = 'role',
  PERMISSION_GROUP = 'permission_group',
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

export const PositionHolderKind = {
  ORGANIZATION_REP: 'ORGANIZATION_REP',
  COMPANY_REP: 'COMPANY_REP',
  UNIT_MANAGER: 'UNIT_MANAGER',
  UNIT_MEMBER: 'UNIT_MEMBER',
} as const;

export type PositionHolderKind =
  (typeof PositionHolderKind)[keyof typeof PositionHolderKind];


export interface OrgScopeNode {
  type: OrgNodeType;
  id: string;
}

export interface PositionPermissionScopeInput {
  includeSelf: boolean;
  parentScopes: OrgScopeNode[];
}

export interface PositionPermissionSummary {
  holderKind: PositionHolderKind;
  holderId: string;
  permissionGroupVersionId: string;
  permissionGroupName: string;
  permissionGroupId: string;
  selectedPermissionIds: string[];
  includeSelf: boolean;
  parentScopes: OrgScopeNode[];
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
  PERMISSION_GROUP_VIEW: 'permission_group:view',
  PERMISSION_GROUP_CREATE: 'permission_group:create',
  PERMISSION_GROUP_UPDATE: 'permission_group:update',
  PERMISSION_GROUP_DELETE: 'permission_group:delete',
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
  isSystemAdmin?: boolean;
  orgScopes?: OrgScopeNode[];
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

export interface PermissionGroupVersionSummary {
  id: string;
  name: string;
  versionNumber: number;
  isCustom: boolean;
  permissionCount: number;
  positionCount: number;
}

export interface PermissionGroupSummary {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  permissionCount: number;
  positionCount: number;
  versions: PermissionGroupVersionSummary[];
}

export interface AccountSummary {
  id: string;
  email: string;
  fullName: string;
  employeeCode: string | null;
  phone: string | null;
  linkedEmployeeProfileId: string | null;
  isActive: boolean;
  roles: Array<{ id: string; code: string; name: string }>;
}

export interface OrgMember {
  id: string;
  position: string;
  memberName: string;
  phone?: string | null;
  email?: string | null;
  additionalInfo?: string | null;
  linkedProfileUserId?: string | null;
  linkedProfileName?: string | null;
  positionPermission?: PositionPermissionSummary | null;
}

export interface OrgTreeNode {
  id: string;
  type: OrgNodeType;
  name: string;
  representativeName?: string | null;
  managerName?: string | null;
  linkedProfileUserId?: string | null;
  linkedProfileName?: string | null;
  additionalInfo?: string | null;
  taxId?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: EntityStatus;
  members?: OrgMember[];
  childCount: number;
  companyId?: string;
  parentUnitId?: string | null;
  organizationId?: string;
  children: OrgTreeNode[];
  positionPermission?: PositionPermissionSummary | null;
  isLeaf?: boolean;
}

export function orgScopeKey(type: OrgNodeType | string, id: string): string {
  return `${type}:${id}`;
}

export function hasOrgScopeAccess(
  isSystemAdmin: boolean,
  grantRoots: OrgScopeNode[],
  nodeType: OrgNodeType,
  nodeId: string,
  ancestorKeys: string[],
): boolean {
  if (isSystemAdmin) {
    return true;
  }
  const nodeKey = orgScopeKey(nodeType, nodeId);
  return grantRoots.some((grant) => {
    const grantKey = orgScopeKey(grant.type, grant.id);
    return grantKey === nodeKey || ancestorKeys.includes(grantKey);
  });
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
