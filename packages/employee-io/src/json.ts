import {
  EMPLOYEE_IO_VERSION,
  type EmployeeIoFormat,
  type EmployeeSnapshot,
} from './types.js';
import { normalizeEmployeeSnapshot, validateEmployeeSnapshot } from './validate.js';

export function serializeEmployeeSnapshot(snapshot: EmployeeSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export function parseEmployeeSnapshotJson(
  raw: string | Buffer,
): EmployeeSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
  } catch {
    throw new Error('File JSON không hợp lệ');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Snapshot JSON không hợp lệ');
  }

  const snapshot = parsed as Partial<EmployeeSnapshot>;
  if (snapshot.version !== EMPLOYEE_IO_VERSION) {
    throw new Error(
      `Phiên bản snapshot không hỗ trợ (cần ${EMPLOYEE_IO_VERSION})`,
    );
  }
  if (!Array.isArray(snapshot.employees)) {
    throw new Error('Thiếu danh sách employees trong JSON');
  }
  if (!Array.isArray(snapshot.familyMembers)) {
    throw new Error('Thiếu danh sách familyMembers trong JSON');
  }
  if (!Array.isArray(snapshot.educationHistories)) {
    throw new Error('Thiếu danh sách educationHistories trong JSON');
  }
  if (!Array.isArray(snapshot.workHistories)) {
    throw new Error('Thiếu danh sách workHistories trong JSON');
  }

  const normalized = normalizeEmployeeSnapshot({
    version: EMPLOYEE_IO_VERSION,
    exportedAt:
      typeof snapshot.exportedAt === 'string'
        ? snapshot.exportedAt
        : new Date().toISOString(),
    employees: snapshot.employees,
    familyMembers: snapshot.familyMembers,
    educationHistories: snapshot.educationHistories,
    workHistories: snapshot.workHistories,
  });

  const errors = validateEmployeeSnapshot(normalized);
  if (errors.length > 0) {
    throw new Error(errors.slice(0, 20).join('; '));
  }

  return normalized;
}

export function detectEmployeeImportFormat(fileName: string): EmployeeIoFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.xlsx')) return 'excel';
  throw new Error('Chỉ hỗ trợ file .xlsx hoặc .json');
}
