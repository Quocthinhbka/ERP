import { test, expect } from '@playwright/test';
import { loginAsAdmin, TEST_ADMIN } from './helpers';

test.describe('Accounts and permission groups', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('accounts page shows account columns', async ({ page }) => {
    await page.goto('/setup/accounts');
    await expect(page.getByText('Quản lý tài khoản')).toBeVisible();
    await expect(page.getByText('Mã tài khoản')).toBeVisible();
    await expect(page.getByText('Hồ sơ liên kết')).toBeVisible();
    await expect(page.getByText(/^TK-\d{5}$/).first()).toBeVisible();
    await expect(page.getByText(TEST_ADMIN.email)).toBeVisible();
  });

  test('permission groups page loads', async ({ page }) => {
    await page.goto('/setup/permission-groups');
    await expect(page.getByText('Nhóm quyền', { exact: true })).toBeVisible();
  });
});
