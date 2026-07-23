export enum PermissionModule {
  SETUP = 'setup',
  USER = 'user',
  HR = 'hr',
  PERMISSION_GROUP = 'permission_group',
  ORGANIZATION = 'organization',
}

export enum EntityStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum EmployeeGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

/** Vòng đời hồ sơ sơ yếu lý lịch (một trạng thái duy nhất). */
export enum EmployeeProfileStatus {
  /** Chưa khai báo */
  INCOMPLETE = 'INCOMPLETE',
  /** Chờ xác nhận */
  PENDING_REVIEW = 'PENDING_REVIEW',
  /** Cần điều chỉnh */
  NEEDS_ADJUSTMENT = 'NEEDS_ADJUSTMENT',
  /** Đã xác nhận */
  VERIFIED = 'VERIFIED',
  /** Yêu cầu chỉnh sửa (đang chờ HR duyệt yêu cầu) */
  EDIT_REQUESTED = 'EDIT_REQUESTED',
  /** Khoá */
  LOCKED = 'LOCKED',
}

/** Ma trận chuyển trạng thái hợp lệ do HR đổi trạng thái / khóa / mở khóa. */
export const HR_EMPLOYEE_STATUS_TRANSITIONS: Record<
  EmployeeProfileStatus,
  EmployeeProfileStatus[]
> = {
  [EmployeeProfileStatus.INCOMPLETE]: [EmployeeProfileStatus.LOCKED],
  [EmployeeProfileStatus.PENDING_REVIEW]: [
    EmployeeProfileStatus.VERIFIED,
    EmployeeProfileStatus.NEEDS_ADJUSTMENT,
    EmployeeProfileStatus.LOCKED,
  ],
  [EmployeeProfileStatus.NEEDS_ADJUSTMENT]: [EmployeeProfileStatus.LOCKED],
  [EmployeeProfileStatus.VERIFIED]: [EmployeeProfileStatus.LOCKED],
  // Duyệt yêu cầu chỉnh sửa qua endpoint edit-request, không đổi status tay.
  [EmployeeProfileStatus.EDIT_REQUESTED]: [EmployeeProfileStatus.LOCKED],
  [EmployeeProfileStatus.LOCKED]: [
    EmployeeProfileStatus.INCOMPLETE,
    EmployeeProfileStatus.PENDING_REVIEW,
    EmployeeProfileStatus.NEEDS_ADJUSTMENT,
    EmployeeProfileStatus.VERIFIED,
  ],
};

/** Trạng thái tự động tính lại khi lưu hồ sơ (đủ/thiếu field bắt buộc). */
export const AUTO_LIFECYCLE_STATUSES: EmployeeProfileStatus[] = [
  EmployeeProfileStatus.INCOMPLETE,
  EmployeeProfileStatus.NEEDS_ADJUSTMENT,
];


export function getAllowedEmployeeStatusTransitions(
  from: EmployeeProfileStatus,
): EmployeeProfileStatus[] {
  return HR_EMPLOYEE_STATUS_TRANSITIONS[from] ?? [];
}

export enum EmployeeProfileEditRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum EmployeeDocumentType {
  IDENTITY = 'IDENTITY',
  RESUME = 'RESUME',
  JOB_APPLICATION = 'JOB_APPLICATION',
  CV = 'CV',
  DEGREE = 'DEGREE',
  HEALTH_CERTIFICATE = 'HEALTH_CERTIFICATE',
  PORTRAIT_PHOTO = 'PORTRAIT_PHOTO',
  SOCIAL_INSURANCE = 'SOCIAL_INSURANCE',
  CRIMINAL_RECORD = 'CRIMINAL_RECORD',
  RESIDENCE_CONFIRMATION = 'RESIDENCE_CONFIRMATION',
  PRACTICE_LICENSE = 'PRACTICE_LICENSE',
  CERTIFICATE = 'CERTIFICATE',
  /** Giá trị cũ, giữ để đọc dữ liệu đã upload. */
  CONTRACT = 'CONTRACT',
  OTHER = 'OTHER',
}

export enum FamilyRelationship {
  FATHER = 'FATHER',
  MOTHER = 'MOTHER',
  BROTHER = 'BROTHER',
  SISTER = 'SISTER',
  YOUNGER_BROTHER = 'YOUNGER_BROTHER',
  YOUNGER_SISTER = 'YOUNGER_SISTER',
  GUARDIAN = 'GUARDIAN',
}

