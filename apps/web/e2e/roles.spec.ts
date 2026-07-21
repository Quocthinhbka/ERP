import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers';

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
