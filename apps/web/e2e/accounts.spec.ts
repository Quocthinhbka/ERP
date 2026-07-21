import { test, expect } from '@playwright/test';
import { loginAsAdmin, TEST_ADMIN } from './helpers';

test.describe('HR accounts and permission groups', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('accounts page shows account columns under HR module', async ({ page }) => {
    await page.goto('/hr/accounts');
    await expect(page.getByText('Quản lý tài khoản')).toBeVisible();
    await expect(page.getByText('Mã tài khoản')).toBeVisible();
    await expect(page.getByText('Hồ sơ liên kết')).toBeVisible();
    await expect(page.getByText(/^TK-\d{5}$/).first()).toBeVisible();
    await expect(
      page.getByRole('cell', { name: TEST_ADMIN.email }),
    ).toBeVisible();
  });

  test('employee profiles list loads', async ({ page }) => {
    await page.goto('/hr/employees');
    await expect(page.getByText('Sơ yếu lý lịch').first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Mã hồ sơ' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Khai báo sơ yếu lý lịch' }),
    ).toBeVisible();
  });

  test('legacy setup/accounts redirects to hr/accounts', async ({ page }) => {
    await page.goto('/setup/accounts');
    await expect(page).toHaveURL(/\/hr\/accounts$/);
    await expect(page.getByText('Quản lý tài khoản')).toBeVisible();
  });

  test('permission groups page loads', async ({ page }) => {
    await page.goto('/setup/permission-groups');
    await expect(page.getByText('Nhóm quyền', { exact: true })).toBeVisible();
  });
});
