import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EntityStatus } from '@erp/shared';
import { writeOrganizationWorkbook, readOrganizationWorkbook } from './excel.js';
import { diffOrganizationSnapshots } from './diff.js';
import type { OrganizationSnapshot } from './types.js';

function sampleSnapshot(overrides?: Partial<OrganizationSnapshot>): OrganizationSnapshot {
  const base: OrganizationSnapshot = {
    version: 1,
    exportedAt: '2026-07-20T00:00:00.000Z',
    organization: {
      id: 'org-1',
      name: 'Org A',
      representativeName: 'Rep',
      additionalInfo: null,
      linkedProfile: null,
    },
    organizationMembers: [
      {
        id: 'om-1',
        position: 'GD',
        memberName: 'A',
        phone: null,
        email: null,
        additionalInfo: null,
        sortOrder: 0,
      },
    ],
    companies: [
      {
        id: 'c-1',
        name: 'Company 1',
        taxId: '123',
        address: null,
        representativeName: null,
        phone: null,
        email: null,
        status: EntityStatus.ACTIVE,
        sortOrder: 0,
        linkedProfile: null,
      },
    ],
    companyMembers: [],
    units: [
      {
        id: 'u-1',
        companyId: 'c-1',
        companyName: 'Company 1',
        parentUnitId: null,
        parentPath: null,
        unitPath: 'Unit 1',
        name: 'Unit 1',
        managerName: 'Mgr',
        status: EntityStatus.ACTIVE,
        additionalInfo: null,
        sortOrder: 0,
        linkedProfile: null,
      },
    ],
    unitMembers: [],
  };
  return { ...base, ...overrides };
}

describe('organization excel round-trip', () => {
  it('preserves core fields across write/read', async () => {
    const snapshot = sampleSnapshot();
    const buffer = await writeOrganizationWorkbook(snapshot);
    const parsed = await readOrganizationWorkbook(buffer);

    assert.equal(parsed.organization.name, 'Org A');
    assert.equal(parsed.companies[0].taxId, '123');
    assert.equal(parsed.units[0].name, 'Unit 1');
    assert.equal(parsed.organizationMembers[0].memberName, 'A');
  });
});

describe('organization diff', () => {
  it('marks new, changed and missing_in_file', () => {
    const current = sampleSnapshot();
    const incoming = sampleSnapshot({
      companies: [
        {
          ...current.companies[0],
          name: 'Company 1 Updated',
        },
        {
          id: 'c-2',
          name: 'Company 2',
          taxId: null,
          address: null,
          representativeName: null,
          phone: null,
          email: null,
          status: EntityStatus.ACTIVE,
          sortOrder: 1,
          linkedProfile: null,
        },
      ],
      organizationMembers: [],
    });

    const diff = diffOrganizationSnapshots(current, incoming);
    const companyChanged = diff.changes.find((c) => c.selectionKey === 'company:c-1');
    const companyNew = diff.changes.find((c) => c.selectionKey === 'company:c-2');
    const memberMissing = diff.changes.find((c) => c.selectionKey === 'organization_member:om-1');

    assert.equal(companyChanged?.kind, 'changed');
    assert.equal(companyNew?.kind, 'new');
    assert.equal(memberMissing?.kind, 'missing_in_file');
    assert.ok(memberMissing?.warning?.includes('XÓA'));
  });
});
