import type { Prisma, PrismaClient } from '@prisma/client';
import { EmployeeWorkPresenceStatus } from '@erp/shared';
import type {
  ApplySelection,
  DiffChangeItem,
  EmployeeSnapshot,
  EmployeeSnapshotRow,
} from './types.js';

type TxClient = Prisma.TransactionClient;

function toDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function toMonthDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(`${value}-01T00:00:00.000Z`);
}

/** Chuỗi rỗng / chỉ khoảng trắng → null (tránh Prisma enum ""). */
function emptyToNull<T>(value: T | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

async function allocateProfileCode(tx: TxClient) {
  while (true) {
    const [row] = await tx.$queryRaw<Array<{ seq: bigint }>>`
      SELECT nextval('employee_profile_code_seq') AS seq
    `;
    const suffix = row.seq.toString().padStart(5, '0');
    const matchingAccount = await tx.user.findUnique({
      where: { accountCode: `TK-${suffix}` },
      select: { id: true },
    });
    if (!matchingAccount) {
      return `HS-${suffix}`;
    }
  }
}

function employeeCreateData(
  row: EmployeeSnapshotRow,
  profileCode: string,
  managingCompanyId: string,
): Prisma.EmployeeProfileCreateInput {
  return {
    profileCode,
    fullName: row.fullName,
    gender: emptyToNull(row.gender),
    birthDate: toDate(row.birthDate),
    birthPlace: emptyToNull(row.birthPlace),
    placeOfOrigin: emptyToNull(row.placeOfOrigin),
    permanentAddress: emptyToNull(row.permanentAddress),
    currentAddress: emptyToNull(row.currentAddress),
    phone: row.phone,
    email: emptyToNull(row.email),
    ethnicity: emptyToNull(row.ethnicity),
    religion: emptyToNull(row.religion),
    identityNumber: emptyToNull(row.identityNumber),
    identityIssuedDate: toDate(row.identityIssuedDate),
    identityIssuedPlace: emptyToNull(row.identityIssuedPlace),
    educationLevel: emptyToNull(row.educationLevel),
    youthUnionAdmissionDate: toDate(row.youthUnionAdmissionDate),
    youthUnionAdmissionPlace: emptyToNull(row.youthUnionAdmissionPlace),
    partyAdmissionDate: toDate(row.partyAdmissionDate),
    partyAdmissionPlace: emptyToNull(row.partyAdmissionPlace),
    rewardDiscipline: emptyToNull(row.rewardDiscipline),
    strengths: emptyToNull(row.strengths),
    status: row.status,
    employmentStatus: emptyToNull(row.employmentStatus),
    workPresenceStatus:
      emptyToNull(row.workPresenceStatus) ?? EmployeeWorkPresenceStatus.UNKNOWN,
    managingCompany: { connect: { id: managingCompanyId } },
  };
}

function employeeUpdateData(
  row: EmployeeSnapshotRow,
  managingCompanyId: string,
): Prisma.EmployeeProfileUpdateInput {
  return {
    fullName: row.fullName,
    gender: emptyToNull(row.gender),
    birthDate: toDate(row.birthDate),
    birthPlace: emptyToNull(row.birthPlace),
    placeOfOrigin: emptyToNull(row.placeOfOrigin),
    permanentAddress: emptyToNull(row.permanentAddress),
    currentAddress: emptyToNull(row.currentAddress),
    phone: row.phone,
    email: emptyToNull(row.email),
    ethnicity: emptyToNull(row.ethnicity),
    religion: emptyToNull(row.religion),
    identityNumber: emptyToNull(row.identityNumber),
    identityIssuedDate: toDate(row.identityIssuedDate),
    identityIssuedPlace: emptyToNull(row.identityIssuedPlace),
    educationLevel: emptyToNull(row.educationLevel),
    youthUnionAdmissionDate: toDate(row.youthUnionAdmissionDate),
    youthUnionAdmissionPlace: emptyToNull(row.youthUnionAdmissionPlace),
    partyAdmissionDate: toDate(row.partyAdmissionDate),
    partyAdmissionPlace: emptyToNull(row.partyAdmissionPlace),
    rewardDiscipline: emptyToNull(row.rewardDiscipline),
    strengths: emptyToNull(row.strengths),
    status: row.status,
    employmentStatus: emptyToNull(row.employmentStatus),
    workPresenceStatus:
      emptyToNull(row.workPresenceStatus) ?? EmployeeWorkPresenceStatus.UNKNOWN,
    managingCompany: { connect: { id: managingCompanyId } },
  };
}

function normalizeCompanyName(name: string) {
  return name.trim().toLocaleLowerCase('vi-VN');
}

function resolveManagingCompanyId(
  name: string,
  companies: Array<{ id: string; name: string }>,
): { id?: string; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { error: 'thiếu công ty chủ quản' };
  }
  const key = normalizeCompanyName(trimmed);
  const matches = companies.filter(
    (company) => normalizeCompanyName(company.name) === key,
  );
  if (matches.length === 0) {
    return {
      error: `không tìm thấy công ty đang hoạt động "${trimmed}"`,
    };
  }
  if (matches.length > 1) {
    return { error: `tên công ty "${trimmed}" bị trùng trên hệ thống` };
  }
  return { id: matches[0].id };
}

