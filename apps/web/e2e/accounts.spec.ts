import { test, expect } from '@playwright/test';

test.describe('Accounts and permission groups', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-identifier').fill('admin@hyperlabs.vn');
    await page.getByTestId('login-password').fill('Admin@123');
    await page.getByTestId('login-submit').click();
    await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 10000 });
  });

  test('accounts page shows account columns', async ({ page }) => {
    await page.goto('/setup/accounts');
    await expect(page.getByText('Quản lý tài khoản')).toBeVisible();
    await expect(page.getByText('Mã NV')).toBeVisible();
    await expect(page.getByText('Hồ sơ liên kết')).toBeVisible();
    await expect(page.getByText('NV001')).toBeVisible();
  });

  test('permission groups page shows default groups', async ({ page }) => {
    await page.goto('/setup/permission-groups');
    await expect(page.getByText('Nhóm quyền', { exact: true })).toBeVisible();
    await expect(page.getByText('Quản trị đầy đủ')).toBeVisible();
    await expect(page.getByText('Người dùng cơ bản')).toBeVisible();
  });
});
