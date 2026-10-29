import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
try {
  process.loadEnvFile('.env.local');
} catch {}
process.env.ALATAU_TEST_RUN ||= `${Date.now()}-${process.pid}`;
process.env.ALATAU_TEST_DB = resolve(`.local/e2e-${process.env.ALATAU_TEST_RUN}-demo.sqlite`);
process.env.ALATAU_TEST_CREDENTIALS ||= resolve(
  `.local/e2e-${process.env.ALATAU_TEST_RUN}-credentials.json`,
);
const pg = process.env.ALATAU_TEST_PROVIDER === 'postgres';
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: '**/browser-smoke.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile',
      testIgnore: '**/browser-smoke.spec.ts',
      use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'firefox-smoke',
      testMatch: '**/browser-smoke.spec.ts',
      use: { browserName: 'firefox', viewport: { width: 1440, height: 1000 } },
    },
  ],
  webServer: {
    command:
      (pg ? '' : 'node --env-file-if-exists=.env.local --import tsx scripts/seed.ts && ') +
      'npm run start -- --hostname 127.0.0.1 --port 3100',
    url: 'http://127.0.0.1:3100/ru',
    reuseExistingServer: false,
    env: {
      APP_MODE: 'demo',
      DATABASE_PROVIDER: pg ? 'postgres' : 'sqlite',
      ALATAU_DB_TASK: '',
      DATABASE_PATH: process.env.ALATAU_TEST_DB,
      DEMO_CREDENTIALS_PATH: process.env.ALATAU_TEST_CREDENTIALS,
      BETTER_AUTH_URL: 'http://127.0.0.1:3100',
    },
    timeout: 120000,
  },
});
