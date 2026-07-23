import ExcelJS from 'exceljs';
import {
  EducationLevel,
  EmployeeEmploymentStatus,
  EmployeeGender,
  EmployeeProfileStatus,
  EmployeeWorkPresenceStatus,
  FamilyRelationship,
  Religion,
  TrainingMode,
} from '@erp/shared';
import type { EmployeeSnapshot } from './types.js';
import { EMP_IO_SHEETS, EMPLOYEE_IO_VERSION } from './types.js';
import { normalizeEmployeeSnapshot, validateEmployeeSnapshot } from './validate.js';

function stringifyCell(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String((value as { text?: string }).text ?? '');
  }
  if (typeof value === 'object' && value !== null && 'result' in value) {
    return String((value as { result?: unknown }).result ?? '');
  }
  return String(value).trim();
}

function cellAt(row: ExcelJS.Row, index: number) {
  return stringifyCell(row.getCell(index).value);
}

function addHeader(sheet: ExcelJS.Worksheet, headers: string[]) {
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  for (let i = 1; i <= headers.length; i += 1) {
    sheet.getColumn(i).width = Math.max(14, headers[i - 1].length + 2);
  }
}

function forceTextColumns(sheet: ExcelJS.Worksheet, columns: number[]) {
  for (const col of columns) {
    sheet.getColumn(col).numFmt = '@';
  }
}

const EMPLOYEE_HEADERS = [
  'recordId',
  'profileCode',
  'fullName',
  'gender',
  'birthDate',
  'birthPlace',
  'placeOfOrigin',
  'permanentAddress',
  'currentAddress',
  'phone',
  'email',
  'ethnicity',
  'religion',
  'identityNumber',
  'identityIssuedDate',
  'identityIssuedPlace',
  'educationLevel',
  'youthUnionAdmissionDate',
  'youthUnionAdmissionPlace',
  'partyAdmissionDate',
  'partyAdmissionPlace',
  'rewardDiscipline',
  'strengths',
  'status',
  'employmentStatus',
  'managingCompanyName',
  'linkedAccountCode',
  'workPresenceStatus',
] as const;

const FAMILY_HEADERS = [
  'recordId',
  'profileCode',
  'relationship',
  'fullName',
  'birthYear',
  'occupation',
  'workplace',
  'currentResidence',
  'sortOrder',
] as const;

const EDUCATION_HEADERS = [
  'recordId',
  'profileCode',
  'fromMonth',
  'toMonth',
  'institution',
  'major',
  'trainingMode',
  'degree',
  'sortOrder',
] as const;

const WORK_HEADERS = [
  'recordId',
  'profileCode',
  'fromMonth',
  'toMonth',
  'company',
  'department',
  'position',
  'sortOrder',
] as const;

function assertHeaders(sheet: ExcelJS.Worksheet, expected: readonly string[]) {
  const header = sheet.getRow(1);
  for (let i = 0; i < expected.length; i += 1) {
    const actual = cellAt(header, i + 1);
    if (actual !== expected[i]) {
      throw new Error(
        `Sheet "${sheet.name}" sai header cột ${i + 1}: kỳ vọng "${expected[i]}", nhận "${actual}"`,
      );
    }
  }
}

function addDropdown(
  sheet: ExcelJS.Worksheet,
  column: number,
  formulae: string,
  rows = 500,
) {
  // ExcelJS dataValidation on range
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (sheet as any).dataValidations.add(
    `${sheet.getColumn(column).letter}2:${sheet.getColumn(column).letter}${rows}`,
    {
      type: 'list',
      allowBlank: true,
      formulae: [formulae],
      showErrorMessage: true,
      errorTitle: 'Giá trị không hợp lệ',
      error: 'Chọn giá trị trong danh sách',
    },
  );
}

