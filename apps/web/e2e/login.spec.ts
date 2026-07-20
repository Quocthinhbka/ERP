import { test, expect } from '@playwright/test';

test.describe('Login flow', () => {
  test('shows login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByText('ERP HyperLabs')).toBeVisible();
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-email').fill('admin@hyperlabs.vn');
    await page.getByTestId('login-password').fill('Admin@123');
    await page.getByTestId('login-submit').click();

    await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('admin@hyperlabs.vn')).toBeVisible();
  });
});
