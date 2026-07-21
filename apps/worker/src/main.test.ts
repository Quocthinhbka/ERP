import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ORG_IO_QUEUE_NAME } from '@erp/organization-io';

test('organization-io queue name is defined', () => {
  assert.equal(ORG_IO_QUEUE_NAME, 'erp-organization-io');
});
