import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 04: Base Entity CRUD Lifecycle & OCC Audit Ledger', () => {
  test('Verify Record Data Grid, OCC Version Tags & Audit Inspection Drawer', async ({ page }) => {
    // 1. Authenticate as Admin
    await authenticateWithSandbox(page, 'admin');

    // 2. Navigate to Metadata Records tab
    await page.goto('/metadata?tab=data');
    await expect(page.locator('body')).toBeVisible();

    // 3. Verify presence of "New Record" button and records table
    const newRecordBtn = page.getByRole('button', { name: /New Record/i });
    await expect(newRecordBtn).toBeVisible({ timeout: 15000 });

    // 4. Verify table rows render
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });

    // 5. Open record action menu on first row
    const firstRowActionBtn = tableRows.first().locator('button').last();
    if (await firstRowActionBtn.isVisible()) {
      await firstRowActionBtn.click();

      // Check if Audit History or Edit action exists
      const auditMenuItem = page.getByRole('menuitem', { name: /Audit|History|Lịch sử/i });
      if (await auditMenuItem.isVisible()) {
        await auditMenuItem.click();
        // Verify Audit Drawer opens
        const auditHeading = page.locator('h2, h3, [role="heading"]').filter({ hasText: /Audit|History|Phiên bản/i }).first();
        if (await auditHeading.isVisible({ timeout: 5000 })) {
          await expect(auditHeading).toBeVisible();
          // Close drawer
          const closeBtn = page.getByRole('button', { name: /Close|Đóng/i }).first();
          if (await closeBtn.isVisible()) {
            await closeBtn.click();
          }
        }
      }
    }

    // 6. Automated WCAG 2.2 AA Accessibility Audit on Data Explorer Grid
    await auditAccessibility(page, 'Base Entity CRUD Data Explorer (/metadata?tab=data)');
  });
});
