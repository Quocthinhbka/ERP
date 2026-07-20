import ExcelJS from 'exceljs';
import { EntityStatus } from '@erp/shared';
import {
  ORG_IO_SHEETS,
  ORGANIZATION_IO_VERSION,
  type LinkedProfileRef,
  type OrganizationSnapshot,
} from './types.js';

function stringifyCell(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String((value as { text?: string }).text ?? '');
  }
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return String((value as { result?: unknown }).result ?? '');
  }
  return String(value);
}

function parseLinked(code: string, email: string, fullName: string): LinkedProfileRef | null {
  if (!code && !email && !fullName) return null;
  return {
    employeeCode: code || null,
    email: email || null,
    fullName: fullName || null,
  };
}

function addHeader(sheet: ExcelJS.Worksheet, headers: string[]) {
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
}

export async function writeOrganizationWorkbook(
  snapshot: OrganizationSnapshot,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ERP HyperLabs';
  workbook.created = new Date();

  const orgSheet = workbook.addWorksheet(ORG_IO_SHEETS.ORGANIZATION);
  addHeader(orgSheet, [
    'id',
    'name',
    'representativeName',
    'additionalInfo',
    'linkedEmployeeCode',
    'linkedEmail',
    'linkedFullName',
    'version',
    'exportedAt',
  ]);
  orgSheet.addRow([
    snapshot.organization.id,
    snapshot.organization.name,
    snapshot.organization.representativeName ?? '',
    snapshot.organization.additionalInfo ?? '',
    snapshot.organization.linkedProfile?.employeeCode ?? '',
    snapshot.organization.linkedProfile?.email ?? '',
    snapshot.organization.linkedProfile?.fullName ?? '',
    snapshot.version,
    snapshot.exportedAt,
  ]);

  const orgMembers = workbook.addWorksheet(ORG_IO_SHEETS.ORGANIZATION_MEMBERS);
  addHeader(orgMembers, [
    'id',
    'position',
    'memberName',
    'phone',
    'email',
    'additionalInfo',
    'sortOrder',
  ]);
  for (const m of snapshot.organizationMembers) {
    orgMembers.addRow([
      m.id,
      m.position,
      m.memberName,
      m.phone ?? '',
      m.email ?? '',
      m.additionalInfo ?? '',
      m.sortOrder,
    ]);
  }

  const companies = workbook.addWorksheet(ORG_IO_SHEETS.COMPANIES);
  addHeader(companies, [
    'id',
    'name',
    'taxId',
    'address',
    'representativeName',
    'phone',
    'email',
    'status',
    'sortOrder',
    'linkedEmployeeCode',
    'linkedEmail',
    'linkedFullName',
  ]);
  for (const c of snapshot.companies) {
    companies.addRow([
      c.id,
      c.name,
      c.taxId ?? '',
      c.address ?? '',
      c.representativeName ?? '',
      c.phone ?? '',
      c.email ?? '',
      c.status,
      c.sortOrder,
      c.linkedProfile?.employeeCode ?? '',
      c.linkedProfile?.email ?? '',
      c.linkedProfile?.fullName ?? '',
    ]);
  }

  const companyMembers = workbook.addWorksheet(ORG_IO_SHEETS.COMPANY_MEMBERS);
  addHeader(companyMembers, [
    'id',
    'companyId',
    'companyName',
    'position',
    'memberName',
    'phone',
    'email',
    'additionalInfo',
    'sortOrder',
    'linkedEmployeeCode',
    'linkedEmail',
    'linkedFullName',
  ]);
  for (const m of snapshot.companyMembers) {
    companyMembers.addRow([
      m.id,
      m.companyId,
      m.companyName,
      m.position,
      m.memberName,
      m.phone ?? '',
      m.email ?? '',
      m.additionalInfo ?? '',
      m.sortOrder,
      m.linkedProfile?.employeeCode ?? '',
      m.linkedProfile?.email ?? '',
      m.linkedProfile?.fullName ?? '',
    ]);
  }

  const units = workbook.addWorksheet(ORG_IO_SHEETS.UNITS);
  addHeader(units, [
    'id',
    'companyId',
    'companyName',
    'parentUnitId',
    'parentPath',
    'unitPath',
    'name',
    'managerName',
    'status',
    'additionalInfo',
    'sortOrder',
    'linkedEmployeeCode',
    'linkedEmail',
    'linkedFullName',
  ]);
  for (const u of snapshot.units) {
    units.addRow([
      u.id,
      u.companyId,
      u.companyName,
      u.parentUnitId ?? '',
      u.parentPath ?? '',
      u.unitPath,
      u.name,
      u.managerName ?? '',
      u.status,
      u.additionalInfo ?? '',
      u.sortOrder,
      u.linkedProfile?.employeeCode ?? '',
      u.linkedProfile?.email ?? '',
      u.linkedProfile?.fullName ?? '',
    ]);
  }

  const unitMembers = workbook.addWorksheet(ORG_IO_SHEETS.UNIT_MEMBERS);
  addHeader(unitMembers, [
    'id',
    'unitId',
    'unitPath',
    'companyName',
    'position',
    'memberName',
    'phone',
    'email',
    'additionalInfo',
    'sortOrder',
    'linkedEmployeeCode',
    'linkedEmail',
    'linkedFullName',
  ]);
  for (const m of snapshot.unitMembers) {
    unitMembers.addRow([
      m.id,
      m.unitId,
      m.unitPath,
      m.companyName,
      m.position,
      m.memberName,
      m.phone ?? '',
      m.email ?? '',
      m.additionalInfo ?? '',
      m.sortOrder,
      m.linkedProfile?.employeeCode ?? '',
      m.linkedProfile?.email ?? '',
      m.linkedProfile?.fullName ?? '',
    ]);
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

function rowValues(row: ExcelJS.Row): string[] {
  const values: string[] = [];
  row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    values[colNumber - 1] = stringifyCell(cell.value);
  });
  return values;
}

