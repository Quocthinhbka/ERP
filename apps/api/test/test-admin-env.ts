import { resolve } from 'path';
import { config as loadEnv } from 'dotenv';

/** Nạp .env monorepo root (không phụ thuộc cwd). */
export function loadRootEnv() {
  loadEnv({ path: resolve(__dirname, '../../../.env') });
  loadEnv({ path: resolve(__dirname, '../../../.env.local'), override: true });
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Set TEST_ADMIN_* in the monorepo root .env (see .env.example).`,
    );
  }
  return value;
}

export type TestAdminCredentials = {
  email: string;
  phone: string;
  password: string;
  fullName: string;
};

/** Credential e2e — tạo qua /auth/bootstrap khi DB trống. */
export function getTestAdminCredentials(): TestAdminCredentials {
  loadRootEnv();
  return {
    email: requiredEnv('TEST_ADMIN_EMAIL').toLowerCase(),
    phone: requiredEnv('TEST_ADMIN_PHONE'),
    password: requiredEnv('TEST_ADMIN_PASSWORD'),
    fullName: process.env.TEST_ADMIN_FULL_NAME?.trim() || 'E2E Admin',
  };
}
