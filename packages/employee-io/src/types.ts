import {
  EducationLevel,
  EmployeeEmploymentStatus,
  EmployeeGender,
  EmployeeProfileStatus,
  EmployeeWorkPresenceStatus,
  FamilyRelationship,
  Religion,
  TrainingMode,
} from '@erp/shared';

export const EMPLOYEE_IO_VERSION = 2;

export type EmployeeIoFormat = 'excel' | 'json';

export const EMPLOYEE_IO_FORMATS: EmployeeIoFormat[] = ['excel', 'json'];

export function isEmployeeIoFormat(value: unknown): value is EmployeeIoFormat {
  return value === 'excel' || value === 'json';
}

export const EMP_IO_SHEETS = {
  GUIDE: 'HuongDan',
  EMPLOYEES: 'Employees',
  FAMILY_MEMBERS: 'FamilyMembers',
  EDUCATION_HISTORIES: 'EducationHistories',
  WORK_HISTORIES: 'WorkHistories',
} as const;

export interface EmployeeSnapshotRow {
  id: string;
  profileCode: string;
  fullName: string;
  gender?: EmployeeGender | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  placeOfOrigin?: string | null;
  permanentAddress?: string | null;
  currentAddress?: string | null;
  phone: string;
  email?: string | null;
  ethnicity?: string | null;
  religion?: Religion | null;
  identityNumber?: string | null;
  identityIssuedDate?: string | null;
  identityIssuedPlace?: string | null;
  educationLevel?: EducationLevel | null;
  youthUnionAdmissionDate?: string | null;
  youthUnionAdmissionPlace?: string | null;
  partyAdmissionDate?: string | null;
  partyAdmissionPlace?: string | null;
  rewardDiscipline?: string | null;
  strengths?: string | null;
  status: EmployeeProfileStatus;
  /** Trạng thái / hình thức lao động (tab hợp đồng). */
  employmentStatus?: EmployeeEmploymentStatus | null;
  /** Trạng thái làm việc / hiện diện. */
  workPresenceStatus?: EmployeeWorkPresenceStatus | null;
  /** Tên công ty chủ quản (bắt buộc khi import). */
  managingCompanyName: string;
  linkedAccountCode?: string | null;
}

export interface FamilyMemberSnapshotRow {
  id: string;
  profileCode: string;
  relationship: FamilyRelationship;
  fullName: string;
  birthYear?: number | null;
  occupation?: string | null;
  workplace?: string | null;
  currentResidence?: string | null;
  sortOrder: number;
}

export interface EducationHistorySnapshotRow {
  id: string;
  profileCode: string;
  fromMonth: string;
  toMonth: string;
  institution: string;
  major: string;
  trainingMode: TrainingMode;
  degree: string;
  sortOrder: number;
}

export interface WorkHistorySnapshotRow {
  id: string;
  profileCode: string;
  fromMonth: string;
  toMonth?: string | null;
  company: string;
  department?: string | null;
  position: string;
  sortOrder: number;
}

export interface EmployeeSnapshot {
  version: typeof EMPLOYEE_IO_VERSION;
  exportedAt: string;
  employees: EmployeeSnapshotRow[];
  familyMembers: FamilyMemberSnapshotRow[];
  educationHistories: EducationHistorySnapshotRow[];
  workHistories: WorkHistorySnapshotRow[];
}

export type DiffChangeKind = 'new' | 'changed' | 'unchanged' | 'missing_in_file';

export type DiffEntityType =
  | 'employee'
  | 'family_member'
  | 'education_history'
  | 'work_history';

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
  /** Chỉ true với NEW/CHANGED — MISSING_IN_FILE không được áp dụng. */
  selectable: boolean;
  profileCode?: string;
  current?: Record<string, unknown> | null;
  incoming?: Record<string, unknown> | null;
  fieldDiffs?: DiffFieldChange[];
}

export interface EmployeeDiffResult {
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

export interface EmployeeIoJobResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  snapshotPath?: string;
  requestedByUserId?: string;
  diff?: EmployeeDiffResult;
  applied?: {
    created: number;
    updated: number;
    deleted: number;
  };
  stats?: {
    employees: number;
    familyMembers: number;
    educationHistories: number;
    workHistories: number;
  };
  errors?: string[];
}

export const EMP_IO_QUEUE_NAME = 'erp-employee-io';
export const EMP_IO_JOB_EXPORT = 'employee-export';
export const EMP_IO_JOB_DIFF = 'employee-import-diff';
export const EMP_IO_JOB_APPLY = 'employee-import-apply';

export const EMPLOYEE_COMPARE_FIELDS = [
  'profileCode',
  'fullName',
  'gender',
  'birthDate',
  'birthPlace',
  'placeOfOrigin',
  'permanentAddress',
  'currentAddress',
  'phone',
  'email',
  'ethnicity',
  'religion',
  'identityNumber',
  'identityIssuedDate',
  'identityIssuedPlace',
  'educationLevel',
  'youthUnionAdmissionDate',
  'youthUnionAdmissionPlace',
  'partyAdmissionDate',
  'partyAdmissionPlace',
  'rewardDiscipline',
  'strengths',
  'status',
  'employmentStatus',
  'workPresenceStatus',
  'managingCompanyName',
] as const;

export const FAMILY_COMPARE_FIELDS = [
  'profileCode',
  'relationship',
  'fullName',
  'birthYear',
  'occupation',
  'workplace',
  'currentResidence',
  'sortOrder',
] as const;

export const EDUCATION_COMPARE_FIELDS = [
  'profileCode',
  'fromMonth',
  'toMonth',
  'institution',
  'major',
  'trainingMode',
  'degree',
  'sortOrder',
] as const;

export const WORK_COMPARE_FIELDS = [
  'profileCode',
  'fromMonth',
  'toMonth',
  'company',
  'department',
  'position',
  'sortOrder',
] as const;