function sheetRows(workbook: ExcelJS.Workbook, name: string): string[][] {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    rows.push(rowValues(row));
  });
  return rows;
}

export async function readOrganizationWorkbook(
  buffer: Buffer,
): Promise<OrganizationSnapshot> {
  const workbook = new ExcelJS.Workbook();
  // exceljs typings expect Buffer-like input
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const orgRows = sheetRows(workbook, ORG_IO_SHEETS.ORGANIZATION);
  if (orgRows.length === 0) {
    throw new Error('Sheet Organization thiếu dữ liệu');
  }
  const org = orgRows[0];

  return {
    version: ORGANIZATION_IO_VERSION,
    exportedAt: org[8] || new Date().toISOString(),
    organization: {
      id: org[0],
      name: org[1],
      representativeName: org[2] || null,
      additionalInfo: org[3] || null,
      linkedProfile: parseLinked(org[4], org[5], org[6]),
    },
    organizationMembers: sheetRows(workbook, ORG_IO_SHEETS.ORGANIZATION_MEMBERS).map((r) => ({
      id: r[0],
      position: r[1],
      memberName: r[2],
      phone: r[3] || null,
      email: r[4] || null,
      additionalInfo: r[5] || null,
      sortOrder: Number(r[6] || 0),
    })),
    companies: sheetRows(workbook, ORG_IO_SHEETS.COMPANIES).map((r) => ({
      id: r[0],
      name: r[1],
      taxId: r[2] || null,
      address: r[3] || null,
      representativeName: r[4] || null,
      phone: r[5] || null,
      email: r[6] || null,
      status: (r[7] as EntityStatus) || EntityStatus.ACTIVE,
      sortOrder: Number(r[8] || 0),
      linkedProfile: parseLinked(r[9], r[10], r[11]),
    })),
    companyMembers: sheetRows(workbook, ORG_IO_SHEETS.COMPANY_MEMBERS).map((r) => ({
      id: r[0],
      companyId: r[1],
      companyName: r[2],
      position: r[3],
      memberName: r[4],
      phone: r[5] || null,
      email: r[6] || null,
      additionalInfo: r[7] || null,
      sortOrder: Number(r[8] || 0),
      linkedProfile: parseLinked(r[9], r[10], r[11]),
    })),
    units: sheetRows(workbook, ORG_IO_SHEETS.UNITS).map((r) => ({
      id: r[0],
      companyId: r[1],
      companyName: r[2],
      parentUnitId: r[3] || null,
      parentPath: r[4] || null,
      unitPath: r[5],
      name: r[6],
      managerName: r[7] || null,
      status: (r[8] as EntityStatus) || EntityStatus.ACTIVE,
      additionalInfo: r[9] || null,
      sortOrder: Number(r[10] || 0),
      linkedProfile: parseLinked(r[11], r[12], r[13]),
    })),
    unitMembers: sheetRows(workbook, ORG_IO_SHEETS.UNIT_MEMBERS).map((r) => ({
      id: r[0],
      unitId: r[1],
      unitPath: r[2],
      companyName: r[3],
      position: r[4],
      memberName: r[5],
      phone: r[6] || null,
      email: r[7] || null,
      additionalInfo: r[8] || null,
      sortOrder: Number(r[9] || 0),
      linkedProfile: parseLinked(r[10], r[11], r[12]),
    })),
  };
}
