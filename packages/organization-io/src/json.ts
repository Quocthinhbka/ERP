import {
  ORGANIZATION_IO_VERSION,
  type OrganizationSnapshot,
} from './types.js';

export function serializeOrganizationSnapshot(
  snapshot: OrganizationSnapshot,
): string {
  return JSON.stringify(snapshot, null, 2);
}

export function parseOrganizationSnapshotJson(
  raw: string | Buffer,
): OrganizationSnapshot {
  let parsed: unknown;
  try {
    parsed = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
  } catch {
    throw new Error('File JSON không hợp lệ');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Snapshot JSON không hợp lệ');
  }

  const snapshot = parsed as Partial<OrganizationSnapshot>;
  if (snapshot.version !== ORGANIZATION_IO_VERSION) {
    throw new Error(
      `Phiên bản snapshot không hỗ trợ (cần ${ORGANIZATION_IO_VERSION})`,
    );
  }
  if (!snapshot.organization || typeof snapshot.organization !== 'object') {
    throw new Error('Thiếu thông tin organization trong JSON');
  }
  if (!Array.isArray(snapshot.companies) || !Array.isArray(snapshot.units)) {
    throw new Error('Thiếu danh sách companies/units trong JSON');
  }
  if (
    !Array.isArray(snapshot.organizationMembers) ||
    !Array.isArray(snapshot.companyMembers) ||
    !Array.isArray(snapshot.unitMembers)
  ) {
    throw new Error('Thiếu danh sách members trong JSON');
  }

  return {
    version: ORGANIZATION_IO_VERSION,
    exportedAt:
      typeof snapshot.exportedAt === 'string'
        ? snapshot.exportedAt
        : new Date().toISOString(),
    organization: snapshot.organization,
    organizationMembers: snapshot.organizationMembers,
    companies: snapshot.companies,
    companyMembers: snapshot.companyMembers,
    units: snapshot.units,
    unitMembers: snapshot.unitMembers,
  };
}

export function detectOrganizationImportFormat(
  fileName: string,
): 'excel' | 'json' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.xlsx')) return 'excel';
  throw new Error('Chỉ hỗ trợ file .xlsx hoặc .json');
}
