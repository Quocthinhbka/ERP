import type { PrismaClient } from '@prisma/client';
import { EntityStatus } from '@erp/shared';
import {
  ORGANIZATION_IO_VERSION,
  type CompanyMemberSnapshotRow,
  type CompanySnapshotRow,
  type LinkedProfileRef,
  type OrganizationMemberSnapshotRow,
  type OrganizationSnapshot,
  type OrganizationSnapshotRow,
  type UnitMemberSnapshotRow,
  type UnitSnapshotRow,
} from './types.js';

type PrismaLike = PrismaClient;

function toLinkedProfile(user: {
  employeeCode: string | null;
  email: string;
  fullName: string;
} | null): LinkedProfileRef | null {
  if (!user) return null;
  return {
    employeeCode: user.employeeCode,
    email: user.email,
    fullName: user.fullName,
  };
}

function buildUnitPath(
  unitId: string,
  byId: Map<string, { id: string; name: string; parentUnitId: string | null }>,
): string {
  const parts: string[] = [];
  let current: string | null = unitId;
  const guard = new Set<string>();
  while (current && !guard.has(current)) {
    guard.add(current);
    const unit = byId.get(current);
    if (!unit) break;
    parts.unshift(unit.name);
    current = unit.parentUnitId;
  }
  return parts.join(' / ');
}

export async function loadOrganizationSnapshot(
  prisma: PrismaLike,
): Promise<OrganizationSnapshot> {
  const org = await prisma.organization.findFirst({
    include: {
      linkedProfileUser: { select: { employeeCode: true, email: true, fullName: true } },
      members: { orderBy: { sortOrder: 'asc' } },
      companies: {
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          linkedProfileUser: { select: { employeeCode: true, email: true, fullName: true } },
          members: {
            orderBy: { sortOrder: 'asc' },
            include: {
              linkedProfileUser: { select: { employeeCode: true, email: true, fullName: true } },
            },
          },
          units: {
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
            include: {
              linkedProfileUser: { select: { employeeCode: true, email: true, fullName: true } },
              members: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  linkedProfileUser: {
                    select: { employeeCode: true, email: true, fullName: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!org) {
    throw new Error('Organization not found');
  }

  const organization: OrganizationSnapshotRow = {
    id: org.id,
    name: org.name,
    representativeName: org.representativeName,
    additionalInfo: org.additionalInfo,
    linkedProfile: toLinkedProfile(org.linkedProfileUser),
  };

  const organizationMembers: OrganizationMemberSnapshotRow[] = org.members.map((m) => ({
    id: m.id,
    position: m.position,
    memberName: m.memberName,
    phone: m.phone,
    email: m.email,
    additionalInfo: m.additionalInfo,
    sortOrder: m.sortOrder,
  }));

  const companies: CompanySnapshotRow[] = [];
  const companyMembers: CompanyMemberSnapshotRow[] = [];
  const units: UnitSnapshotRow[] = [];
  const unitMembers: UnitMemberSnapshotRow[] = [];

  for (const company of org.companies) {
    companies.push({
      id: company.id,
      name: company.name,
      taxId: company.taxId,
      address: company.address,
      representativeName: company.representativeName,
      phone: company.phone,
      email: company.email,
      status: company.status as EntityStatus,
      sortOrder: company.sortOrder,
      linkedProfile: toLinkedProfile(company.linkedProfileUser),
    });

    for (const member of company.members) {
      companyMembers.push({
        id: member.id,
        companyId: company.id,
        companyName: company.name,
        position: member.position,
        memberName: member.memberName,
        phone: member.phone,
        email: member.email,
        additionalInfo: member.additionalInfo,
        sortOrder: member.sortOrder,
        linkedProfile: toLinkedProfile(member.linkedProfileUser),
      });
    }

    const unitById = new Map(
      company.units.map((u) => [
        u.id,
        { id: u.id, name: u.name, parentUnitId: u.parentUnitId },
      ]),
    );

    for (const unit of company.units) {
      const unitPath = buildUnitPath(unit.id, unitById);
      const parentPath = unit.parentUnitId
        ? buildUnitPath(unit.parentUnitId, unitById)
        : null;

      units.push({
        id: unit.id,
        companyId: company.id,
        companyName: company.name,
        parentUnitId: unit.parentUnitId,
        parentPath,
        unitPath,
        name: unit.name,
        managerName: unit.managerName,
        status: unit.status as EntityStatus,
        additionalInfo: unit.additionalInfo,
        sortOrder: unit.sortOrder,
        linkedProfile: toLinkedProfile(unit.linkedProfileUser),
      });

      for (const member of unit.members) {
        unitMembers.push({
          id: member.id,
          unitId: unit.id,
          unitPath,
          companyName: company.name,
          position: member.position,
          memberName: member.memberName,
          phone: member.phone,
          email: member.email,
          additionalInfo: member.additionalInfo,
          sortOrder: member.sortOrder,
          linkedProfile: toLinkedProfile(member.linkedProfileUser),
        });
      }
    }
  }

  return {
    version: ORGANIZATION_IO_VERSION,
    exportedAt: new Date().toISOString(),
    organization,
    organizationMembers,
    companies,
    companyMembers,
    units,
    unitMembers,
  };
}

export async function resolveLinkedUserId(
  prisma: PrismaLike,
  linked: LinkedProfileRef | null | undefined,
  errors: string[],
  context: string,
): Promise<string | null> {
  if (!linked) return null;
  const code = linked.employeeCode?.trim();
  const email = linked.email?.trim()?.toLowerCase();

  if (code) {
    const byCode = await prisma.user.findUnique({ where: { employeeCode: code } });
    if (byCode) return byCode.id;
  }
  if (email) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) return byEmail.id;
  }

  errors.push(
    `${context}: không tìm thấy hồ sơ liên kết` +
      (code ? ` (mã NV: ${code})` : '') +
      (email ? ` (email: ${email})` : ''),
  );
  return null;
}
