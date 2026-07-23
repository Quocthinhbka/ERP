import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { test as setup, expect } from '@playwright/test';
import { ensureTestAdmin, TEST_ADMIN, TEST_ADMIN_LOGIN_IDENTIFIER } from './helpers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const authFile = resolve(__dirname, '.auth/admin.json');

setup('prepare admin session', async ({ page, request }) => {
  mkdirSync(dirname(authFile), { recursive: true });
  await ensureTestAdmin(request);

  await page.goto('/login');
  await expect(page.getByTestId('login-form')).toBeVisible();
  await page.getByTestId('login-identifier').fill(TEST_ADMIN_LOGIN_IDENTIFIER);
  await page.getByTestId('login-password').fill(TEST_ADMIN.password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('header-breadcrumb-current')).toHaveText('Tổng quan', {
    timeout: 15000,
  });

  await page.context().storageState({ path: authFile });
});
