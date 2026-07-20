import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatCompanyCode, formatUnitCode, ORGANIZATION_CODE } from './index.js';

describe('org code helpers', () => {
  it('formats company code', () => {
    assert.equal(formatCompanyCode(1), 'C01');
    assert.equal(formatCompanyCode(12), 'C12');
  });

  it('formats unit code', () => {
    assert.equal(formatUnitCode('C01', 1), 'C01-001');
    assert.equal(formatUnitCode('C02', 15), 'C02-015');
  });

  it('organization code is ORG', () => {
    assert.equal(ORGANIZATION_CODE, 'ORG');
  });
});
