import type { OrgMember, OrgNodeType, OrgTreeNode } from '@erp/shared';

export interface TreeResponse {
  tree: OrgTreeNode;
  matchedKeys: string[];
}

export interface UserOption {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  accountCode: string;
  linkedEmployeeProfileId: string | null;
  linkedEmployeeProfile?: {
    fullName: string;
    phone: string;
    email: string | null;
    workPresenceStatus: string;
  } | null;
}

export interface PermissionGroupOption {
  id: string;
  name: string;
  versions: Array<{ id: string; name: string; isCustom: boolean }>;
}

export interface ScopeTreeOption {
  type: OrgNodeType;
  id: string;
  name: string;
  depth: number;
  selectable: boolean;
  isCurrent?: boolean;
}

export interface PositionPermissionFormValue {
  permissionGroupVersionId?: string;
  includeSelf?: boolean;
  parentScopeKeys?: string[];
}

export type SelectedNode = {
  type: OrgNodeType;
  id: string;
  data: OrgTreeNode;
  member?: OrgMember;
};
