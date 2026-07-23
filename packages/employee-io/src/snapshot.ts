import type { PrismaClient } from '@prisma/client';
import type {
  EducationHistorySnapshotRow,
  EmployeeSnapshot,
  EmployeeSnapshotRow,
  FamilyMemberSnapshotRow,
  WorkHistorySnapshotRow,
} from './types.js';
import { EMPLOYEE_IO_VERSION } from './types.js';

function toDateString(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function toMonthString(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 7);
}

export async function loadEmployeeSnapshot(
  prisma: PrismaClient,
): Promise<EmployeeSnapshot> {
  const profiles = await prisma.employeeProfile.findMany({
    orderBy: { profileCode: 'asc' },
    include: {
      linkedUser: { select: { accountCode: true } },
      managingCompany: { select: { name: true } },
      familyMembers: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      educationHistories: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      workHistories: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
    },
  });

  const employees: EmployeeSnapshotRow[] = [];
  const familyMembers: FamilyMemberSnapshotRow[] = [];
  const educationHistories: EducationHistorySnapshotRow[] = [];
  const workHistories: WorkHistorySnapshotRow[] = [];

  for (const profile of profiles) {
    employees.push({
      id: profile.id,
      profileCode: profile.profileCode,
      fullName: profile.fullName,
      gender: profile.gender as EmployeeSnapshotRow['gender'],
      birthDate: toDateString(profile.birthDate),
      birthPlace: profile.birthPlace,
      placeOfOrigin: profile.placeOfOrigin,
      permanentAddress: profile.permanentAddress,
      currentAddress: profile.currentAddress,
      phone: profile.phone,
      email: profile.email,
      ethnicity: profile.ethnicity,
      religion: profile.religion as EmployeeSnapshotRow['religion'],
      identityNumber: profile.identityNumber,
      identityIssuedDate: toDateString(profile.identityIssuedDate),
      identityIssuedPlace: profile.identityIssuedPlace,
      educationLevel: profile.educationLevel as EmployeeSnapshotRow['educationLevel'],
      youthUnionAdmissionDate: toDateString(profile.youthUnionAdmissionDate),
      youthUnionAdmissionPlace: profile.youthUnionAdmissionPlace,
      partyAdmissionDate: toDateString(profile.partyAdmissionDate),
      partyAdmissionPlace: profile.partyAdmissionPlace,
      rewardDiscipline: profile.rewardDiscipline,
      strengths: profile.strengths,
      status: profile.status as EmployeeSnapshotRow['status'],
      employmentStatus:
        profile.employmentStatus as EmployeeSnapshotRow['employmentStatus'],
      workPresenceStatus:
        profile.workPresenceStatus as EmployeeSnapshotRow['workPresenceStatus'],
      managingCompanyName: profile.managingCompany?.name ?? '',
      linkedAccountCode: profile.linkedUser?.accountCode ?? null,
    });

    for (const member of profile.familyMembers) {
      familyMembers.push({
        id: member.id,
        profileCode: profile.profileCode,
        relationship: member.relationship as FamilyMemberSnapshotRow['relationship'],
        fullName: member.fullName,
        birthYear: member.birthYear,
        occupation: member.occupation,
        workplace: member.workplace,
        currentResidence: member.currentResidence,
        sortOrder: member.sortOrder,
      });
    }

    for (const education of profile.educationHistories) {
      educationHistories.push({
        id: education.id,
        profileCode: profile.profileCode,
        fromMonth: toMonthString(education.fromMonth)!,
        toMonth: toMonthString(education.toMonth)!,
        institution: education.institution,
        major: education.major,
        trainingMode: education.trainingMode as EducationHistorySnapshotRow['trainingMode'],
        degree: education.degree,
        sortOrder: education.sortOrder,
      });
    }

    for (const work of profile.workHistories) {
      workHistories.push({
        id: work.id,
        profileCode: profile.profileCode,
        fromMonth: toMonthString(work.fromMonth)!,
        toMonth: toMonthString(work.toMonth),
        company: work.company,
        department: work.department,
        position: work.position,
        sortOrder: work.sortOrder,
      });
    }
  }

  return {
    version: EMPLOYEE_IO_VERSION,
    exportedAt: new Date().toISOString(),
    employees,
    familyMembers,
    educationHistories,
    workHistories,
  };
}
