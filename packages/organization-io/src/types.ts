import { EntityStatus } from '@erp/shared';

export const ORGANIZATION_IO_VERSION = 1;

export const ORG_IO_SHEETS = {
  ORGANIZATION: 'Organization',
  ORGANIZATION_MEMBERS: 'OrganizationMembers',
  COMPANIES: 'Companies',
  COMPANY_MEMBERS: 'CompanyMembers',
  UNITS: 'Units',
  UNIT_MEMBERS: 'UnitMembers',
} as const;

export interface LinkedProfileRef {
  accountCode?: string | null;
  email?: string | null;
  fullName?: string | null;
}

export interface OrganizationSnapshotRow {
  id: string;
  name: string;
  representativeName?: string | null;
  additionalInfo?: string | null;
  linkedProfile?: LinkedProfileRef | null;
}

export interface MemberSnapshotRow {
  id: string;
  position: string;
  memberName: string;
  phone?: string | null;
  email?: string | null;
  additionalInfo?: string | null;
  sortOrder: number;
  linkedProfile?: LinkedProfileRef | null;
}

export interface OrganizationMemberSnapshotRow extends MemberSnapshotRow {}

export interface CompanySnapshotRow {
  id: string;
  name: string;
  taxId?: string | null;
  address?: string | null;
  representativeName?: string | null;
  phone?: string | null;
  email?: string | null;
  status: EntityStatus;
  sortOrder: number;
  linkedProfile?: LinkedProfileRef | null;
}

export interface CompanyMemberSnapshotRow extends MemberSnapshotRow {
  companyId: string;
  companyName: string;
}

export interface UnitSnapshotRow {
  id: string;
  companyId: string;
  companyName: string;
  parentUnitId?: string | null;
  parentPath?: string | null;
  unitPath: string;
  name: string;
  managerName?: string | null;
  status: EntityStatus;
  additionalInfo?: string | null;
  sortOrder: number;
  linkedProfile?: LinkedProfileRef | null;
}

export interface UnitMemberSnapshotRow extends MemberSnapshotRow {
  unitId: string;
  unitPath: string;
  companyName: string;
}

export interface OrganizationSnapshot {
  version: typeof ORGANIZATION_IO_VERSION;
  exportedAt: string;
  organization: OrganizationSnapshotRow;
  organizationMembers: OrganizationMemberSnapshotRow[];
  companies: CompanySnapshotRow[];
  companyMembers: CompanyMemberSnapshotRow[];
  units: UnitSnapshotRow[];
  unitMembers: UnitMemberSnapshotRow[];
}

export type DiffChangeKind = 'new' | 'changed' | 'unchanged' | 'missing_in_file';

export type DiffEntityType =
  | 'organization'
  | 'organization_member'
  | 'company'
  | 'company_member'
  | 'unit'
  | 'unit_member';

export interface DiffFieldChange {
  field: string;
  current: unknown;
  incoming: unknown;
}

export interface DiffChangeItem {
  selectionKey: string;
  entityType: DiffEntityType;
  entityId: string;
  kind: DiffChangeKind;
  label: string;
  warning?: string;
  current?: Record<string, unknown> | null;
  incoming?: Record<string, unknown> | null;
  fieldDiffs?: DiffFieldChange[];
}

export interface OrganizationDiffResult {
  changes: DiffChangeItem[];
  errors: string[];
  stats: {
    new: number;
    changed: number;
    unchanged: number;
    missingInFile: number;
  };
}

export interface ApplySelection {
  selectionKey: string;
}

export interface OrganizationIoJobResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  snapshotPath?: string;
  diff?: OrganizationDiffResult;
  applied?: {
    created: number;
    updated: number;
    deleted: number;
  };
  stats?: {
    companies: number;
    units: number;
    organizationMembers: number;
    companyMembers: number;
    unitMembers: number;
  };
  errors?: string[];
}

export const ORG_IO_QUEUE_NAME = 'erp-organization-io';
export const ORG_IO_JOB_EXPORT = 'organization-export';
export const ORG_IO_JOB_DIFF = 'organization-diff';
export const ORG_IO_JOB_APPLY = 'organization-apply';
