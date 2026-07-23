import {
  EducationLevel,
  EmployeeEmploymentStatus,
  EmployeeGender,
  EmployeeProfileStatus,
  EmployeeWorkPresenceStatus,
  EMPLOYMENT_STATUS_LABELS,
  ETHNICITIES,
  FamilyRelationship,
  getAllowedEmployeeStatusTransitions,
  Religion,
  TrainingMode,
  WORK_PRESENCE_STATUS_LABELS,
} from '@erp/shared';

export const GENDER_OPTIONS = [
  { value: EmployeeGender.MALE, label: 'Nam' },
  { value: EmployeeGender.FEMALE, label: 'Nữ' },
  { value: EmployeeGender.OTHER, label: 'Khác' },
];

export const PROFILE_STATUS_OPTIONS = [
  { value: EmployeeProfileStatus.INCOMPLETE, label: 'Chưa khai báo', color: 'default' },
  { value: EmployeeProfileStatus.PENDING_REVIEW, label: 'Chờ xác nhận', color: 'processing' },
  { value: EmployeeProfileStatus.NEEDS_ADJUSTMENT, label: 'Cần điều chỉnh', color: 'orange' },
  { value: EmployeeProfileStatus.VERIFIED, label: 'Đã xác nhận', color: 'green' },
  {
    value: EmployeeProfileStatus.EDIT_REQUESTED,
    label: 'Yêu cầu chỉnh sửa',
    color: 'purple',
  },
  { value: EmployeeProfileStatus.LOCKED, label: 'Khóa', color: 'red' },
] as const;

export const EMPLOYMENT_STATUS_FILTER_OPTIONS = (
  Object.values(EmployeeEmploymentStatus) as EmployeeEmploymentStatus[]
).map((value) => ({
  value,
  label: EMPLOYMENT_STATUS_LABELS[value],
}));

export const WORK_PRESENCE_FILTER_OPTIONS = (
  Object.values(EmployeeWorkPresenceStatus) as EmployeeWorkPresenceStatus[]
).map((value) => ({
  value,
  label: WORK_PRESENCE_STATUS_LABELS[value],
}));

export function profileStatusLabel(status: EmployeeProfileStatus | string) {
  return PROFILE_STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status;
}

export function profileStatusColor(status: EmployeeProfileStatus | string) {
  return PROFILE_STATUS_OPTIONS.find((item) => item.value === status)?.color ?? 'default';
}

export function getNextStatusOptions(from: EmployeeProfileStatus) {
  return getAllowedEmployeeStatusTransitions(from).map((value) => ({
    value,
    label: profileStatusLabel(value),
    color: profileStatusColor(value),
  }));
}

export const RELIGION_OPTIONS = [
  { value: Religion.NONE, label: 'Không' },
  { value: Religion.BUDDHISM, label: 'Phật giáo' },
  { value: Religion.CATHOLICISM, label: 'Công giáo' },
  { value: Religion.PROTESTANTISM, label: 'Tin Lành' },
  { value: Religion.CAO_DAI, label: 'Cao Đài' },
  { value: Religion.HOA_HAO, label: 'Hòa Hảo' },
  { value: Religion.ISLAM, label: 'Hồi giáo' },
  { value: Religion.OTHER, label: 'Khác' },
];

export const EDUCATION_LEVEL_OPTIONS = [
  { value: EducationLevel.GRADE_5, label: '5/12' },
  { value: EducationLevel.GRADE_9, label: '9/12' },
  { value: EducationLevel.GRADE_12, label: '12/12' },
  { value: EducationLevel.COLLEGE, label: 'Cao đẳng' },
  { value: EducationLevel.UNIVERSITY, label: 'Đại học' },
  { value: EducationLevel.POSTGRADUATE, label: 'Sau đại học' },
  { value: EducationLevel.OTHER, label: 'Khác' },
];

export const FAMILY_RELATIONSHIP_OPTIONS = [
  { value: FamilyRelationship.FATHER, label: 'Bố' },
  { value: FamilyRelationship.MOTHER, label: 'Mẹ' },
  { value: FamilyRelationship.BROTHER, label: 'Anh' },
  { value: FamilyRelationship.SISTER, label: 'Chị' },
  { value: FamilyRelationship.YOUNGER_BROTHER, label: 'Em trai' },
  { value: FamilyRelationship.YOUNGER_SISTER, label: 'Em gái' },
  { value: FamilyRelationship.GUARDIAN, label: 'Người giám hộ' },
];

export const TRAINING_MODE_OPTIONS = [
  { value: TrainingMode.REGULAR, label: 'Chính quy' },
  { value: TrainingMode.IN_SERVICE, label: 'Tại chức' },
  { value: TrainingMode.BRIDGE, label: 'Liên thông' },
  { value: TrainingMode.SECOND_DEGREE, label: 'Văn bằng 2' },
  { value: TrainingMode.MASTER, label: 'Cao học' },
  { value: TrainingMode.OTHER, label: 'Khác' },
];

export const ETHNICITY_OPTIONS = ETHNICITIES.map((value) => ({
  value,
  label: value,
}));
