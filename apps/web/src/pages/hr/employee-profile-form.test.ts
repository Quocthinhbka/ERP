import { describe, expect, it } from 'vitest';
import { EmployeeProfileStatus } from '@erp/shared';
import { profileToFormValues } from './employee-profile-form';
import type { EmployeeProfileDetail } from './employee-types';

const baseProfile: EmployeeProfileDetail = {
  id: 'p1',
  profileCode: 'NV001',
  fullName: 'Nguyen Van A',
  phone: '0901234567',
  email: 'a@test.com',
  gender: null,
  birthDate: '1990-05-15T00:00:00.000Z',
  birthPlace: null,
  placeOfOrigin: null,
  permanentAddress: null,
  currentAddress: null,
  ethnicity: null,
  religion: null,
  identityNumber: null,
  identityIssuedDate: null,
  identityIssuedPlace: null,
  educationLevel: null,
  youthUnionAdmissionDate: null,
  youthUnionAdmissionPlace: null,
  partyAdmissionDate: null,
  partyAdmissionPlace: null,
  rewardDiscipline: null,
  strengths: null,
  employmentStatus: null,
  workPresenceStatus: 'UNKNOWN',
  managingCompanyId: 'c1',
  status: EmployeeProfileStatus.INCOMPLETE,
  avatarUrl: null,
  customValues: { note: 'x' },
  familyMembers: [],
  educationHistories: [],
  workHistories: [],
  editRequests: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('profileToFormValues', () => {
  it('maps scalar fields and trims dates to input format', () => {
    const values = profileToFormValues(baseProfile);
    expect(values.fullName).toBe('Nguyen Van A');
    expect(values.birthDate).toBe('1990-05-15');
    expect(values.managingCompanyId).toBe('c1');
    expect(values.customValues).toEqual({ note: 'x' });
  });

  it('uses undefined for nullable empty fields', () => {
    const values = profileToFormValues(baseProfile);
    expect(values.gender).toBeUndefined();
    expect(values.email).toBe('a@test.com');
  });
});
