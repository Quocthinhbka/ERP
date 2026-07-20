import { test, expect } from '@playwright/test';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByTestId('login-email').fill('admin@hyperlabs.vn');
  await page.getByTestId('login-password').fill('Admin@123');
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 10000 });
}

test.describe('Organization page', () => {
  test('shows organization tree page', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/setup/organization');
    await expect(page.getByText('Thiết lập / Tổ chức')).toBeVisible();
    await expect(page.getByRole('tree')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('treeitem').first()).toBeVisible();
  });

  test('organization node can be edited', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/setup/organization');
    await page.getByRole('treeitem').first().click();
    await expect(page.locator('button[title="Sửa"]')).toBeVisible();
    await page.locator('button[title="Sửa"]').click();
    await expect(page.getByRole('button', { name: 'Lưu' })).toBeVisible();
    await expect(page.getByLabel('Tên tổ chức')).toBeVisible();
  });

  test('company detail panel is read-only until edit is clicked', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/setup/organization');
    await page.getByRole('treeitem').first().click();
    page.once('dialog', (dialog) => dialog.accept('Công ty Playwright Test'));
    await page.getByRole('button', { name: 'Thêm công ty' }).click();
    await expect(page.getByRole('treeitem').filter({ hasText: 'Công ty Playwright Test' }).first()).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole('treeitem').filter({ hasText: 'Công ty Playwright Test' }).first().click();
    await expect(page.locator('button[title="Sửa"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu' })).toHaveCount(0);
    await page.locator('button[title="Sửa"]').click();
    await expect(page.getByRole('button', { name: 'Lưu' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hủy' })).toBeVisible();
  });

  test('shows import export buttons', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/setup/organization');
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import Excel' })).toBeVisible();
  });
});
