import type {
  DiffChangeItem,
  DiffEntityType,
  DiffFieldChange,
  EmployeeDiffResult,
  EmployeeSnapshot,
} from './types.js';
import {
  EDUCATION_COMPARE_FIELDS,
  EMPLOYEE_COMPARE_FIELDS,
  FAMILY_COMPARE_FIELDS,
  WORK_COMPARE_FIELDS,
} from './types.js';

function normalize(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function pickComparable(
  row: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    out[field] = row[field] ?? null;
  }
  return out;
}

function fieldDiffs(
  current: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown> | null | undefined,
  fields: readonly string[],
): DiffFieldChange[] {
  const diffs: DiffFieldChange[] = [];
  for (const field of fields) {
    const left = current?.[field] ?? null;
    const right = incoming?.[field] ?? null;
    if (normalize(left) !== normalize(right)) {
      diffs.push({ field, current: left, incoming: right });
    }
  }
  return diffs;
}

function compareById(
  entityType: DiffEntityType,
  currentRows: Array<Record<string, unknown> & { id: string }>,
  incomingRows: Array<Record<string, unknown> & { id: string }>,
  fields: readonly string[],
  labelOf: (row: Record<string, unknown>) => string,
  missingNote: (row: Record<string, unknown>) => string,
): DiffChangeItem[] {
  const currentMap = new Map(currentRows.map((row) => [row.id, row]));
  const incomingMap = new Map(incomingRows.map((row) => [row.id, row]));
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
        warning: missingNote(current),
        selectable: false,
        profileCode: String(current.profileCode ?? ''),
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
        selectable: true,
        profileCode: String(incoming.profileCode ?? ''),
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
        selectable: diffs.length > 0,
        profileCode: String(incoming.profileCode ?? current.profileCode ?? ''),
        current: pickComparable(current, fields),
        incoming: pickComparable(incoming, fields),
        fieldDiffs: diffs.length > 0 ? diffs : undefined,
      });
    }
  }

  return changes;
}

/**
 * So khớp hồ sơ theo profileCode (ưu tiên), fallback id.
 * Dòng mới không có profileCode dùng id tạm `new:...`.
 */
function matchEmployees(current: EmployeeSnapshot, incoming: EmployeeSnapshot) {
  const currentByCode = new Map(
    current.employees
      .filter((row) => row.profileCode)
      .map((row) => [row.profileCode, row]),
  );
  const currentById = new Map(current.employees.map((row) => [row.id, row]));

  const pairedIncoming: Array<Record<string, unknown> & { id: string }> = [];
  const pairedCurrent: Array<Record<string, unknown> & { id: string }> = [];
  const usedCurrentIds = new Set<string>();

  for (const row of incoming.employees) {
    const matched =
      (row.profileCode ? currentByCode.get(row.profileCode) : undefined) ??
      (!row.id.startsWith('new:') ? currentById.get(row.id) : undefined);

    if (matched) {
      usedCurrentIds.add(matched.id);
      pairedCurrent.push(matched as unknown as Record<string, unknown> & { id: string });
      pairedIncoming.push({
        ...(row as unknown as Record<string, unknown>),
        id: matched.id,
      } as Record<string, unknown> & { id: string });
    } else {
      pairedIncoming.push(row as unknown as Record<string, unknown> & { id: string });
    }
  }

  for (const row of current.employees) {
    if (!usedCurrentIds.has(row.id)) {
      pairedCurrent.push(row as unknown as Record<string, unknown> & { id: string });
    }
  }

  return { pairedCurrent, pairedIncoming };
}

export function diffEmployeeSnapshots(
  current: EmployeeSnapshot,
  incoming: EmployeeSnapshot,
): EmployeeDiffResult {
  const { pairedCurrent, pairedIncoming } = matchEmployees(current, incoming);

  const changes: DiffChangeItem[] = [
    ...compareById(
      'employee',
      pairedCurrent,
      pairedIncoming,
      EMPLOYEE_COMPARE_FIELDS,
      (row) => `Hồ sơ ${row.profileCode || '(mới)'}: ${row.fullName}`,
      (row) =>
        `Chỉ có trên hệ thống: hồ sơ ${row.profileCode}. Import không xóa dữ liệu này.`,
    ),
    ...compareById(
      'family_member',
      current.familyMembers as unknown as Array<Record<string, unknown> & { id: string }>,
      incoming.familyMembers as unknown as Array<Record<string, unknown> & { id: string }>,
      FAMILY_COMPARE_FIELDS,
      (row) => `Nhân thân ${row.profileCode}: ${row.relationship} — ${row.fullName}`,
      (row) =>
        `Chỉ có trên hệ thống: nhân thân ${row.fullName}. Import không xóa dữ liệu này.`,
    ),
    ...compareById(
      'education_history',
      current.educationHistories as unknown as Array<
        Record<string, unknown> & { id: string }
      >,
      incoming.educationHistories as unknown as Array<
        Record<string, unknown> & { id: string }
      >,
      EDUCATION_COMPARE_FIELDS,
      (row) =>
        `Đào tạo ${row.profileCode}: ${row.institution} (${row.fromMonth}→${row.toMonth})`,
      (row) =>
        `Chỉ có trên hệ thống: quá trình đào tạo ${row.institution}. Import không xóa.`,
    ),
    ...compareById(
      'work_history',
      current.workHistories as unknown as Array<Record<string, unknown> & { id: string }>,
      incoming.workHistories as unknown as Array<Record<string, unknown> & { id: string }>,
      WORK_COMPARE_FIELDS,
      (row) => `Công tác ${row.profileCode}: ${row.company} — ${row.position}`,
      (row) =>
        `Chỉ có trên hệ thống: quá trình công tác ${row.company}. Import không xóa.`,
    ),
  ];

  return {
    changes,
    errors: [],
    stats: {
      new: changes.filter((item) => item.kind === 'new').length,
      changed: changes.filter((item) => item.kind === 'changed').length,
      unchanged: changes.filter((item) => item.kind === 'unchanged').length,
      missingInFile: changes.filter((item) => item.kind === 'missing_in_file').length,
    },
  };
}
