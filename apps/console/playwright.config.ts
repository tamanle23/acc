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
    trace: 'on',
    screenshot: 'on',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: isLiveMode
    ? [
        {
          command: 'java "-Dspring.profiles.active=local" "-Dapplication.sandbox.enabled=true" "-Dapplication.sandbox.mode=DEV" "-Dapplication.sandbox.dev.pristine=true" "-Djava.net.preferIPv4Stack=true" -jar apps/backend/dist/acc-ms-aio/acc-ms-aio-1.0.0-SNAPSHOT.jar',
          url: 'http://localhost:8000/actuator/health',
          reuseExistingServer: true,
          timeout: 120000,
        },
        {
          command: 'pnpm --filter @acc/console dev:no-sandbox --port 5173',
          url: 'http://localhost:5173',
          reuseExistingServer: !process.env.CI,
          timeout: 60000,
        },
      ]
    : {
        command: 'pnpm --filter @acc/console dev:sandbox --port 5173',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60000,
      },
});

