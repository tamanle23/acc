import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 13: Tenant Workspaces, Switcher, and Settings Panel', () => {
  test('Workspaces Management & Creation Modal', async ({ page }) => {
    // 1. Authenticate as Admin
    await authenticateWithSandbox(page, 'admin');

    // 2. Navigate to Workspaces Settings route
    await page.goto('/settings/workspaces');
    await expect(page.locator('body')).toBeVisible();

    // 3. Verify Workspaces heading
    const heading = page.locator('h1, h2, h3').filter({ hasText: /Workspaces|Môi trường/i }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    // 4. Verify immutable default workspace badge
    const defaultBadge = page.locator('body').filter({ hasText: /DEFAULT|Mặc định/i }).first();
    await expect(defaultBadge).toBeVisible({ timeout: 10000 });

    // 5. Open Create Workspace Modal
    const createBtn = page.getByRole('button', { name: /New Workspace|Create Workspace|Tạo/i }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      const modal = page.locator('[role="dialog"]').filter({ hasText: /Workspace|Tạo/i }).first();
      await expect(modal).toBeVisible({ timeout: 10000 });

      // Run WCAG 2.2 AA audit on modal
      await auditAccessibility(page, 'Create Workspace Modal');

      // Dismiss modal
      await page.keyboard.press('Escape');
    }

    // 6. WCAG 2.2 AA Audit on Workspaces Settings Panel
    await auditAccessibility(page, 'Workspaces Settings Panel (/settings/workspaces)');
  });
});
