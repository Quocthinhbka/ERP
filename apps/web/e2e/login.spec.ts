import { test, expect } from '@playwright/test';
import {
  ensureTestAdmin,
  expectLoggedInAsAdmin,
  loginAsAdmin,
  TEST_ADMIN,
  TEST_ADMIN_LOGIN_IDENTIFIER,
} from './helpers';

test.describe('Login flow', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });
  test('shows login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByText('ERP HyperLabs')).toBeVisible();
  });

  test('login with configured identifier redirects to dashboard', async ({ page, request }) => {
    await loginAsAdmin(page, request);
  });

  test('login with account code redirects to dashboard', async ({ page, request }) => {
    await loginAsAdmin(page, request);
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page.getByTestId('login-form')).toBeVisible();
    await page.getByTestId('login-identifier').fill(TEST_ADMIN.accountCode);
    await page.getByTestId('login-password').fill(TEST_ADMIN.password);
    await page.getByTestId('login-submit').click();

    await expectLoggedInAsAdmin(page);
  });

  test('login with email redirects to dashboard when admin has email', async ({ page, request }) => {
    await ensureTestAdmin(request);
    test.skip(
      TEST_ADMIN_LOGIN_IDENTIFIER !== TEST_ADMIN.email,
      'Test admin hiện tại không có email — chỉ bootstrap DB trống.',
    );

    await page.goto('/login');
    await page.getByTestId('login-identifier').fill(TEST_ADMIN.email);
    await page.getByTestId('login-password').fill(TEST_ADMIN.password);
    await page.getByTestId('login-submit').click();

    await expectLoggedInAsAdmin(page);
    await expect(page.getByText(TEST_ADMIN.email)).toBeVisible();
  });

  test('login with phone redirects to dashboard when admin has phone', async ({ page, request }) => {
    await ensureTestAdmin(request);
    test.skip(
      TEST_ADMIN_LOGIN_IDENTIFIER !== TEST_ADMIN.phone,
      'Test admin hiện tại không có SĐT.',
    );

    await page.goto('/login');
    await page.getByTestId('login-identifier').fill(TEST_ADMIN.phone);
    await page.getByTestId('login-password').fill(TEST_ADMIN.password);
    await page.getByTestId('login-submit').click();

    await expectLoggedInAsAdmin(page);
  });
});
