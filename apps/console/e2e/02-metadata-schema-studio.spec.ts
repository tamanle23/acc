import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 02: Metadata Schema Studio & Dynamic Field Invariants', () => {
  test('Schema Studio Navigation, Field Inspection & WCAG AA Audit', async ({ page }) => {
    // 1. Authenticate as Admin
    await authenticateWithSandbox(page, 'admin');

    // 2. Navigate to Metadata Management Schema Studio
    await page.goto('/metadata?tab=schema');
    await expect(page.locator('body')).toBeVisible();

    // Verify Schema Studio or Models rail is visible
    const modelsHeading = page.locator('h1, h2, h3, [role="heading"]').filter({ hasText: /Metadata|Models/i }).first();
    await expect(modelsHeading).toBeVisible({ timeout: 15000 });

    // 3. Ensure we click the Schema tab explicitly
    const schemaTab = page.getByRole('tab', { name: /Schema/i });
    if (await schemaTab.isVisible()) {
      await schemaTab.click();
    }

    // 4. Verify model selection and schema controls
    const schemaOrModelItem = page.locator('button, [role="button"]').filter({ hasText: /Add Field|Draft-07 JSON|Visual Studio|Customer|Record|New/i }).first();
    await expect(schemaOrModelItem).toBeVisible({ timeout: 10000 });

    // 5. Automated WCAG 2.2 AA Accessibility Audit on Schema Studio
    await auditAccessibility(page, 'Metadata Schema Studio (/metadata?tab=schema)');
  });
});
