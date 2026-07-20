import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill('admin@hyperlabs.vn');
  await page.getByTestId('login-password').fill('Admin@123');
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 10000 });
}

test.describe('Roles page', () => {
  test('role form shows permission checkboxes grouped by module', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/setup/roles');
    await page.getByRole('button', { name: 'Thêm vai trò' }).click();

    const permissionGroup = page.getByTestId('role-permissions');
    await expect(permissionGroup).toBeVisible();
    await expect(page.getByTestId('permission-setup:view')).toBeVisible();
    await expect(page.getByTestId('permission-user:view')).toBeVisible();
    await expect(page.getByTestId('permission-role:view')).toBeVisible();
    await expect(permissionGroup.getByText('Thiết lập', { exact: true })).toBeVisible();
    await expect(permissionGroup.getByText('Người dùng', { exact: true })).toBeVisible();
    await expect(permissionGroup.getByText('Phân quyền', { exact: true })).toBeVisible();

    await page.getByTestId('permission-setup:view').check();
    await expect(page.getByTestId('permission-setup:view')).toBeChecked();
  });
});