export enum TrainingMode {
  REGULAR = 'REGULAR',
  IN_SERVICE = 'IN_SERVICE',
  BRIDGE = 'BRIDGE',
  SECOND_DEGREE = 'SECOND_DEGREE',
  MASTER = 'MASTER',
  OTHER = 'OTHER',
}

export enum EducationLevel {
  GRADE_5 = 'GRADE_5',
  GRADE_9 = 'GRADE_9',
  GRADE_12 = 'GRADE_12',
  COLLEGE = 'COLLEGE',
  UNIVERSITY = 'UNIVERSITY',
  POSTGRADUATE = 'POSTGRADUATE',
  OTHER = 'OTHER',
}

export enum Religion {
  NONE = 'NONE',
  BUDDHISM = 'BUDDHISM',
  CATHOLICISM = 'CATHOLICISM',
  PROTESTANTISM = 'PROTESTANTISM',
  CAO_DAI = 'CAO_DAI',
  HOA_HAO = 'HOA_HAO',
  ISLAM = 'ISLAM',
  OTHER = 'OTHER',
}

export const ETHNICITIES = [
  'Kinh',
  'Tay',
  'Thai',
  'Muong',
  'Khmer',
  'Hoa',
  'Nung',
  'Hmong',
  'Dao',
  'Gia Rai',
  'E De',
  'Ba Na',
  'San Chay',
  'Cham',
  'Co Ho',
  'Xo Dang',
  'San Diu',
  'Hrê',
  'Ra Glai',
  'Mnong',
  'Tho',
  'Stieng',
  'Kho Mu',
  'Bru Van Kieu',
  'Co Tu',
  'Giay',
  'Ta Oi',
  'Ma',
  'Co',
  'Cho Ro',
  'Xinh Mun',
  'Ha Nhi',
  'Chu Ru',
  'Lao',
  'La Chi',
  'Khang',
  'Phu La',
  'La Hu',
  'La Ha',
  'Pà Then',
  'Lự',
  'Ngai',
  'Chứt',
  'Lô Lô',
  'Mảng',
  'Cơ Lao',
  'Bố Y',
  'Cống',
  'Si La',
  'Pu Péo',
  'Brâu',
  'Ơ Đu',
  'Rơ Măm',
  'Người nước ngoài',
] as const;

export type Ethnicity = (typeof ETHNICITIES)[number];

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
  ORGANIZATION_MEMBER: 'ORGANIZATION_MEMBER',
  COMPANY_MEMBER: 'COMPANY_MEMBER',
} as const;

export type PositionHolderKind =
  (typeof PositionHolderKind)[keyof typeof PositionHolderKind];


