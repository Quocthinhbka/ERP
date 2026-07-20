import type {
  DiffChangeItem,
  DiffEntityType,
  DiffFieldChange,
  OrganizationDiffResult,
  OrganizationSnapshot,
} from './types.js';

function normalize(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function linkedKey(linked: unknown): string {
  if (!linked || typeof linked !== 'object') return '';
  const ref = linked as Record<string, unknown>;
  return [ref.employeeCode ?? '', ref.email ?? '', ref.fullName ?? ''].join('|');
}

function pickComparable(row: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    out[field] = row[field] ?? null;
  }
  return out;
}

function fieldDiffs(
  current: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null | undefined,
  fields: string[],
): DiffFieldChange[] {
  const diffs: DiffFieldChange[] = [];
  for (const field of fields) {
    const left = current?.[field] ?? null;
    const right = incoming?.[field] ?? null;
    const leftNorm = field === 'linkedProfile' ? linkedKey(left) : normalize(left);
    const rightNorm = field === 'linkedProfile' ? linkedKey(right) : normalize(right);
    if (leftNorm !== rightNorm) {
      diffs.push({ field, current: left, incoming: right });
    }
  }
  return diffs;
}

function compareCollection(
  entityType: DiffEntityType,
  currentRows: Array<Record<string, unknown> & { id: string }>,
  incomingRows: Array<Record<string, unknown> & { id: string }>,
  fields: string[],
  labelOf: (row: Record<string, unknown>) => string,
  missingWarning: (row: Record<string, unknown>) => string,
): DiffChangeItem[] {
  const currentMap = new Map(currentRows.map((r) => [r.id, r]));
  const incomingMap = new Map(incomingRows.map((r) => [r.id, r]));
  const ids = new Set([...currentMap.keys(), ...incomingMap.keys()]);
  const changes: DiffChangeItem[] = [];

  for (const id of ids) {
    const current = currentMap.get(id);
    const incoming = incomingMap.get(id);
    const selectionKey = `${entityType}:${id}`;

    if (current && !incoming) {
      changes.push({
        selectionKey,
        entityType,
        entityId: id,
        kind: 'missing_in_file',
        label: labelOf(current),
        warning: missingWarning(current),
        current: pickComparable(current, fields),
        incoming: null,
      });
      continue;
    }

    if (!current && incoming) {
      changes.push({
        selectionKey,
        entityType,
        entityId: id,
        kind: 'new',
        label: labelOf(incoming),
        current: null,
        incoming: pickComparable(incoming, fields),
      });
      continue;
    }

    if (current && incoming) {
      const diffs = fieldDiffs(current, incoming, fields);
      changes.push({
        selectionKey,
        entityType,
        entityId: id,
        kind: diffs.length > 0 ? 'changed' : 'unchanged',
        label: labelOf(incoming),
        current: pickComparable(current, fields),
        incoming: pickComparable(incoming, fields),
        fieldDiffs: diffs.length > 0 ? diffs : undefined,
      });
    }
  }

  return changes;
}

export function diffOrganizationSnapshots(
  current: OrganizationSnapshot,
  incoming: OrganizationSnapshot,
): OrganizationDiffResult {
  const orgFields = ['name', 'representativeName', 'additionalInfo', 'linkedProfile'];
  const memberFields = [
    'position',
    'memberName',
    'phone',
    'email',
    'additionalInfo',
    'sortOrder',
    'linkedProfile',
  ];
  const orgMemberFields = [
    'position',
    'memberName',
    'phone',
    'email',
    'additionalInfo',
    'sortOrder',
  ];
  const companyFields = [
    'name',
    'taxId',
    'address',
    'representativeName',
    'phone',
    'email',
    'status',
    'sortOrder',
    'linkedProfile',
  ];
  const unitFields = [
    'companyId',
    'parentUnitId',
    'name',
    'managerName',
    'status',
    'additionalInfo',
    'sortOrder',
    'linkedProfile',
  ];

  const changes: DiffChangeItem[] = [];

  const orgDiffs = fieldDiffs(
    current.organization as unknown as Record<string, unknown>,
    incoming.organization as unknown as Record<string, unknown>,
    orgFields,
  );
  changes.push({
    selectionKey: `organization:${incoming.organization.id}`,
    entityType: 'organization',
    entityId: incoming.organization.id,
    kind: orgDiffs.length > 0 ? 'changed' : 'unchanged',
    label: `Tổ chức: ${incoming.organization.name}`,
    current: pickComparable(
      current.organization as unknown as Record<string, unknown>,
      orgFields,
    ),
    incoming: pickComparable(
      incoming.organization as unknown as Record<string, unknown>,
      orgFields,
    ),
    fieldDiffs: orgDiffs.length > 0 ? orgDiffs : undefined,
  });

  changes.push(
    ...compareCollection(
      'organization_member',
      current.organizationMembers as unknown as Array<Record<string, unknown> & { id: string }>,
      incoming.organizationMembers as unknown as Array<Record<string, unknown> & { id: string }>,
      orgMemberFields,
      (row) => `TV tổ chức: ${row.position} — ${row.memberName}`,
      (row) =>
        `Cảnh báo: thành viên tổ chức "${row.memberName}" không có trong file. Tích chọn sẽ XÓA dữ liệu này.`,
    ),
    ...compareCollection(
      'company',
      current.companies as unknown as Array<Record<string, unknown> & { id: string }>,
      incoming.companies as unknown as Array<Record<string, unknown> & { id: string }>,
      companyFields,
      (row) => `Công ty: ${row.name}`,
      (row) =>
        `Cảnh báo: công ty "${row.name}" không có trong file. Tích chọn sẽ XÓA dữ liệu này (kèm đơn vị/thành viên liên quan nếu còn).`,
    ),
    ...compareCollection(
      'company_member',
      current.companyMembers as unknown as Array<Record<string, unknown> & { id: string }>,
      incoming.companyMembers as unknown as Array<Record<string, unknown> & { id: string }>,
      [...memberFields, 'companyId'],
      (row) => `TV công ty (${row.companyName}): ${row.position} — ${row.memberName}`,
      (row) =>
        `Cảnh báo: thành viên công ty "${row.memberName}" không có trong file. Tích chọn sẽ XÓA dữ liệu này.`,
    ),
    ...compareCollection(
      'unit',
      current.units as unknown as Array<Record<string, unknown> & { id: string }>,
      incoming.units as unknown as Array<Record<string, unknown> & { id: string }>,
      unitFields,
      (row) => `Đơn vị: ${row.unitPath || row.name}`,
      (row) =>
        `Cảnh báo: đơn vị "${row.unitPath || row.name}" không có trong file. Tích chọn sẽ XÓA dữ liệu này.`,
    ),
    ...compareCollection(
      'unit_member',
      current.unitMembers as unknown as Array<Record<string, unknown> & { id: string }>,
      incoming.unitMembers as unknown as Array<Record<string, unknown> & { id: string }>,
      [...memberFields, 'unitId'],
      (row) => `NV đơn vị (${row.unitPath}): ${row.position} — ${row.memberName}`,
      (row) =>
        `Cảnh báo: nhân viên "${row.memberName}" không có trong file. Tích chọn sẽ XÓA dữ liệu này.`,
    ),
  );

  const stats = {
    new: changes.filter((c) => c.kind === 'new').length,
    changed: changes.filter((c) => c.kind === 'changed').length,
    unchanged: changes.filter((c) => c.kind === 'unchanged').length,
    missingInFile: changes.filter((c) => c.kind === 'missing_in_file').length,
  };

  return { changes, errors: [], stats };
}
