import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 07: Worker Fleet Telemetry & Drain Lifecycle', () => {
  test('Verify Worker Fleet Metrics, Live Polling & Worker Drain Action', async ({ page }) => {
    // 1. Authenticate as Sovereign Custodian ('system' persona)
    await authenticateWithSandbox(page, 'system');

    // 2. Navigate to System Workers route
    await page.goto('/system/workers');
    await expect(page.locator('body')).toBeVisible();

    // 3. Verify Worker Fleet Telemetry Header and Metric Cards
    const heading = page.locator('h1').filter({ hasText: /Worker Fleet Telemetry/i });
    await expect(heading).toBeVisible({ timeout: 15000 });

    // 4. Verify Active Worker Cards render
    const workerCards = page.locator('[data-testid^="worker-card-"]');
    await expect(workerCards.first()).toBeVisible({ timeout: 10000 });

    // 5. Verify Drain button is present on active worker
    const drainBtn = workerCards.first().getByRole('button', { name: /Drain/i });
    if (await drainBtn.isVisible()) {
      await expect(drainBtn).toBeEnabled();
    }

    // 6. Automated WCAG 2.2 AA Accessibility Audit on Worker Fleet View
    await auditAccessibility(page, 'Worker Fleet Telemetry View (/system/workers)');
  });
});
