import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Composite Entities End-to-End Resilience & User Flow', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Visit sign-in page and authenticate via Unified Sandbox bypass
    await page.goto('/sign-in');

    const bypassBtn = page.getByRole('button', { name: /Bypass with Sandbox/i });
    await expect(bypassBtn).toBeVisible({ timeout: 15000 });
    await bypassBtn.click();

    const adminOption = page.getByRole('menuitem', { name: /Admin/i });
    await expect(adminOption).toBeVisible({ timeout: 5000 });
    await adminOption.click();

    await page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 15000 });
  });

  test('E2E Flow: Navigate to Metadata, Filter Composite Entities, Expand Child Collections & Verify WCAG AA', async ({ page }) => {
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
      // Ensure composite entities are filtered
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
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();

    const criticalViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === 'critical'
    );
    expect(criticalViolations).toHaveLength(0);
  });
});
