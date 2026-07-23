import type { PrismaClient } from '@prisma/client';
import { resolveLinkedUserId } from './snapshot.js';
import type {
  ApplySelection,
  DiffChangeItem,
  OrganizationSnapshot,
} from './types.js';

type PrismaLike = PrismaClient;

export async function applyOrganizationSelections(
  prisma: PrismaLike,
  current: OrganizationSnapshot,
  incoming: OrganizationSnapshot,
  changes: DiffChangeItem[],
  selections: ApplySelection[],
): Promise<{ created: number; updated: number; deleted: number; errors: string[] }> {
  const selectedKeys = new Set(selections.map((s) => s.selectionKey));
  const selected = changes.filter(
    (c) => selectedKeys.has(c.selectionKey) && c.kind !== 'unchanged',
  );

  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  let deleted = 0;

  const incomingOrg = incoming.organization;
  const organizationId = current.organization.id;
  const orgMemberById = new Map(incoming.organizationMembers.map((m) => [m.id, m]));
  const companyById = new Map(incoming.companies.map((c) => [c.id, c]));
  const companyMemberById = new Map(incoming.companyMembers.map((m) => [m.id, m]));
  const unitById = new Map(incoming.units.map((u) => [u.id, u]));
  const unitMemberById = new Map(incoming.unitMembers.map((m) => [m.id, m]));

  const toDelete = {
    unitMembers: selected.filter((c) => c.entityType === 'unit_member' && c.kind === 'missing_in_file'),
    units: selected.filter((c) => c.entityType === 'unit' && c.kind === 'missing_in_file'),
    companyMembers: selected.filter(
      (c) => c.entityType === 'company_member' && c.kind === 'missing_in_file',
    ),
    companies: selected.filter((c) => c.entityType === 'company' && c.kind === 'missing_in_file'),
    orgMembers: selected.filter(
      (c) => c.entityType === 'organization_member' && c.kind === 'missing_in_file',
    ),
  };

  const toUpsert = {
    organization: selected.find((c) => c.entityType === 'organization' && c.kind === 'changed'),
    orgMembers: selected.filter(
      (c) =>
        c.entityType === 'organization_member' && (c.kind === 'new' || c.kind === 'changed'),
    ),
    companies: selected.filter(
      (c) => c.entityType === 'company' && (c.kind === 'new' || c.kind === 'changed'),
    ),
    companyMembers: selected.filter(
      (c) =>
        c.entityType === 'company_member' && (c.kind === 'new' || c.kind === 'changed'),
    ),
    units: selected.filter(
      (c) => c.entityType === 'unit' && (c.kind === 'new' || c.kind === 'changed'),
    ),
    unitMembers: selected.filter(
      (c) => c.entityType === 'unit_member' && (c.kind === 'new' || c.kind === 'changed'),
    ),
  };

  await prisma.$transaction(async (tx) => {
    const unitDeleteOrdered = [...toDelete.units].sort((a, b) => {
      const depth = (id: string) =>
        current.units.find((u) => u.id === id)?.unitPath.split(' / ').length ?? 0;
      return depth(b.entityId) - depth(a.entityId);
    });

    const positionHolders: Array<{
      holderKind:
        | 'ORGANIZATION_REP'
        | 'COMPANY_REP'
        | 'UNIT_MANAGER'
        | 'UNIT_MEMBER'
        | 'ORGANIZATION_MEMBER'
        | 'COMPANY_MEMBER';
      holderId: string;
    }> = [];

    for (const item of toDelete.unitMembers) {
      positionHolders.push({ holderKind: 'UNIT_MEMBER', holderId: item.entityId });
    }

    for (const item of toDelete.orgMembers) {
      positionHolders.push({ holderKind: 'ORGANIZATION_MEMBER', holderId: item.entityId });
    }

    for (const item of toDelete.companyMembers) {
      positionHolders.push({ holderKind: 'COMPANY_MEMBER', holderId: item.entityId });
    }

    for (const item of unitDeleteOrdered) {
      positionHolders.push({ holderKind: 'UNIT_MANAGER', holderId: item.entityId });
      for (const member of current.unitMembers.filter((m) => m.unitId === item.entityId)) {
        positionHolders.push({ holderKind: 'UNIT_MEMBER', holderId: member.id });
      }
    }

    for (const item of toDelete.companies) {
      positionHolders.push({ holderKind: 'COMPANY_REP', holderId: item.entityId });
      // Thành viên công ty bị xoá theo cascade khi xoá công ty.
      for (const member of current.companyMembers.filter(
        (m) => m.companyId === item.entityId,
      )) {
        positionHolders.push({ holderKind: 'COMPANY_MEMBER', holderId: member.id });
      }
      const companyUnits = current.units.filter((u) => u.companyId === item.entityId);
      for (const unit of companyUnits) {
        positionHolders.push({ holderKind: 'UNIT_MANAGER', holderId: unit.id });
        for (const member of current.unitMembers.filter((m) => m.unitId === unit.id)) {
          positionHolders.push({ holderKind: 'UNIT_MEMBER', holderId: member.id });
        }
      }
    }

    if (positionHolders.length > 0) {
      await tx.positionPermission.deleteMany({
        where: {
          OR: positionHolders.map((h) => ({
            holderKind: h.holderKind,
            holderId: h.holderId,
          })),
        },
      });
    }

    for (const item of toDelete.unitMembers) {
      await tx.organizationUnitMember.deleteMany({ where: { id: item.entityId } });
      deleted += 1;
    }

    for (const item of unitDeleteOrdered) {
      await tx.organizationUnit.deleteMany({ where: { id: item.entityId } });
      deleted += 1;
    }

    for (const item of toDelete.companyMembers) {
      await tx.companyMember.deleteMany({ where: { id: item.entityId } });
      deleted += 1;
    }

    for (const item of toDelete.companies) {
      await tx.company.deleteMany({ where: { id: item.entityId } });
      deleted += 1;
    }

    for (const item of toDelete.orgMembers) {
      await tx.organizationMember.deleteMany({ where: { id: item.entityId } });
      deleted += 1;
    }

    if (toUpsert.organization) {
      const linkedProfileUserId = await resolveLinkedUserId(
        tx as unknown as PrismaLike,
        incomingOrg.linkedProfile,
        errors,
        `Tổ chức ${incomingOrg.name}`,
      );
      await tx.organization.update({
        where: { id: organizationId },
        data: {
          name: incomingOrg.name,
          representativeName: incomingOrg.representativeName,
          additionalInfo: incomingOrg.additionalInfo,
          linkedProfileUserId,
        },
      });
      updated += 1;
    }

    for (const item of toUpsert.orgMembers) {
      const row = orgMemberById.get(item.entityId);
      if (!row) continue;
      await tx.organizationMember.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          organizationId,
          position: row.position,
          memberName: row.memberName,
          phone: row.phone,
          email: row.email,
          additionalInfo: row.additionalInfo,
          sortOrder: row.sortOrder,
        },
        update: {
          position: row.position,
          memberName: row.memberName,
          phone: row.phone,
          email: row.email,
          additionalInfo: row.additionalInfo,
          sortOrder: row.sortOrder,
        },
      });
      if (item.kind === 'new') created += 1;
      else updated += 1;
    }

    for (const item of toUpsert.companies) {
      const row = companyById.get(item.entityId);
      if (!row) continue;
      const linkedProfileUserId = await resolveLinkedUserId(
        tx as unknown as PrismaLike,
        row.linkedProfile,
        errors,
        `Công ty ${row.name}`,
      );
      await tx.company.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          organizationId,
          name: row.name,
          taxId: row.taxId,
          address: row.address,
          representativeName: row.representativeName,
          phone: row.phone,
          email: row.email,
          status: row.status,
          sortOrder: row.sortOrder,
          linkedProfileUserId,
        },
        update: {
          name: row.name,
          taxId: row.taxId,
          address: row.address,
          representativeName: row.representativeName,
          phone: row.phone,
          email: row.email,
          status: row.status,
          sortOrder: row.sortOrder,
          linkedProfileUserId,
        },
      });
      if (item.kind === 'new') created += 1;
      else updated += 1;
    }

    // Units: parents before children
    const unitUpserts = [...toUpsert.units].sort((a, b) => {
      const depth = (id: string) =>
        unitById.get(id)?.unitPath.split(' / ').length ?? 0;
      return depth(a.entityId) - depth(b.entityId);
    });

    for (const item of unitUpserts) {
      const row = unitById.get(item.entityId);
      if (!row) continue;
      const linkedProfileUserId = await resolveLinkedUserId(
        tx as unknown as PrismaLike,
        row.linkedProfile,
        errors,
        `Đơn vị ${row.name}`,
      );
      await tx.organizationUnit.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          companyId: row.companyId,
          parentUnitId: row.parentUnitId,
          name: row.name,
          managerName: row.managerName,
          status: row.status,
          additionalInfo: row.additionalInfo,
          sortOrder: row.sortOrder,
          linkedProfileUserId,
        },
        update: {
          companyId: row.companyId,
          parentUnitId: row.parentUnitId,
          name: row.name,
          managerName: row.managerName,
          status: row.status,
          additionalInfo: row.additionalInfo,
          sortOrder: row.sortOrder,
          linkedProfileUserId,
        },
      });
      if (item.kind === 'new') created += 1;
      else updated += 1;
    }

    for (const item of toUpsert.companyMembers) {
      const row = companyMemberById.get(item.entityId);
      if (!row) continue;
      const linkedProfileUserId = await resolveLinkedUserId(
        tx as unknown as PrismaLike,
        row.linkedProfile,
        errors,
        `Thành viên công ty ${row.memberName}`,
      );
      await tx.companyMember.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          companyId: row.companyId,
          position: row.position,
          memberName: row.memberName,
          phone: row.phone,
          email: row.email,
          additionalInfo: row.additionalInfo,
          sortOrder: row.sortOrder,
          linkedProfileUserId,
        },
        update: {
          companyId: row.companyId,
          position: row.position,
          memberName: row.memberName,
          phone: row.phone,
          email: row.email,
          additionalInfo: row.additionalInfo,
          sortOrder: row.sortOrder,
          linkedProfileUserId,
        },
      });
      if (item.kind === 'new') created += 1;
      else updated += 1;
    }

    for (const item of toUpsert.unitMembers) {
      const row = unitMemberById.get(item.entityId);
      if (!row) continue;
      const linkedProfileUserId = await resolveLinkedUserId(
        tx as unknown as PrismaLike,
        row.linkedProfile,
        errors,
        `Nhân viên ${row.memberName}`,
      );
      await tx.organizationUnitMember.upsert({
        where: { id: row.id },
        create: {
          id: row.id,
          unitId: row.unitId,
          position: row.position,
          memberName: row.memberName,
          phone: row.phone,
          email: row.email,
          additionalInfo: row.additionalInfo,
          sortOrder: row.sortOrder,
          linkedProfileUserId,
        },
        update: {
          unitId: row.unitId,
          position: row.position,
          memberName: row.memberName,
          phone: row.phone,
          email: row.email,
          additionalInfo: row.additionalInfo,
          sortOrder: row.sortOrder,
          linkedProfileUserId,
        },
      });
      if (item.kind === 'new') created += 1;
      else updated += 1;
    }
  });

  return { created, updated, deleted, errors };
}
