import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { expect, type Page, type APIRequestContext } from '@playwright/test';
import { loadEnvFile } from './load-env';
import { getE2eApiBase } from './api-base';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  accountCode: process.env.TEST_ADMIN_ACCOUNT_CODE?.trim() || 'Admin',
};

/** Identifier dùng để đăng nhập — xác định sau ensureTestAdmin. */
export let TEST_ADMIN_LOGIN_IDENTIFIER = TEST_ADMIN.email;

/** Chuỗi hiển thị trên header sau đăng nhập (fullName - accountCode hoặc email). */
export let TEST_ADMIN_HEADER_LABEL = TEST_ADMIN.fullName;

function loginIdentifierCandidates(): string[] {
  return [
    TEST_ADMIN.accountCode,
    TEST_ADMIN.email,
    TEST_ADMIN.phone,
  ].filter((value, index, all) => value && all.indexOf(value) === index);
}

async function tryLogin(request: APIRequestContext, identifier: string) {
  return request.post(`${getE2eApiBase()}/auth/login`, {
    data: { identifier, password: TEST_ADMIN.password },
  });
}

function resolveHeaderLabel(user: {
  fullName?: string | null;
  accountCode?: string | null;
  email?: string | null;
}) {
  const namePart = [user.fullName, user.accountCode].filter(Boolean).join(' - ');
  return namePart || user.email || TEST_ADMIN.fullName;
}

export async function ensureTestAdmin(request: APIRequestContext) {
  const res = await request.post(`${getE2eApiBase()}/auth/bootstrap`, {
    data: {
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
      fullName: TEST_ADMIN.fullName,
      phone: TEST_ADMIN.phone,
    },
  });

  if (res.status() === 200) {
    TEST_ADMIN_LOGIN_IDENTIFIER = TEST_ADMIN.email;
    const body = (await res.json()) as { user?: { fullName?: string; email?: string; accountCode?: string } };
    TEST_ADMIN_HEADER_LABEL = resolveHeaderLabel(body.user ?? {});
    return;
  }

  // 429 có thể xảy ra khi các Playwright worker bootstrap song song.
  if (![403, 429].includes(res.status())) {
    throw new Error(`Bootstrap failed: ${res.status()} ${await res.text()}`);
  }

  for (const identifier of loginIdentifierCandidates()) {
    const login = await tryLogin(request, identifier);
    if (!login.ok()) continue;

    const body = (await login.json()) as {
      user?: { fullName?: string; email?: string; accountCode?: string };
    };
    TEST_ADMIN_LOGIN_IDENTIFIER = identifier;
    TEST_ADMIN_HEADER_LABEL = resolveHeaderLabel(body.user ?? {});
    return;
  }

  throw new Error(
    'Cannot login as test admin. Kiểm tra TEST_ADMIN_PASSWORD / TEST_ADMIN_ACCOUNT_CODE hoặc reset DB (bootstrap).',
  );
}

export async function getAdminAccessToken(request: APIRequestContext): Promise<string> {
  await ensureTestAdmin(request);
  const login = await tryLogin(request, TEST_ADMIN_LOGIN_IDENTIFIER);
  if (!login.ok()) {
    throw new Error(`Admin login failed: ${login.status()} ${await login.text()}`);
  }
  const body = (await login.json()) as { accessToken: string };
  return body.accessToken;
}

export async function expectLoggedInAsAdmin(page: Page) {
  await expect(page.getByTestId('header-breadcrumb-current')).toHaveText('Tổng quan', {
    timeout: 10000,
  });
  await expect(page.getByText(TEST_ADMIN_HEADER_LABEL, { exact: false })).toBeVisible();
}

export async function loginAsAdmin(page: Page, request: APIRequestContext) {
  await ensureTestAdmin(request);
  // API login qua request fixture chia sẻ cookie với browser — xóa trước khi test UI login.
  await page.context().clearCookies();
  await page.goto('/login');
  await expect(page.getByTestId('login-form')).toBeVisible();
  await page.getByTestId('login-identifier').fill(TEST_ADMIN_LOGIN_IDENTIFIER);
  await page.getByTestId('login-password').fill(TEST_ADMIN.password);
  await page.getByTestId('login-submit').click();
  await expectLoggedInAsAdmin(page);
}
