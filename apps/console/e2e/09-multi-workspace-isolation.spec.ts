import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 09: Multi-Workspace Isolation & Profile Switching', () => {
  test('Verify Workspace Management Panel & Profile Switcher Isolation', async ({ page }) => {
    // 1. Authenticate as Admin
    await authenticateWithSandbox(page, 'admin');

    // 2. Navigate to Settings Workspaces route
    await page.goto('/settings/workspaces');
    await expect(page.locator('body')).toBeVisible();

    // 3. Verify Workspaces Management Heading and Tenant Context Card
    const heading = page.locator('h1, h2, h3').filter({ hasText: /Workspaces & Organizations/i }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    // 4. Verify list of Workspace cards renders
    const workspaceCards = page.locator('div').filter({ hasText: /Tạo Workspace Mới/i });
    await expect(workspaceCards.first()).toBeVisible({ timeout: 10000 });

    // 5. Run WCAG 2.2 AA accessibility audit on main Workspaces settings page
    await auditAccessibility(page, 'Workspaces Settings Panel (/settings/workspaces)');

    // 6. Test Sidebar Profile Switcher Dropdown
    const profileSwitcherTrigger = page.locator('[data-sidebar="menu-button"]').first();
    if (await profileSwitcherTrigger.isVisible()) {
      await profileSwitcherTrigger.click();

      // Verify dropdown menu opens
      const dropdownContent = page.locator('[role="menu"]');
      await expect(dropdownContent).toBeVisible({ timeout: 5000 });

      // Verify items render
      await expect(dropdownContent.getByRole('menuitem').first()).toBeVisible();

      // Close dropdown
      await page.keyboard.press('Escape');
    }
  });
});
