import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 13: Sovereign Audit & Compliance Studio & Forward-Hash Ledger', () => {
  test('Inspect Cryptographic Forward-Hash Ledger, trigger integrity check, and verify WCAG 2.2 AA', async ({ page }) => {
    // 1. Authenticate as Sovereign Root Custodian ('system' persona)
    await authenticateWithSandbox(page, 'system');

    // 2. Navigate to Sovereign Audit Studio route (/system/audit)
    await page.goto('/system/audit');
    await expect(page.locator('body')).toBeVisible();

    // 3. Verify Sovereign Audit & Compliance Studio heading
    const heading = page.locator('h1').filter({ hasText: /Sovereign Audit & Compliance Studio/i });
    await expect(heading).toBeVisible({ timeout: 15000 });

    // 4. Verify Active SHA-256 Ledger badge
    const ledgerBadge = page.locator('body').filter({
      hasText: /Active SHA-256 Ledger|Cryptographic Forward-Hash Ledger/i,
    }).first();
    await expect(ledgerBadge).toBeVisible({ timeout: 10000 });

    // 5. Verify the standardized DataTable renders audit blocks
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });
    const blockCell = page.locator('td').filter({ hasText: /#101|#102|custodian_root/i }).first();
    await expect(blockCell).toBeVisible({ timeout: 10000 });

    // 6. Audit Accessibility of Audit Studio (WCAG 2.2 AA)
    await auditAccessibility(page, 'Sovereign Audit & Compliance Studio (/system/audit)');

    // 7. Trigger Verify Chain Integrity button
    const verifyButton = page.getByRole('button', { name: /Verify Chain Integrity/i });
    await expect(verifyButton).toBeVisible();
    await verifyButton.click();

    // 8. Verify integrity result banner appears
    const successBanner = page.locator('body').filter({
      hasText: /Cryptographic forward-hash chain 100% intact|Verified 3 blocks/i,
    }).first();
    await expect(successBanner).toBeVisible({ timeout: 10000 });

    // 9. Open Diff inspection modal and verify cryptographic diff rendering
    const diffButton = page.getByRole('button', { name: /Diff/i }).first();
    if (await diffButton.isVisible()) {
      await diffButton.click();
      const dialogContent = page.locator('[role="dialog"]');
      await expect(dialogContent).toBeVisible({ timeout: 5000 });
      await expect(dialogContent.filter({ hasText: /Inspection|Attribute Delta/i }).first()).toBeVisible();

      // Close the inspection modal
      const closeButton = page.locator('[data-slot="dialog-close"]');
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await expect(dialogContent).toBeHidden({ timeout: 5000 });
      }
    }
  });
});
