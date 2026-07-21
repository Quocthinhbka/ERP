import type {
  EducationLevel,
  EmployeeGender,
  EntityStatus,
  FamilyRelationship,
  Religion,
  TrainingMode,
} from '@erp/shared';

export type EmployeeStatus = EntityStatus;

export interface LinkedUserSummary {
  id: string;
  accountCode: string;
  email: string | null;
  fullName: string;
}

export interface EmployeeListItem {
  id: string;
  profileCode: string;
  fullName: string;
  phone: string;
  email: string;
  gender: EmployeeGender;
  birthDate: string;
  status: EmployeeStatus;
  createdAt: string;
  linkedUser: LinkedUserSummary | null;
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
  gender: EmployeeGender;
  birthDate: string;
  birthPlace: string;
  placeOfOrigin: string;
  permanentAddress: string;
  currentAddress: string;
  phone: string;
  email: string;
  ethnicity: string;
  religion?: Religion | null;
  identityNumber: string;
  identityIssuedDate: string;
  identityIssuedPlace: string;
  educationLevel: EducationLevel;
  youthUnionAdmissionDate?: string | null;
  youthUnionAdmissionPlace?: string | null;
  partyAdmissionDate?: string | null;
  partyAdmissionPlace?: string | null;
  rewardDiscipline?: string | null;
  strengths?: string | null;
  status: EmployeeStatus;
  linkedUser?: LinkedUserSummary | null;
  familyMembers: EmployeeFamilyMember[];
  educationHistories: EmployeeEducationHistory[];
  workHistories: EmployeeWorkHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeCollectionPage<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EmployeeListPage extends EmployeeCollectionPage<EmployeeListItem> {}
