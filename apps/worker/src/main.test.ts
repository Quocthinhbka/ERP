import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_QUEUE_NAME } from './constants.js';

describe('worker constants', () => {
  it('demo queue name is defined', () => {
    assert.equal(DEMO_QUEUE_NAME, 'erp-demo');
  });
});