export async function writeEmployeeWorkbook(
  snapshot: EmployeeSnapshot,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ERP HyperLabs';
  workbook.created = new Date();

  const guide = workbook.addWorksheet(EMP_IO_SHEETS.GUIDE);
  addHeader(guide, ['Muc', 'NoiDung']);
  guide.addRow(['version', String(EMPLOYEE_IO_VERSION)]);
  guide.addRow(['exportedAt', snapshot.exportedAt]);
  guide.addRow([
    'huongDan',
    'profileCode để trống khi thêm mới. recordId giữ nguyên khi cập nhật. MISSING_IN_FILE chỉ đối chiếu, không xóa qua import.',
  ]);
  guide.addRow(['gender', Object.values(EmployeeGender).join(', ')]);
  guide.addRow(['status', Object.values(EmployeeProfileStatus).join(', ')]);
  guide.addRow([
    'employmentStatus',
    Object.values(EmployeeEmploymentStatus).join(', '),
  ]);
  guide.addRow([
    'workPresenceStatus',
    Object.values(EmployeeWorkPresenceStatus).join(', '),
  ]);
  guide.addRow(['educationLevel', Object.values(EducationLevel).join(', ')]);
  guide.addRow(['religion', Object.values(Religion).join(', ')]);
  guide.addRow(['relationship', Object.values(FamilyRelationship).join(', ')]);
  guide.addRow(['trainingMode', Object.values(TrainingMode).join(', ')]);
  guide.addRow([
    'managingCompanyName',
    'Tên công ty chủ quản (bắt buộc, khớp đúng tên trên hệ thống)',
  ]);
  guide.addRow(['dateFormat', 'YYYY-MM-DD']);
  guide.addRow(['monthFormat', 'YYYY-MM']);

  const employees = workbook.addWorksheet(EMP_IO_SHEETS.EMPLOYEES);
  addHeader(employees, [...EMPLOYEE_HEADERS]);
  forceTextColumns(employees, [2, 10, 14]);
  for (const row of snapshot.employees) {
    employees.addRow([
      row.id,
      row.profileCode,
      row.fullName,
      row.gender,
      row.birthDate,
      row.birthPlace,
      row.placeOfOrigin,
      row.permanentAddress,
      row.currentAddress,
      row.phone,
      row.email,
      row.ethnicity,
      row.religion ?? '',
      row.identityNumber,
      row.identityIssuedDate,
      row.identityIssuedPlace,
      row.educationLevel,
      row.youthUnionAdmissionDate ?? '',
      row.youthUnionAdmissionPlace ?? '',
      row.partyAdmissionDate ?? '',
      row.partyAdmissionPlace ?? '',
      row.rewardDiscipline ?? '',
      row.strengths ?? '',
      row.status,
      row.employmentStatus ?? '',
      row.managingCompanyName,
      row.linkedAccountCode ?? '',
      row.workPresenceStatus ?? EmployeeWorkPresenceStatus.UNKNOWN,
    ]);
  }
  addDropdown(employees, 4, `"${Object.values(EmployeeGender).join(',')}"`);
  addDropdown(employees, 13, `"${Object.values(Religion).join(',')}"`);
  addDropdown(employees, 17, `"${Object.values(EducationLevel).join(',')}"`);
  addDropdown(employees, 24, `"${Object.values(EmployeeProfileStatus).join(',')}"`);
  addDropdown(
    employees,
    25,
    `"${Object.values(EmployeeEmploymentStatus).join(',')}"`,
  );

  const family = workbook.addWorksheet(EMP_IO_SHEETS.FAMILY_MEMBERS);
  addHeader(family, [...FAMILY_HEADERS]);
  forceTextColumns(family, [2]);
  for (const row of snapshot.familyMembers) {
    family.addRow([
      row.id,
      row.profileCode,
      row.relationship,
      row.fullName,
      row.birthYear ?? '',
      row.occupation ?? '',
      row.workplace ?? '',
      row.currentResidence ?? '',
      row.sortOrder,
    ]);
  }
  addDropdown(family, 3, `"${Object.values(FamilyRelationship).join(',')}"`);

  const education = workbook.addWorksheet(EMP_IO_SHEETS.EDUCATION_HISTORIES);
  addHeader(education, [...EDUCATION_HEADERS]);
  forceTextColumns(education, [2, 3, 4]);
  for (const row of snapshot.educationHistories) {
    education.addRow([
      row.id,
      row.profileCode,
      row.fromMonth,
      row.toMonth,
      row.institution,
      row.major,
      row.trainingMode,
      row.degree,
      row.sortOrder,
    ]);
  }
  addDropdown(education, 7, `"${Object.values(TrainingMode).join(',')}"`);

  const work = workbook.addWorksheet(EMP_IO_SHEETS.WORK_HISTORIES);
  addHeader(work, [...WORK_HEADERS]);
  forceTextColumns(work, [2, 3, 4]);
  for (const row of snapshot.workHistories) {
    work.addRow([
      row.id,
      row.profileCode,
      row.fromMonth,
      row.toMonth ?? '',
      row.company,
      row.department ?? '',
      row.position,
      row.sortOrder,
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function createEmptyEmployeeSnapshot(): EmployeeSnapshot {
  return {
    version: EMPLOYEE_IO_VERSION,
    exportedAt: new Date().toISOString(),
    employees: [],
    familyMembers: [],
    educationHistories: [],
    workHistories: [],
  };
}

export async function writeEmployeeTemplateWorkbook(): Promise<Buffer> {
  return writeEmployeeWorkbook(createEmptyEmployeeSnapshot());
}

export async function readEmployeeWorkbook(
  buffer: Buffer,
): Promise<EmployeeSnapshot> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const guide = workbook.getWorksheet(EMP_IO_SHEETS.GUIDE);
  if (!guide) {
    throw new Error(`Thiếu sheet ${EMP_IO_SHEETS.GUIDE}`);
  }

  let parsedVersion = EMPLOYEE_IO_VERSION;
  let exportedAt = new Date().toISOString();
  guide.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const key = cellAt(row, 1);
    const value = cellAt(row, 2);
    if (key === 'version') parsedVersion = Number(value) || EMPLOYEE_IO_VERSION;
    if (key === 'exportedAt' && value) exportedAt = value;
  });
  if (parsedVersion !== EMPLOYEE_IO_VERSION) {
    throw new Error(`Phiên bản file không hỗ trợ (yêu cầu v${EMPLOYEE_IO_VERSION})`);
  }

  const employeesSheet = workbook.getWorksheet(EMP_IO_SHEETS.EMPLOYEES);
  const familySheet = workbook.getWorksheet(EMP_IO_SHEETS.FAMILY_MEMBERS);
  const educationSheet = workbook.getWorksheet(EMP_IO_SHEETS.EDUCATION_HISTORIES);
  const workSheet = workbook.getWorksheet(EMP_IO_SHEETS.WORK_HISTORIES);

  if (!employeesSheet || !familySheet || !educationSheet || !workSheet) {
    throw new Error('File thiếu một hoặc nhiều sheet bắt buộc');
  }

  assertHeaders(employeesSheet, EMPLOYEE_HEADERS);
  assertHeaders(familySheet, FAMILY_HEADERS);
  assertHeaders(educationSheet, EDUCATION_HEADERS);
  assertHeaders(workSheet, WORK_HEADERS);

  const employees: EmployeeSnapshot['employees'] = [];
  employeesSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (!cellAt(row, 3) && !cellAt(row, 10) && !cellAt(row, 11)) return;
    const tempId = cellAt(row, 1) || `new:employee:${rowNumber}`;
    // Mã tạm giúp sheet con liên kết hồ sơ mới (chưa có HS-xxxxx).
    const profileCode = cellAt(row, 2) || `DRAFT-ROW-${rowNumber}`;
    employees.push({
      id: tempId,
      profileCode,
      fullName: cellAt(row, 3),
      gender: (cellAt(row, 4) ||
        null) as EmployeeSnapshot['employees'][number]['gender'],
      birthDate: cellAt(row, 5) || null,
      birthPlace: cellAt(row, 6) || null,
      placeOfOrigin: cellAt(row, 7) || null,
      permanentAddress: cellAt(row, 8) || null,
      currentAddress: cellAt(row, 9) || null,
      phone: cellAt(row, 10),
      email: cellAt(row, 11) || null,
      ethnicity: cellAt(row, 12) || null,
      religion: (cellAt(row, 13) ||
        null) as EmployeeSnapshot['employees'][number]['religion'],
      identityNumber: cellAt(row, 14) || null,
      identityIssuedDate: cellAt(row, 15) || null,
      identityIssuedPlace: cellAt(row, 16) || null,
      educationLevel: (cellAt(row, 17) ||
        null) as EmployeeSnapshot['employees'][number]['educationLevel'],
      youthUnionAdmissionDate: cellAt(row, 18) || null,
      youthUnionAdmissionPlace: cellAt(row, 19) || null,
      partyAdmissionDate: cellAt(row, 20) || null,
      partyAdmissionPlace: cellAt(row, 21) || null,
      rewardDiscipline: cellAt(row, 22) || null,
      strengths: cellAt(row, 23) || null,
      status: (cellAt(row, 24) ||
        EmployeeProfileStatus.INCOMPLETE) as EmployeeSnapshot['employees'][number]['status'],
      employmentStatus: (cellAt(row, 25) ||
        null) as EmployeeSnapshot['employees'][number]['employmentStatus'],
      managingCompanyName: cellAt(row, 26),
      linkedAccountCode: cellAt(row, 27) || null,
      workPresenceStatus: (cellAt(row, 28) ||
        EmployeeWorkPresenceStatus.UNKNOWN) as EmployeeSnapshot['employees'][number]['workPresenceStatus'],
    });
  });

  const familyMembers: EmployeeSnapshot['familyMembers'] = [];
  familySheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (!cellAt(row, 2) && !cellAt(row, 4)) return;
    familyMembers.push({
      id: cellAt(row, 1) || `new:family:${rowNumber}`,
      profileCode: cellAt(row, 2),
      relationship: cellAt(row, 3) as EmployeeSnapshot['familyMembers'][number]['relationship'],
      fullName: cellAt(row, 4),
      birthYear: cellAt(row, 5) ? Number(cellAt(row, 5)) : null,
      occupation: cellAt(row, 6) || null,
      workplace: cellAt(row, 7) || null,
      currentResidence: cellAt(row, 8) || null,
      sortOrder: cellAt(row, 9) ? Number(cellAt(row, 9)) : rowNumber - 2,
    });
  });

  const educationHistories: EmployeeSnapshot['educationHistories'] = [];
  educationSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (!cellAt(row, 2) && !cellAt(row, 5)) return;
    educationHistories.push({
      id: cellAt(row, 1) || `new:education:${rowNumber}`,
      profileCode: cellAt(row, 2),
      fromMonth: cellAt(row, 3),
      toMonth: cellAt(row, 4),
      institution: cellAt(row, 5),
      major: cellAt(row, 6),
      trainingMode: cellAt(row, 7) as EmployeeSnapshot['educationHistories'][number]['trainingMode'],
      degree: cellAt(row, 8),
      sortOrder: cellAt(row, 9) ? Number(cellAt(row, 9)) : rowNumber - 2,
    });
  });

  const workHistories: EmployeeSnapshot['workHistories'] = [];
  workSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (!cellAt(row, 2) && !cellAt(row, 5)) return;
    workHistories.push({
      id: cellAt(row, 1) || `new:work:${rowNumber}`,
      profileCode: cellAt(row, 2),
      fromMonth: cellAt(row, 3),
      toMonth: cellAt(row, 4) || null,
      company: cellAt(row, 5),
      department: cellAt(row, 6) || null,
      position: cellAt(row, 7),
      sortOrder: cellAt(row, 8) ? Number(cellAt(row, 8)) : rowNumber - 2,
    });
  });

  const snapshot = normalizeEmployeeSnapshot({
    version: EMPLOYEE_IO_VERSION,
    exportedAt,
    employees,
    familyMembers,
    educationHistories,
    workHistories,
  });

  const errors = validateEmployeeSnapshot(snapshot);
  if (errors.length > 0) {
    throw new Error(errors.slice(0, 20).join('; '));
  }

  return snapshot;
}
