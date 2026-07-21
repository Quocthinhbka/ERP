import { test, expect } from '@playwright/test';

test.describe('Login flow', () => {
  test('shows login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByText('ERP HyperLabs')).toBeVisible();
  });

  test('login with email redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-identifier').fill('admin@hyperlabs.vn');
    await page.getByTestId('login-password').fill('Admin@123');
    await page.getByTestId('login-submit').click();

    await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('admin@hyperlabs.vn')).toBeVisible();
  });

  test('login with employee code redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-identifier').fill('NV001');
    await page.getByTestId('login-password').fill('Admin@123');
    await page.getByTestId('login-submit').click();

    await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('admin@hyperlabs.vn')).toBeVisible();
  });

  test('login with phone redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-identifier').fill('0900000001');
    await page.getByTestId('login-password').fill('Admin@123');
    await page.getByTestId('login-submit').click();

    await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('admin@hyperlabs.vn')).toBeVisible();
  });
});
