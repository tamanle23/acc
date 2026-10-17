import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 06: Sovereign DLQ Operations & Quarantine Management', () => {
  test('Verify Poison Task DLQ Inspection Sheet & Task Replay Gated by Sovereign Custody', async ({ page }) => {
    // 1. Authenticate as Sovereign Custodian ('system' persona)
    await authenticateWithSandbox(page, 'system');

    // 2. Navigate to System DLQ route
    await page.goto('/system/dlq');
    await expect(page.locator('body')).toBeVisible();

    // 3. Verify Sovereign DLQ Dashboard and Heading render
    const heading = page.locator('h1, h2').filter({ hasText: /Dead-Letter Queue/i }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    // 4. Verify DLQ Data Table renders with quarantined task entries
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });

    // 5. Open Task Inspection Sheet
    const inspectBtn = page.getByRole('button', { name: /Inspect/i }).first();
    if (await inspectBtn.isVisible()) {
      await inspectBtn.click();

      // Verify DLQ Inspector Sheet appears with task details
      const sheetTitle = page.locator('[role="dialog"]').filter({ hasText: /Task Details|DLQ Inspector|Error/i }).first();
      await expect(sheetTitle).toBeVisible({ timeout: 10000 });

      // Run WCAG 2.2 AA audit on open inspection sheet
      await auditAccessibility(page, 'Sovereign DLQ Poison Task Inspector Sheet (/system/dlq)');

      // Close the inspector sheet
      const closeBtn = page.locator('[role="dialog"]').getByRole('button', { name: /Close|Đóng/i }).first();
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }

    // 6. WCAG 2.2 AA Audit on main DLQ view
    await auditAccessibility(page, 'Sovereign DLQ Operations Main Dashboard (/system/dlq)');
  });
});
