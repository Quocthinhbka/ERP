import {
  EducationLevel,
  EmployeeEmploymentStatus,
  EmployeeGender,
  EmployeeProfileStatus,
  EmployeeWorkPresenceStatus,
  ETHNICITIES,
  FamilyRelationship,
  Religion,
  TrainingMode,
} from '@erp/shared';
import type { EmployeeSnapshot } from './types.js';
import { EMPLOYEE_IO_VERSION } from './types.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const PHONE_PATTERN = /^\d{10,11}$/;
const IDENTITY_PATTERN = /^\d{12}$/;

/** Import chỉ được đặt trạng thái khai báo, không vượt bước xác nhận HR. */
const IMPORTABLE_STATUSES = new Set<EmployeeProfileStatus>([
  EmployeeProfileStatus.INCOMPLETE,
  EmployeeProfileStatus.NEEDS_ADJUSTMENT,
]);

function normalizeName(value: string) {
  return value.trim().toLocaleUpperCase('vi-VN');
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function optionalDate(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function optionalEnum<T extends string>(
  value: T | string | null | undefined,
): T | null {
  const trimmed = typeof value === 'string' ? value.trim() : value;
  return trimmed ? (trimmed as T) : null;
}

export function normalizeEmployeeSnapshot(
  snapshot: EmployeeSnapshot,
): EmployeeSnapshot {
  return {
    ...snapshot,
    version: EMPLOYEE_IO_VERSION,
    employees: snapshot.employees.map((row) => ({
      ...row,
      profileCode: (row.profileCode ?? '').trim().toUpperCase(),
      fullName: normalizeName(row.fullName ?? ''),
      gender: optionalEnum<EmployeeGender>(row.gender),
      birthDate: optionalDate(row.birthDate),
      birthPlace: optionalText(row.birthPlace),
      placeOfOrigin: optionalText(row.placeOfOrigin),
      permanentAddress: optionalText(row.permanentAddress),
      currentAddress: optionalText(row.currentAddress),
      phone: normalizePhone(row.phone ?? ''),
      email: normalizeEmail(row.email),
      ethnicity: optionalText(row.ethnicity),
      religion: optionalEnum<Religion>(row.religion),
      identityNumber: row.identityNumber
        ? row.identityNumber.replace(/\D/g, '') || null
        : null,
      identityIssuedDate: optionalDate(row.identityIssuedDate),
      identityIssuedPlace: optionalText(row.identityIssuedPlace),
      educationLevel: optionalEnum<EducationLevel>(row.educationLevel),
      youthUnionAdmissionDate: optionalDate(row.youthUnionAdmissionDate),
      youthUnionAdmissionPlace: optionalText(row.youthUnionAdmissionPlace),
      partyAdmissionDate: optionalDate(row.partyAdmissionDate),
      partyAdmissionPlace: optionalText(row.partyAdmissionPlace),
      rewardDiscipline: optionalText(row.rewardDiscipline),
      strengths: optionalText(row.strengths),
      linkedAccountCode:
        optionalText(row.linkedAccountCode)?.toUpperCase() ?? null,
      managingCompanyName: (row.managingCompanyName ?? '').trim(),
      employmentStatus: optionalEnum<EmployeeEmploymentStatus>(
        row.employmentStatus,
      ),
      workPresenceStatus:
        optionalEnum<EmployeeWorkPresenceStatus>(row.workPresenceStatus) ??
        EmployeeWorkPresenceStatus.UNKNOWN,
      status: IMPORTABLE_STATUSES.has(row.status)
        ? row.status
        : EmployeeProfileStatus.INCOMPLETE,
    })),
    familyMembers: snapshot.familyMembers.map((row) => ({
      ...row,
      profileCode: row.profileCode.trim().toUpperCase(),
      fullName: normalizeName(row.fullName),
      occupation: optionalText(row.occupation),
      workplace: optionalText(row.workplace),
      currentResidence: optionalText(row.currentResidence),
    })),
    educationHistories: snapshot.educationHistories.map((row) => ({
      ...row,
      profileCode: row.profileCode.trim().toUpperCase(),
      institution: row.institution.trim(),
      major: row.major.trim(),
      degree: row.degree.trim(),
    })),
    workHistories: snapshot.workHistories.map((row) => ({
      ...row,
      profileCode: row.profileCode.trim().toUpperCase(),
      company: row.company.trim(),
      department: optionalText(row.department),
      position: row.position.trim(),
      toMonth: optionalText(row.toMonth),
    })),
  };
}

export function validateEmployeeSnapshot(snapshot: EmployeeSnapshot): string[] {
  const errors: string[] = [];
  if (snapshot.version !== EMPLOYEE_IO_VERSION) {
    errors.push(`Phiên bản file không hỗ trợ (yêu cầu v${EMPLOYEE_IO_VERSION})`);
  }

  const profileCodes = new Set<string>();
  const phones = new Set<string>();
  const emails = new Set<string>();
  const identities = new Set<string>();
  const employeeIds = new Set<string>();

  snapshot.employees.forEach((row, index) => {
    const rowNo = index + 2;
    const prefix = `Employees dòng ${rowNo}`;

    if (!row.fullName) errors.push(`${prefix}: thiếu họ tên`);
    if (!PHONE_PATTERN.test(row.phone)) {
      errors.push(`${prefix}: SĐT phải gồm 10–11 chữ số`);
    }
    if (!row.managingCompanyName) {
      errors.push(`${prefix}: thiếu công ty chủ quản (managingCompanyName)`);
    }
    if (
      row.employmentStatus &&
      !Object.values(EmployeeEmploymentStatus).includes(row.employmentStatus)
    ) {
      errors.push(`${prefix}: hình thức lao động không hợp lệ`);
    }
    if (
      row.workPresenceStatus &&
      !Object.values(EmployeeWorkPresenceStatus).includes(row.workPresenceStatus)
    ) {
      errors.push(`${prefix}: trạng thái làm việc không hợp lệ`);
    }
    if (row.gender && !Object.values(EmployeeGender).includes(row.gender)) {
      errors.push(`${prefix}: giới tính không hợp lệ`);
    }
    if (row.birthDate && !DATE_PATTERN.test(row.birthDate)) {
      errors.push(`${prefix}: ngày sinh phải dạng YYYY-MM-DD`);
    }
    if (row.email && !row.email.includes('@')) {
      errors.push(`${prefix}: email không hợp lệ`);
    }
    if (
      row.ethnicity &&
      !(ETHNICITIES as readonly string[]).includes(row.ethnicity)
    ) {
      errors.push(`${prefix}: dân tộc không thuộc danh mục`);
    }
    if (row.religion && !Object.values(Religion).includes(row.religion)) {
      errors.push(`${prefix}: tôn giáo không hợp lệ`);
    }
    if (row.identityNumber && !IDENTITY_PATTERN.test(row.identityNumber)) {
      errors.push(`${prefix}: CCCD phải gồm 12 chữ số`);
    }
    if (row.identityIssuedDate && !DATE_PATTERN.test(row.identityIssuedDate)) {
      errors.push(`${prefix}: ngày cấp CCCD phải dạng YYYY-MM-DD`);
    }
    if (
      row.educationLevel &&
      !Object.values(EducationLevel).includes(row.educationLevel)
    ) {
      errors.push(`${prefix}: trình độ văn hóa không hợp lệ`);
    }
    if (!Object.values(EmployeeProfileStatus).includes(row.status)) {
      errors.push(`${prefix}: trạng thái không hợp lệ`);
    }
    if (
      row.identityIssuedDate &&
      row.birthDate &&
      row.identityIssuedDate < row.birthDate
    ) {
      errors.push(`${prefix}: ngày cấp phải >= ngày sinh`);
    }
    if (
      row.youthUnionAdmissionDate &&
      row.birthDate &&
      row.youthUnionAdmissionDate <= row.birthDate
    ) {
      errors.push(`${prefix}: ngày kết nạp Đoàn phải sau ngày sinh`);
    }
    if (
      row.partyAdmissionDate &&
      row.youthUnionAdmissionDate &&
      row.partyAdmissionDate <= row.youthUnionAdmissionDate
    ) {
      errors.push(`${prefix}: ngày kết nạp Đảng phải sau ngày kết nạp Đoàn`);
    }

    if (row.profileCode) {
      if (
        !row.profileCode.startsWith('DRAFT-') &&
        !/^HS-\d{5}$/.test(row.profileCode)
      ) {
        errors.push(`${prefix}: mã hồ sơ phải dạng HS-xxxxx hoặc DRAFT-ROW-n`);
      }
      if (profileCodes.has(row.profileCode)) {
        errors.push(`${prefix}: trùng mã hồ sơ ${row.profileCode}`);
      }
      profileCodes.add(row.profileCode);
    }
    if (phones.has(row.phone)) errors.push(`${prefix}: trùng SĐT ${row.phone}`);
    phones.add(row.phone);
    if (row.email) {
      if (emails.has(row.email)) {
        errors.push(`${prefix}: trùng email ${row.email}`);
      }
      emails.add(row.email);
    }
    if (row.identityNumber) {
      if (identities.has(row.identityNumber)) {
        errors.push(`${prefix}: trùng CCCD ${row.identityNumber}`);
      }
      identities.add(row.identityNumber);
    }
    if (row.id) employeeIds.add(row.id);
  });

  const knownCodes = new Set(
    snapshot.employees
      .map((row) => row.profileCode)
      .filter((code) => Boolean(code)),
  );

  const uniqueFamily = new Set<string>();
  snapshot.familyMembers.forEach((row, index) => {
    const prefix = `FamilyMembers dòng ${index + 2}`;
    if (!row.profileCode) {
      errors.push(`${prefix}: thiếu mã hồ sơ`);
    } else if (!knownCodes.has(row.profileCode)) {
      errors.push(
        `${prefix}: mã hồ sơ ${row.profileCode} không có trong sheet Employees`,
      );
    }
    if (!Object.values(FamilyRelationship).includes(row.relationship)) {
      errors.push(`${prefix}: quan hệ không hợp lệ`);
    }
    if (!row.fullName) errors.push(`${prefix}: thiếu họ tên`);
    if (
      [
        FamilyRelationship.FATHER,
        FamilyRelationship.MOTHER,
        FamilyRelationship.GUARDIAN,
      ].includes(row.relationship)
    ) {
      const key = `${row.profileCode}:${row.relationship}`;
      if (uniqueFamily.has(key)) {
        errors.push(
          `${prefix}: quan hệ ${row.relationship} chỉ được khai báo một lần`,
        );
      }
      uniqueFamily.add(key);
    }
  });

  const uniqueEducation = new Set<string>();
  snapshot.educationHistories.forEach((row, index) => {
    const prefix = `EducationHistories dòng ${index + 2}`;
    if (!row.profileCode || !knownCodes.has(row.profileCode)) {
      errors.push(`${prefix}: mã hồ sơ không hợp lệ`);
    }
    if (!MONTH_PATTERN.test(row.fromMonth) || !MONTH_PATTERN.test(row.toMonth)) {
      errors.push(`${prefix}: tháng phải dạng YYYY-MM`);
    } else if (row.fromMonth > row.toMonth) {
      errors.push(`${prefix}: từ tháng phải <= đến tháng`);
    }
    if (!Object.values(TrainingMode).includes(row.trainingMode)) {
      errors.push(`${prefix}: hệ đào tạo không hợp lệ`);
    }
    const key = `${row.profileCode}|${row.fromMonth}|${row.toMonth}|${row.institution}`;
    if (uniqueEducation.has(key)) {
      errors.push(`${prefix}: trùng thời gian và cơ sở đào tạo`);
    }
    uniqueEducation.add(key);
  });

  const uniqueWork = new Set<string>();
  snapshot.workHistories.forEach((row, index) => {
    const prefix = `WorkHistories dòng ${index + 2}`;
    if (!row.profileCode || !knownCodes.has(row.profileCode)) {
      errors.push(`${prefix}: mã hồ sơ không hợp lệ`);
    }
    if (!MONTH_PATTERN.test(row.fromMonth)) {
      errors.push(`${prefix}: từ tháng phải dạng YYYY-MM`);
    }
    if (row.toMonth && !MONTH_PATTERN.test(row.toMonth)) {
      errors.push(`${prefix}: đến tháng phải dạng YYYY-MM`);
    }
    if (row.toMonth && row.fromMonth > row.toMonth) {
      errors.push(`${prefix}: từ tháng phải <= đến tháng`);
    }
    if (!row.company) errors.push(`${prefix}: thiếu công ty`);
    if (!row.position) errors.push(`${prefix}: thiếu chức vụ`);
    const key = `${row.profileCode}|${row.fromMonth}|${row.toMonth ?? ''}|${row.company}`;
    if (uniqueWork.has(key)) {
      errors.push(`${prefix}: trùng thời gian và công ty`);
    }
    uniqueWork.add(key);
  });

  return errors;
}
