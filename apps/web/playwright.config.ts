import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, devices } from '@playwright/test';
import { loadEnvFile } from './e2e/load-env';

const __dirname = dirname(fileURLToPath(import.meta.url));

loadEnvFile(resolve(__dirname, '../../.env'));
loadEnvFile(resolve(__dirname, '../../.env.local'), true);

const API_PORT = process.env.API_PORT ?? '3000';
const authFile = 'e2e/.auth/admin.json';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
      testIgnore: /login\.spec\.ts/,
    },
    {
      name: 'chromium-login',
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
      testMatch: /login\.spec\.ts/,
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: 'pnpm dev:api',
      url: `http://127.0.0.1:${API_PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      cwd: '../..',
      timeout: 120000,
      env: { ...process.env, API_PORT },
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      cwd: '.',
      timeout: 60000,
      env: { ...process.env, API_PORT },
    },
  ],
});
