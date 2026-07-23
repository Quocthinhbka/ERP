import type { EmployeeProfileDetail } from './employee-types';

function dateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : undefined;
}

/** Map phản hồi API hồ sơ → giá trị form chỉnh sửa (không spread object lồng nhau). */
export function profileToFormValues(
  profile: EmployeeProfileDetail,
): Record<string, unknown> {
  return {
    fullName: profile.fullName,
    gender: profile.gender ?? undefined,
    birthDate: dateInputValue(profile.birthDate),
    birthPlace: profile.birthPlace ?? undefined,
    placeOfOrigin: profile.placeOfOrigin ?? undefined,
    permanentAddress: profile.permanentAddress ?? undefined,
    currentAddress: profile.currentAddress ?? undefined,
    phone: profile.phone,
    email: profile.email ?? undefined,
    ethnicity: profile.ethnicity ?? undefined,
    religion: profile.religion ?? undefined,
    identityNumber: profile.identityNumber ?? undefined,
    identityIssuedDate: dateInputValue(profile.identityIssuedDate),
    identityIssuedPlace: profile.identityIssuedPlace ?? undefined,
    educationLevel: profile.educationLevel ?? undefined,
    youthUnionAdmissionDate: dateInputValue(profile.youthUnionAdmissionDate),
    youthUnionAdmissionPlace: profile.youthUnionAdmissionPlace ?? undefined,
    partyAdmissionDate: dateInputValue(profile.partyAdmissionDate),
    partyAdmissionPlace: profile.partyAdmissionPlace ?? undefined,
    rewardDiscipline: profile.rewardDiscipline ?? undefined,
    strengths: profile.strengths ?? undefined,
    employmentStatus: profile.employmentStatus ?? undefined,
    workPresenceStatus: profile.workPresenceStatus ?? 'UNKNOWN',
    managingCompanyId: profile.managingCompanyId ?? undefined,
    customValues: profile.customValues ?? {},
  };
}
