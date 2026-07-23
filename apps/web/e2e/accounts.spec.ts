import { test, expect } from '@playwright/test';

test.describe('HR accounts and permission groups', () => {
  test('accounts page shows account columns under HR module', async ({ page }) => {
    await page.goto('/hr/accounts');
    await expect(page.getByText('Quản lý tài khoản')).toBeVisible();
    await expect(page.getByText('Mã tài khoản')).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Mã vị trí' }),
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Hồ sơ liên kết' }),
    ).toBeVisible();
    await expect(page.getByText(/^TK-\d{5}$/).first()).toBeVisible();
  });

  test('employee profiles list loads', async ({ page }) => {
    await page.goto('/hr/employees');
    await expect(page.getByTestId('employees-page')).toBeVisible();
    await expect(page.getByText('Quản lý nhân sự')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Mã hồ sơ' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Thêm hồ sơ mới' }),
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