export async function applyEmployeeSelections(
  prisma: PrismaClient,
  _current: EmployeeSnapshot,
  incoming: EmployeeSnapshot,
  changes: DiffChangeItem[],
  selections: ApplySelection[],
): Promise<{ created: number; updated: number; deleted: number; errors: string[] }> {
  const selected = new Set(selections.map((item) => item.selectionKey));
  const actionable = changes.filter(
    (item) => item.selectable && selected.has(item.selectionKey),
  );

  // Không bao giờ áp dụng missing_in_file (xóa).
  const toApply = actionable.filter((item) => item.kind !== 'missing_in_file');
  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  const employeeByIncomingId = new Map(
    incoming.employees.map((row) => [row.id, row]),
  );
  const familyById = new Map(incoming.familyMembers.map((row) => [row.id, row]));
  const educationById = new Map(
    incoming.educationHistories.map((row) => [row.id, row]),
  );
  const workById = new Map(incoming.workHistories.map((row) => [row.id, row]));

  // Map profileCode mới được tạo trong transaction để sheet con tham chiếu.
  const createdCodeByIncomingId = new Map<string, string>();
  const resolvedProfileIdByCode = new Map<string, string>();

  await prisma.$transaction(async (tx) => {
    const companies = await tx.company.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    // 1) Hồ sơ trước
    for (const change of toApply.filter((item) => item.entityType === 'employee')) {
      if (change.kind === 'new') {
        const incomingRow =
          employeeByIncomingId.get(change.entityId) ??
          incoming.employees.find(
            (row) =>
              !row.profileCode &&
              row.fullName === change.incoming?.fullName &&
              row.phone === change.incoming?.phone,
          );
        if (!incomingRow) {
          errors.push(`Không tìm thấy dữ liệu hồ sơ mới: ${change.label}`);
          continue;
        }
        const company = resolveManagingCompanyId(
          incomingRow.managingCompanyName,
          companies,
        );
        if (!company.id) {
          errors.push(
            `Hồ sơ mới ${incomingRow.fullName}: ${company.error ?? 'công ty chủ quản không hợp lệ'}`,
          );
          continue;
        }
        const draftCode = incomingRow.profileCode;
        const profileCode = draftCode.startsWith('DRAFT-')
          ? await allocateProfileCode(tx)
          : draftCode || (await allocateProfileCode(tx));
        const createdProfile = await tx.employeeProfile.create({
          data: employeeCreateData(incomingRow, profileCode, company.id),
        });
        createdCodeByIncomingId.set(incomingRow.id, profileCode);
        if (draftCode) {
          resolvedProfileIdByCode.set(draftCode, createdProfile.id);
        }
        resolvedProfileIdByCode.set(profileCode, createdProfile.id);
        created += 1;
      } else if (change.kind === 'changed') {
        const incomingRow =
          employeeByIncomingId.get(change.entityId) ??
          incoming.employees.find((row) => row.id === change.entityId);
        if (!incomingRow) {
          errors.push(`Không tìm thấy dữ liệu hồ sơ cập nhật: ${change.label}`);
          continue;
        }
        const company = resolveManagingCompanyId(
          incomingRow.managingCompanyName,
          companies,
        );
        if (!company.id) {
          errors.push(
            `Hồ sơ ${incomingRow.profileCode || incomingRow.fullName}: ${company.error ?? 'công ty chủ quản không hợp lệ'}`,
          );
          continue;
        }
        await tx.employeeProfile.update({
          where: { id: change.entityId },
          data: employeeUpdateData(incomingRow, company.id),
        });
        resolvedProfileIdByCode.set(incomingRow.profileCode, change.entityId);
        updated += 1;
      }
    }

    // Nạp map profileCode -> id còn lại từ DB
    const allCodes = new Set<string>([
      ...incoming.familyMembers.map((row) => row.profileCode),
      ...incoming.educationHistories.map((row) => row.profileCode),
      ...incoming.workHistories.map((row) => row.profileCode),
      ...incoming.employees.map((row) => row.profileCode).filter(Boolean),
      ...createdCodeByIncomingId.values(),
    ]);
    if (allCodes.size > 0) {
      const profiles = await tx.employeeProfile.findMany({
        where: { profileCode: { in: [...allCodes] } },
        select: { id: true, profileCode: true },
      });
      for (const profile of profiles) {
        resolvedProfileIdByCode.set(profile.profileCode, profile.id);
      }
    }

    const resolveProfileId = (profileCode: string, incomingEmployeeId?: string) => {
      if (incomingEmployeeId && createdCodeByIncomingId.has(incomingEmployeeId)) {
        const code = createdCodeByIncomingId.get(incomingEmployeeId)!;
        return resolvedProfileIdByCode.get(code);
      }
      return resolvedProfileIdByCode.get(profileCode);
    };

    for (const change of toApply.filter((item) => item.entityType === 'family_member')) {
      const row = familyById.get(change.entityId);
      if (!row) {
        errors.push(`Không tìm thấy nhân thân: ${change.label}`);
        continue;
      }
      const profileId = resolveProfileId(row.profileCode);
      if (!profileId) {
        errors.push(`Không tìm thấy hồ sơ cha cho nhân thân ${row.fullName}`);
        continue;
      }
      if (change.kind === 'new' || change.entityId.startsWith('new:')) {
        await tx.employeeFamilyMember.create({
          data: {
            employeeProfileId: profileId,
            relationship: row.relationship,
            fullName: row.fullName,
            birthYear: row.birthYear ?? null,
            occupation: row.occupation ?? null,
            workplace: row.workplace ?? null,
            currentResidence: row.currentResidence ?? null,
            sortOrder: row.sortOrder,
          },
        });
        created += 1;
      } else if (change.kind === 'changed') {
        await tx.employeeFamilyMember.update({
          where: { id: change.entityId },
          data: {
            relationship: row.relationship,
            fullName: row.fullName,
            birthYear: row.birthYear ?? null,
            occupation: row.occupation ?? null,
            workplace: row.workplace ?? null,
            currentResidence: row.currentResidence ?? null,
            sortOrder: row.sortOrder,
          },
        });
        updated += 1;
      }
    }

    for (const change of toApply.filter(
      (item) => item.entityType === 'education_history',
    )) {
      const row = educationById.get(change.entityId);
      if (!row) {
        errors.push(`Không tìm thấy quá trình đào tạo: ${change.label}`);
        continue;
      }
      const profileId = resolveProfileId(row.profileCode);
      if (!profileId) {
        errors.push(`Không tìm thấy hồ sơ cha cho đào tạo ${row.institution}`);
        continue;
      }
      if (change.kind === 'new' || change.entityId.startsWith('new:')) {
        await tx.employeeEducationHistory.create({
          data: {
            employeeProfileId: profileId,
            fromMonth: toMonthDate(row.fromMonth)!,
            toMonth: toMonthDate(row.toMonth)!,
            institution: row.institution,
            major: row.major,
            trainingMode: row.trainingMode,
            degree: row.degree,
            sortOrder: row.sortOrder,
          },
        });
        created += 1;
      } else if (change.kind === 'changed') {
        await tx.employeeEducationHistory.update({
          where: { id: change.entityId },
          data: {
            fromMonth: toMonthDate(row.fromMonth)!,
            toMonth: toMonthDate(row.toMonth)!,
            institution: row.institution,
            major: row.major,
            trainingMode: row.trainingMode,
            degree: row.degree,
            sortOrder: row.sortOrder,
          },
        });
        updated += 1;
      }
    }

    for (const change of toApply.filter((item) => item.entityType === 'work_history')) {
      const row = workById.get(change.entityId);
      if (!row) {
        errors.push(`Không tìm thấy quá trình công tác: ${change.label}`);
        continue;
      }
      const profileId = resolveProfileId(row.profileCode);
      if (!profileId) {
        errors.push(`Không tìm thấy hồ sơ cha cho công tác ${row.company}`);
        continue;
      }
      if (change.kind === 'new' || change.entityId.startsWith('new:')) {
        await tx.employeeWorkHistory.create({
          data: {
            employeeProfileId: profileId,
            fromMonth: toMonthDate(row.fromMonth)!,
            toMonth: toMonthDate(row.toMonth),
            company: row.company,
            department: row.department ?? null,
            position: row.position,
            sortOrder: row.sortOrder,
          },
        });
        created += 1;
      } else if (change.kind === 'changed') {
        await tx.employeeWorkHistory.update({
          where: { id: change.entityId },
          data: {
            fromMonth: toMonthDate(row.fromMonth)!,
            toMonth: toMonthDate(row.toMonth),
            company: row.company,
            department: row.department ?? null,
            position: row.position,
            sortOrder: row.sortOrder,
          },
        });
        updated += 1;
      }
    }
  });

  return { created, updated, deleted: 0, errors };
}
