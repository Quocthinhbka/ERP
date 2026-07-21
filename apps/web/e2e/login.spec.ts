import { test, expect } from '@playwright/test';
import { loginAsAdmin, TEST_ADMIN } from './helpers';

test.describe('Login flow', () => {
  test('shows login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByText('ERP HyperLabs')).toBeVisible();
  });

  test('login with email redirects to dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page.getByText(TEST_ADMIN.email)).toBeVisible();
  });

  test('login with account code redirects to dashboard', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/hr/accounts');
    await expect(page.getByText('Mã tài khoản')).toBeVisible();
    const accountCode = await page.getByText(/^TK-\d{5}$/).first().textContent();
    expect(accountCode).toBeTruthy();

    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page.getByTestId('login-form')).toBeVisible();
    await page.getByTestId('login-identifier').fill(accountCode!);
    await page.getByTestId('login-password').fill(TEST_ADMIN.password);
    await page.getByTestId('login-submit').click();

    await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(TEST_ADMIN.email)).toBeVisible();
  });

  test('login with phone redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-identifier').fill(TEST_ADMIN.phone);
    await page.getByTestId('login-password').fill(TEST_ADMIN.password);
    await page.getByTestId('login-submit').click();

    await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(TEST_ADMIN.email)).toBeVisible();
  });
});
