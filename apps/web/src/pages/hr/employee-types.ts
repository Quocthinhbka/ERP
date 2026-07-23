import type {
  EducationLevel,
  EmployeeGender,
  EmployeeProfileStatus,
  EmployeeProfileEditRequestStatus,
  FamilyRelationship,
  Religion,
  TrainingMode,
} from '@erp/shared';

export type EmployeeStatus = EmployeeProfileStatus;

export interface LinkedUserSummary {
  id: string;
  accountCode: string;
  email: string | null;
  fullName: string;
}

export interface EmployeeProfileEditRequest {
  id: string;
  status: EmployeeProfileEditRequestStatus;
  reason: string | null;
  reviewNote?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
}

export interface EmployeeListItem {
  id: string;
  profileCode: string;
  fullName: string;
  phone: string;
  email: string | null;
  gender: EmployeeGender | null;
  birthDate: string | null;
  avatarUrl?: string | null;
  status: EmployeeStatus;
  createdAt: string;
  managingCompanyId?: string | null;
  managingCompany?: { id: string; name: string } | null;
  employmentStatus?: string | null;
  workPresenceStatus?: string | null;
  linkedUser: LinkedUserSummary | null;
  editRequests?: EmployeeProfileEditRequest[];
}

export interface EmployeeFamilyMember {
  id: string;
  relationship: FamilyRelationship;
  fullName: string;
  birthYear?: number | null;
  occupation?: string | null;
  workplace?: string | null;
  currentResidence?: string | null;
  sortOrder: number;
}

export interface EmployeeEducationHistory {
  id: string;
  fromMonth: string;
  toMonth: string;
  institution: string;
  major: string;
  trainingMode: TrainingMode;
  degree: string;
  sortOrder: number;
}

export interface EmployeeWorkHistory {
  id: string;
  fromMonth: string;
  toMonth?: string | null;
  company: string;
  department?: string | null;
  position: string;
  sortOrder: number;
}

export interface EmployeeProfileDetail {
  id: string;
  profileCode: string;
  fullName: string;
  gender: EmployeeGender | null;
  birthDate: string | null;
  birthPlace: string | null;
  placeOfOrigin: string | null;
  permanentAddress: string | null;
  currentAddress: string | null;
  phone: string;
  email: string | null;
  ethnicity: string | null;
  religion?: Religion | null;
  identityNumber: string | null;
  identityIssuedDate: string | null;
  identityIssuedPlace: string | null;
  educationLevel: EducationLevel | null;
  youthUnionAdmissionDate?: string | null;
  youthUnionAdmissionPlace?: string | null;
  partyAdmissionDate?: string | null;
  partyAdmissionPlace?: string | null;
  rewardDiscipline?: string | null;
  strengths?: string | null;
  employmentStatus?: string | null;
  workPresenceStatus?: string | null;
  managingCompanyId?: string | null;
  managingCompany?: { id: string; name: string; status?: string } | null;
  customValues?: Record<string, unknown>;
  avatarUrl?: string | null;
  status: EmployeeStatus;
  linkedUser?: LinkedUserSummary | null;
  familyMembers: EmployeeFamilyMember[];
  educationHistories: EmployeeEducationHistory[];
  workHistories: EmployeeWorkHistory[];
  editRequests?: EmployeeProfileEditRequest[];
  latestEditRequest?: EmployeeProfileEditRequest | null;
  createdAt: string;
  updatedAt: string;
}

export interface CheckOrCreateResult {
  created: boolean;
  profile: EmployeeProfileDetail;
}

export interface EmployeeCollectionPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EmployeeListPage extends EmployeeCollectionPage<EmployeeListItem> {}
