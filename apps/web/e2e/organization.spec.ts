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
    await expect(page.getByRole('treeitem').getByText('Tổ chức HyperLabs')).toBeVisible({
      timeout: 10000,
    });
  });
});
