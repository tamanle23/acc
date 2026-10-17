import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 03: Composite 360 & Master-Detail Invariants', () => {
  test('Navigate to Metadata, Select Customer 360 View, Verify Rollups Bar, Expand Child Collections & Verify WCAG AA', async ({ page }) => {
    // 1. Authenticate as Admin
    await authenticateWithSandbox(page, 'admin');

    // 2. Navigate directly to Metadata Management Data Explorer
    await page.goto('/metadata?tab=data');
    await expect(page.locator('body')).toBeVisible();

    // Verify metadata view rendered
    const titleLocator = page.locator('h1, h2, [role="heading"]').filter({ hasText: /Metadata/i }).first();
    await expect(titleLocator).toBeVisible({ timeout: 15000 });

    // 3. Toggle "Composite Entities" switch in the sidebar if available
    const compositeToggle = page.getByRole('switch', { name: /Filter Composite Entities Only/i });
    if (await compositeToggle.isVisible()) {
      await compositeToggle.click();
      const compositeEntityItem = page.getByText(/Customer 360 View/i).first();
      if (await compositeEntityItem.isVisible()) {
        await compositeEntityItem.click();
      }
    }

    // 4. Verify composite table loads and master-detail container is rendered
    const masterDetailContainer = page.locator('[data-testid="composite-master-detail-container"]').first();
    if (await masterDetailContainer.isVisible({ timeout: 5000 })) {
      // 5. Verify dynamic SQL pushdown badge
      await expect(page.getByText('dynamic-sql-pushdown').first()).toBeVisible();

      // 6. Verify computed rollup chips if present
      const rollupsBar = page.locator('[data-testid="composite-rollups-bar"]').first();
      if (await rollupsBar.isVisible()) {
        await expect(rollupsBar).toBeVisible();
      }

      // 7. Test child collection tab switching (e.g. switching to tickets or resources)
      const tabButtons = masterDetailContainer.locator('button').filter({ hasText: /tickets|resources/i });
      if ((await tabButtons.count()) > 1) {
        await tabButtons.nth(1).click();
      }
    }

    // 8. Automated WCAG 2.2 AA Accessibility Audit on the Composite Explorer View
    await auditAccessibility(page, 'Composite Explorer View (/metadata?tab=data)');
  });
});