export interface OrgScopeNode {
  type: OrgNodeType;
  id: string;
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
  HR_VIEW: 'hr:view',
  HR_EMPLOYEE_VIEW: 'hr:employee:view',
  HR_EMPLOYEE_CREATE: 'hr:employee:create',
  HR_EMPLOYEE_UPDATE: 'hr:employee:update',
  HR_EMPLOYEE_DELETE: 'hr:employee:delete',
  HR_EMPLOYEE_VERIFY: 'hr:employee:verify',
  HR_EMPLOYEE_STATUS_UPDATE: 'hr:employee:status:update',
  HR_EMPLOYEE_EDIT_REQUEST_REVIEW: 'hr:employee:edit-request:review',
  HR_EMPLOYEE_EXPORT: 'hr:employee:export',
  HR_EMPLOYEE_IMPORT: 'hr:employee:import',
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

/** Role nội bộ duy nhất — chỉ dùng cho bootstrap Super Admin, không expose CRUD. */
export enum SystemRole {
  SUPER_ADMIN = 'super_admin',
}

export type JwtTokenType = 'access' | 'refresh';

export interface JwtPayload {
  sub: string;
  email?: string | null;
  typ: JwtTokenType;
  /** Chỉ có trên refresh token — dùng để rotate/revoke. */
  jti?: string;
  permissions?: PermissionCode[];
  isSystemAdmin?: boolean;
  orgScopes?: OrgScopeNode[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/** Tiền tố mã tài khoản tự sinh: TK-00001, TK-00002, … */
export const ACCOUNT_CODE_PREFIX = 'TK-';
export const ACCOUNT_CODE_PAD = 5;

export function formatAccountCode(sequence: number): string {
  return `${ACCOUNT_CODE_PREFIX}${String(sequence).padStart(ACCOUNT_CODE_PAD, '0')}`;
}

export function parseAccountCodeSequence(code: string): number | null {
  const match = new RegExp(`^${ACCOUNT_CODE_PREFIX}(\\d+)$`).exec(code.trim());
  if (!match) return null;
  return Number.parseInt(match[1], 10);
}

/** Tiền tố mã vị trí tổ chức: VT-00001, … */
export const POSITION_CODE_PREFIX = 'VT-';
export const POSITION_CODE_PAD = 5;

export function formatPositionCode(sequence: number): string {
  return `${POSITION_CODE_PREFIX}${String(sequence).padStart(POSITION_CODE_PAD, '0')}`;
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
  /** Trạng thái làm việc từ hồ sơ gắn tài khoản liên kết (null = chưa gắn hồ sơ). */
  linkedWorkPresenceStatus?: EmployeeWorkPresenceStatus | null;
  positionCode?: string | null;
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
  /** Trạng thái làm việc từ hồ sơ gắn tài khoản liên kết (null = chưa gắn hồ sơ). */
  linkedWorkPresenceStatus?: EmployeeWorkPresenceStatus | null;
  positionCode?: string | null;
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
  // Chưa gắn vị trí → không áp dụng giới hạn phạm vi (chỉ còn kiểm soát bởi permission codes).
  if (grantRoots.length === 0) {
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

/** Trạng thái / hình thức lao động hợp đồng (khác vòng đời hồ sơ). */
export enum EmployeeEmploymentStatus {
  APPRENTICE = 'APPRENTICE',
  INTERN = 'INTERN',
  PROBATION = 'PROBATION',
  OFFICIAL = 'OFFICIAL',
  RESIGNED = 'RESIGNED',
  OTHER = 'OTHER',
}

export const EMPLOYMENT_STATUS_LABELS: Record<EmployeeEmploymentStatus, string> = {
  [EmployeeEmploymentStatus.APPRENTICE]: 'Đang học việc',
  [EmployeeEmploymentStatus.INTERN]: 'Đang thực tập',
  [EmployeeEmploymentStatus.PROBATION]: 'Đang thử việc',
  [EmployeeEmploymentStatus.OFFICIAL]: 'Nhân viên chính thức',
  [EmployeeEmploymentStatus.RESIGNED]: 'Đã nghỉ việc',
  [EmployeeEmploymentStatus.OTHER]: 'Khác',
};

/** Trạng thái làm việc / hiện diện (tab hợp đồng). */
export enum EmployeeWorkPresenceStatus {
  WORKING = 'WORKING',
  ON_BREAK = 'ON_BREAK',
  ON_LEAVE = 'ON_LEAVE',
  ABSENT = 'ABSENT',
  UNKNOWN = 'UNKNOWN',
}

export const WORK_PRESENCE_STATUS_LABELS: Record<
  EmployeeWorkPresenceStatus,
  string
> = {
  [EmployeeWorkPresenceStatus.WORKING]: 'Đang làm việc',
  [EmployeeWorkPresenceStatus.ON_BREAK]: 'Đang nghỉ',
  [EmployeeWorkPresenceStatus.ON_LEAVE]: 'Đang nghỉ phép',
  [EmployeeWorkPresenceStatus.ABSENT]: 'Đang vắng mặt',
  [EmployeeWorkPresenceStatus.UNKNOWN]: 'Chưa xác định',
};

export enum EmployeeProfileFieldDataType {
  TEXT = 'TEXT',
  TEXTAREA = 'TEXTAREA',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  PHONE = 'PHONE',
  EMAIL = 'EMAIL',
  SELECT = 'SELECT',
  MULTISELECT = 'MULTISELECT',
  BOOLEAN = 'BOOLEAN',
  SECTION = 'SECTION',
}

export const PROFILE_FIELD_DATA_TYPE_LABELS: Record<
  EmployeeProfileFieldDataType,
  string
> = {
  [EmployeeProfileFieldDataType.TEXT]: 'Văn bản',
  [EmployeeProfileFieldDataType.TEXTAREA]: 'Đoạn văn',
  [EmployeeProfileFieldDataType.NUMBER]: 'Số',
  [EmployeeProfileFieldDataType.DATE]: 'Ngày',
  [EmployeeProfileFieldDataType.PHONE]: 'Số điện thoại',
  [EmployeeProfileFieldDataType.EMAIL]: 'Email',
  [EmployeeProfileFieldDataType.SELECT]: 'Danh sách chọn',
  [EmployeeProfileFieldDataType.MULTISELECT]: 'Chọn nhiều',
  [EmployeeProfileFieldDataType.BOOLEAN]: 'Có / Không',
  [EmployeeProfileFieldDataType.SECTION]: 'Mục danh sách',
};

/** Cột EmployeeProfile tương ứng storageKey built-in. */
export const BUILTIN_PROFILE_STORAGE_KEYS = [
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
  'employmentStatus',
  'workPresenceStatus',
  'managingCompanyId',
] as const;

export type BuiltinProfileStorageKey =
  (typeof BUILTIN_PROFILE_STORAGE_KEYS)[number];

export type ProfileFieldOptions = {
  sectionKind?: 'family' | 'education' | 'work';
  choices?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  pattern?: string;
};

export const DEFAULT_PROFILE_TAB_CODES = {
  PERSONAL: 'personal',
  CONTRACT: 'contract',
} as const;

export type DefaultFieldSeed = {
  code: string;
  label: string;
  dataType: EmployeeProfileFieldDataType;
  storageKey?: string | null;
  required?: boolean;
  visible?: boolean;
  locked?: boolean;
  isSystem?: boolean;
  options?: ProfileFieldOptions | null;
  sortOrder: number;
  tabCodes: string[];
};

export const DEFAULT_PROFILE_TABS: Array<{
  code: string;
  name: string;
  sortOrder: number;
  isSystem: boolean;
}> = [
  {
    code: DEFAULT_PROFILE_TAB_CODES.PERSONAL,
    name: 'Thông tin cá nhân',
    sortOrder: 0,
    isSystem: true,
  },
  {
    code: DEFAULT_PROFILE_TAB_CODES.CONTRACT,
    name: 'Thông tin hợp đồng',
    sortOrder: 1,
    isSystem: true,
  },
];

const employmentChoices = (
  Object.values(EmployeeEmploymentStatus) as EmployeeEmploymentStatus[]
).map((value) => ({
  value,
  label: EMPLOYMENT_STATUS_LABELS[value],
}));

const workPresenceChoices = (
  Object.values(EmployeeWorkPresenceStatus) as EmployeeWorkPresenceStatus[]
).map((value) => ({
  value,
  label: WORK_PRESENCE_STATUS_LABELS[value],
}));

/** Seed mặc định: tab cá nhân + hợp đồng + section family/education/work. */
export const DEFAULT_PROFILE_FIELDS: DefaultFieldSeed[] = [
  {
    code: 'fullName',
    label: 'Họ và tên',
    dataType: EmployeeProfileFieldDataType.TEXT,
    storageKey: 'fullName',
    required: true,
    locked: true,
    isSystem: true,
    sortOrder: 0,
    tabCodes: [
      DEFAULT_PROFILE_TAB_CODES.PERSONAL,
      DEFAULT_PROFILE_TAB_CODES.CONTRACT,
    ],
  },
  {
    code: 'phone',
    label: 'Điện thoại',
    dataType: EmployeeProfileFieldDataType.PHONE,
    storageKey: 'phone',
    required: true,
    locked: true,
    isSystem: true,
    sortOrder: 1,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'birthDate',
    label: 'Ngày sinh',
    dataType: EmployeeProfileFieldDataType.DATE,
    storageKey: 'birthDate',
    required: true,
    isSystem: true,
    sortOrder: 2,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'identityNumber',
    label: 'CCCD/CMND',
    dataType: EmployeeProfileFieldDataType.TEXT,
    storageKey: 'identityNumber',
    required: true,
    isSystem: true,
    sortOrder: 3,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'gender',
    label: 'Giới tính',
    dataType: EmployeeProfileFieldDataType.SELECT,
    storageKey: 'gender',
    isSystem: true,
    sortOrder: 4,
    options: {
      choices: [
        { value: 'MALE', label: 'Nam' },
        { value: 'FEMALE', label: 'Nữ' },
        { value: 'OTHER', label: 'Khác' },
      ],
    },
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'birthPlace',
    label: 'Nơi sinh',
    dataType: EmployeeProfileFieldDataType.TEXT,
    storageKey: 'birthPlace',
    isSystem: true,
    sortOrder: 5,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'placeOfOrigin',
    label: 'Nguyên quán',
    dataType: EmployeeProfileFieldDataType.TEXT,
    storageKey: 'placeOfOrigin',
    isSystem: true,
    sortOrder: 6,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'permanentAddress',
    label: 'Hộ khẩu thường trú',
    dataType: EmployeeProfileFieldDataType.TEXTAREA,
    storageKey: 'permanentAddress',
    isSystem: true,
    sortOrder: 7,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'currentAddress',
    label: 'Chỗ ở hiện nay',
    dataType: EmployeeProfileFieldDataType.TEXTAREA,
    storageKey: 'currentAddress',
    isSystem: true,
    sortOrder: 8,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'email',
    label: 'Email',
    dataType: EmployeeProfileFieldDataType.EMAIL,
    storageKey: 'email',
    isSystem: true,
    sortOrder: 9,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'ethnicity',
    label: 'Dân tộc',
    dataType: EmployeeProfileFieldDataType.TEXT,
    storageKey: 'ethnicity',
    isSystem: true,
    sortOrder: 10,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'religion',
    label: 'Tôn giáo',
    dataType: EmployeeProfileFieldDataType.TEXT,
    storageKey: 'religion',
    isSystem: true,
    sortOrder: 11,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'identityIssuedDate',
    label: 'Ngày cấp',
    dataType: EmployeeProfileFieldDataType.DATE,
    storageKey: 'identityIssuedDate',
    isSystem: true,
    sortOrder: 12,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'identityIssuedPlace',
    label: 'Nơi cấp',
    dataType: EmployeeProfileFieldDataType.TEXT,
    storageKey: 'identityIssuedPlace',
    isSystem: true,
    sortOrder: 13,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'educationLevel',
    label: 'Trình độ văn hóa',
    dataType: EmployeeProfileFieldDataType.TEXT,
    storageKey: 'educationLevel',
    isSystem: true,
    sortOrder: 14,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'youthUnionAdmissionDate',
    label: 'Ngày kết nạp Đoàn',
    dataType: EmployeeProfileFieldDataType.DATE,
    storageKey: 'youthUnionAdmissionDate',
    isSystem: true,
    sortOrder: 15,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'youthUnionAdmissionPlace',
    label: 'Nơi kết nạp Đoàn',
    dataType: EmployeeProfileFieldDataType.TEXT,
    storageKey: 'youthUnionAdmissionPlace',
    isSystem: true,
    sortOrder: 16,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'partyAdmissionDate',
    label: 'Ngày kết nạp Đảng',
    dataType: EmployeeProfileFieldDataType.DATE,
    storageKey: 'partyAdmissionDate',
    isSystem: true,
    sortOrder: 17,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'partyAdmissionPlace',
    label: 'Nơi kết nạp Đảng',
    dataType: EmployeeProfileFieldDataType.TEXT,
    storageKey: 'partyAdmissionPlace',
    isSystem: true,
    sortOrder: 18,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'rewardDiscipline',
    label: 'Khen thưởng / Kỷ luật',
    dataType: EmployeeProfileFieldDataType.TEXTAREA,
    storageKey: 'rewardDiscipline',
    isSystem: true,
    sortOrder: 19,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'strengths',
    label: 'Sở trường',
    dataType: EmployeeProfileFieldDataType.TEXTAREA,
    storageKey: 'strengths',
    isSystem: true,
    sortOrder: 20,
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'managingCompanyId',
    label: 'Công ty chủ quản',
    dataType: EmployeeProfileFieldDataType.SELECT,
    storageKey: 'managingCompanyId',
    required: true,
    locked: true,
    isSystem: true,
    sortOrder: 0,
    // Chỉ tab Hợp đồng — tránh trùng Form.Item trên form edit (2 Select cùng name).
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.CONTRACT],
  },
  {
    code: 'employmentStatus',
    label: 'Hình thức lao động',
    dataType: EmployeeProfileFieldDataType.SELECT,
    storageKey: 'employmentStatus',
    required: true,
    isSystem: true,
    sortOrder: 1,
    options: { choices: employmentChoices },
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.CONTRACT],
  },
  {
    code: 'workPresenceStatus',
    label: 'Trạng thái làm việc',
    dataType: EmployeeProfileFieldDataType.SELECT,
    storageKey: 'workPresenceStatus',
    required: true,
    isSystem: true,
    sortOrder: 2,
    options: { choices: workPresenceChoices },
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.CONTRACT],
  },
  {
    code: 'section.family',
    label: 'II. Quan hệ gia đình',
    dataType: EmployeeProfileFieldDataType.SECTION,
    storageKey: null,
    required: true,
    isSystem: true,
    sortOrder: 100,
    options: { sectionKind: 'family' },
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'section.education',
    label: 'III. Tóm tắt quá trình đào tạo',
    dataType: EmployeeProfileFieldDataType.SECTION,
    storageKey: null,
    required: true,
    isSystem: true,
    sortOrder: 101,
    options: { sectionKind: 'education' },
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
  {
    code: 'section.work',
    label: 'IV. Tóm tắt quá trình công tác',
    dataType: EmployeeProfileFieldDataType.SECTION,
    storageKey: null,
    required: true,
    isSystem: true,
    sortOrder: 102,
    options: { sectionKind: 'work' },
    tabCodes: [DEFAULT_PROFILE_TAB_CODES.PERSONAL],
  },
];

