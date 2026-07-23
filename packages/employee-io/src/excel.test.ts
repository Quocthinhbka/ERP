import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EducationLevel,
  EmployeeEmploymentStatus,
  EmployeeGender,
  EmployeeProfileStatus,
  FamilyRelationship,
  TrainingMode,
} from '@erp/shared';
import { diffEmployeeSnapshots } from './diff.js';
import {
  readEmployeeWorkbook,
  writeEmployeeTemplateWorkbook,
  writeEmployeeWorkbook,
} from './excel.js';
import {
  parseEmployeeSnapshotJson,
  serializeEmployeeSnapshot,
} from './json.js';
import type { EmployeeSnapshot } from './types.js';
import { EMPLOYEE_IO_VERSION } from './types.js';
import { normalizeEmployeeSnapshot } from './validate.js';

function sampleSnapshot(): EmployeeSnapshot {
  return {
    version: EMPLOYEE_IO_VERSION,
    exportedAt: '2026-07-21T00:00:00.000Z',
    employees: [
      {
        id: 'emp-1',
        profileCode: 'HS-00001',
        fullName: 'NGUYỄN VĂN A',
        gender: EmployeeGender.MALE,
        birthDate: '1990-01-15',
        birthPlace: 'Hà Nội',
        placeOfOrigin: 'Hà Nội',
        permanentAddress: 'Số 1, Hà Nội',
        currentAddress: 'Số 2, Hà Nội',
        phone: '0912345678',
        email: 'a@example.com',
        ethnicity: 'Kinh',
        religion: null,
        identityNumber: '001090001234',
        identityIssuedDate: '2015-01-01',
        identityIssuedPlace: 'Cục CSQLHC',
        educationLevel: EducationLevel.UNIVERSITY,
        youthUnionAdmissionDate: null,
        youthUnionAdmissionPlace: null,
        partyAdmissionDate: null,
        partyAdmissionPlace: null,
        rewardDiscipline: null,
        strengths: null,
        status: EmployeeProfileStatus.INCOMPLETE,
        employmentStatus: EmployeeEmploymentStatus.OFFICIAL,
        managingCompanyName: 'Công ty Demo',
        linkedAccountCode: null,
      },
    ],
    familyMembers: [
      {
        id: 'fam-1',
        profileCode: 'HS-00001',
        relationship: FamilyRelationship.FATHER,
        fullName: 'NGUYỄN VĂN B',
        birthYear: 1960,
        occupation: 'Nông dân',
        workplace: null,
        currentResidence: 'Hà Nội',
        sortOrder: 0,
      },
    ],
    educationHistories: [
      {
        id: 'edu-1',
        profileCode: 'HS-00001',
        fromMonth: '2008-09',
        toMonth: '2012-06',
        institution: 'ĐH Bách Khoa',
        major: 'CNTT',
        trainingMode: TrainingMode.REGULAR,
        degree: 'Cử nhân',
        sortOrder: 0,
      },
    ],
    workHistories: [
      {
        id: 'work-1',
        profileCode: 'HS-00001',
        fromMonth: '2013-01',
        toMonth: null,
        company: 'HyperLabs',
        department: 'Engineering',
        position: 'Engineer',
        sortOrder: 0,
      },
    ],
  };
}

test('employee workbook round-trip preserves core fields', async () => {
  const original = sampleSnapshot();
  const buffer = await writeEmployeeWorkbook(original);
  const parsed = await readEmployeeWorkbook(buffer);

  assert.equal(parsed.employees.length, 1);
  assert.equal(parsed.employees[0].profileCode, 'HS-00001');
  assert.equal(parsed.employees[0].fullName, 'NGUYỄN VĂN A');
  assert.equal(parsed.employees[0].phone, '0912345678');
  assert.equal(parsed.familyMembers.length, 1);
  assert.equal(parsed.educationHistories.length, 1);
  assert.equal(parsed.workHistories.length, 1);
});

test('template workbook is readable', async () => {
  const buffer = await writeEmployeeTemplateWorkbook();
  const parsed = await readEmployeeWorkbook(buffer);
  assert.equal(parsed.employees.length, 0);
});

test('diff marks missing_in_file as non-selectable', () => {
  const current = sampleSnapshot();
  const incoming: EmployeeSnapshot = {
    ...current,
    employees: [],
    familyMembers: [],
    educationHistories: [],
    workHistories: [],
  };
  const diff = diffEmployeeSnapshots(current, incoming);
  const missing = diff.changes.filter((item) => item.kind === 'missing_in_file');
  assert.ok(missing.length > 0);
  assert.ok(missing.every((item) => item.selectable === false));
});

test('diff detects changed employee fields with before/after', () => {
  const current = sampleSnapshot();
  const incoming = sampleSnapshot();
  incoming.employees[0] = {
    ...incoming.employees[0],
    currentAddress: 'Số 99, Hà Nội',
  };
  const diff = diffEmployeeSnapshots(current, incoming);
  const changed = diff.changes.find(
    (item) => item.entityType === 'employee' && item.kind === 'changed',
  );
  assert.ok(changed);
  assert.equal(changed?.selectable, true);
  assert.ok(
    changed?.fieldDiffs?.some(
      (field) =>
        field.field === 'currentAddress' &&
        field.current === 'Số 2, Hà Nội' &&
        field.incoming === 'Số 99, Hà Nội',
    ),
  );
});

test('normalize turns empty enum strings into null', () => {
  const snapshot = sampleSnapshot();
  snapshot.employees[0] = {
    ...snapshot.employees[0],
    gender: '' as unknown as EmployeeGender,
    educationLevel: '   ' as unknown as EducationLevel,
    religion: '' as unknown as never,
  };
  const normalized = normalizeEmployeeSnapshot(snapshot);
  assert.equal(normalized.employees[0].gender, null);
  assert.equal(normalized.employees[0].educationLevel, null);
  assert.equal(normalized.employees[0].religion, null);
});

test('json round-trip preserves core fields and rejects empty gender as null', () => {
  const original = sampleSnapshot();
  original.employees[0].gender = null;
  const raw = serializeEmployeeSnapshot(original);
  const parsed = parseEmployeeSnapshotJson(raw);
  assert.equal(parsed.employees[0].profileCode, 'HS-00001');
  assert.equal(parsed.employees[0].gender, null);
  assert.equal(parsed.employees[0].phone, '0912345678');
});

test('workbook with blank gender/educationLevel parses as null', async () => {
  const original = sampleSnapshot();
  original.employees[0].gender = null;
  original.employees[0].educationLevel = null;
  const buffer = await writeEmployeeWorkbook(original);
  const parsed = await readEmployeeWorkbook(buffer);
  assert.equal(parsed.employees[0].gender, null);
  assert.equal(parsed.employees[0].educationLevel, null);
});
