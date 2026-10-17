import { defineConfig, devices } from '@playwright/test';

const isLiveMode = process.env.E2E_MODE === 'live';

export default defineConfig({
  testDir: './e2e',
  timeout: 35000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: isLiveMode
      ? 'pnpm --filter @unipost/console dev:no-sandbox --port 5173'
      : 'pnpm --filter @unipost/console dev:sandbox --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
