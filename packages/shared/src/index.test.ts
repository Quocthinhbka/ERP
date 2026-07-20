import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Permissions,
  hasPermission,
  hasAnyPermission,
} from './index.js';

describe('hasPermission', () => {
  const perms = [Permissions.USER_VIEW, Permissions.ROLE_VIEW];

  it('returns true when user has all required permissions', () => {
    assert.equal(hasPermission(perms, Permissions.USER_VIEW), true);
    assert.equal(
      hasPermission(perms, [Permissions.USER_VIEW, Permissions.ROLE_VIEW]),
      true,
    );
  });

  it('returns false when user lacks a required permission', () => {
    assert.equal(hasPermission(perms, Permissions.USER_CREATE), false);
    assert.equal(
      hasPermission(perms, [Permissions.USER_VIEW, Permissions.USER_CREATE]),
      false,
    );
  });
});

describe('hasAnyPermission', () => {
  const perms = [Permissions.USER_VIEW];

  it('returns true when user has at least one permission', () => {
    assert.equal(
      hasAnyPermission(perms, [Permissions.USER_VIEW, Permissions.USER_CREATE]),
      true,
    );
  });

  it('returns false when user has none of the permissions', () => {
    assert.equal(
      hasAnyPermission(perms, [Permissions.USER_CREATE, Permissions.ROLE_CREATE]),
      false,
    );
  });
});
