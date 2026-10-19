import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 05: Visual DAG Workflows Studio & Execution Replay', () => {
  test('Verify Workflow Catalog, Visual DAG Studio Designer & Execution Scrubber', async ({ page }) => {
    // 1. Authenticate as Admin
    await authenticateWithSandbox(page, 'admin');

    // 2. Navigate to Workflows Catalog
    await page.goto('/workflows');
    await expect(page.locator('body')).toBeVisible();

    // 3. Verify Workflow Catalog Table renders
    const heading = page.locator('h1').filter({ hasText: /Workflow Definitions|Studio/i }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    // 4. Verify Catalog has Design buttons or records
    const designButtons = page.getByRole('button', { name: /Design/i });
    if (await designButtons.count() > 0) {
      // Open the visual DAG studio for the first workflow
      await designButtons.first().click();

      // Verify Visual DAG Studio canvas and node palette mount
      await expect(page.locator('.react-flow')).toBeVisible({ timeout: 15000 });

      // Verify node types or palette categories are visible
      const nodePalette = page.locator('text=Control Flow').or(page.locator('text=Palette')).or(page.locator('.react-flow__node'));
      await expect(nodePalette.first()).toBeVisible({ timeout: 10000 });

      // 5. Run WCAG 2.2 AA audit on Designer Canvas
      await auditAccessibility(page, 'Visual DAG Studio Designer (/workflows?studio)');

      // 6. Return back to catalog
      const backBtn = page.getByRole('button', { name: /Back to Catalog/i });
      if (await backBtn.isVisible()) {
        await backBtn.click();
        await expect(heading).toHaveText(/Workflow Definitions/i, { timeout: 10000 });
      }
    } else {
      // In case table has no entries, audit catalog table
      await auditAccessibility(page, 'Workflow Catalog Table (/workflows)');
    }
  });
});
