import { resolve } from 'path';
import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { loadEnvFile } from './load-env';

loadEnvFile(resolve(__dirname, '../../../.env'));
loadEnvFile(resolve(__dirname, '../../../.env.local'), true);

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Set TEST_ADMIN_* in the monorepo root .env before running web e2e.`,
    );
  }
  return value;
}

export const TEST_ADMIN = {
  email: requiredEnv('TEST_ADMIN_EMAIL').toLowerCase(),
  phone: requiredEnv('TEST_ADMIN_PHONE'),
  password: requiredEnv('TEST_ADMIN_PASSWORD'),
  fullName: process.env.TEST_ADMIN_FULL_NAME?.trim() || 'E2E Admin',
};

export async function ensureTestAdmin(request: APIRequestContext) {
  const res = await request.post('http://localhost:3000/api/auth/bootstrap', {
    data: {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
      fullName: TEST_ADMIN.fullName,
      phone: TEST_ADMIN.phone,
    },
  });
  if (![200, 403].includes(res.status())) {
    throw new Error(`Bootstrap failed: ${res.status()} ${await res.text()}`);
  }
}

export async function loginAsAdmin(page: Page) {
  await ensureTestAdmin(page.request);
  await page.goto('/login');
  await page.getByTestId('login-identifier').fill(TEST_ADMIN.email);
  await page.getByTestId('login-password').fill(TEST_ADMIN.password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible({ timeout: 10000 });
}
