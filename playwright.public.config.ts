import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests-public',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/public', open: 'never' }]],
  outputDir: 'test-results/public',
  use: {
    baseURL: 'https://127.0.0.1:3343',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'public-demo', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node scripts/public-test-server.mjs',
    url: 'https://127.0.0.1:3343/ru',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
