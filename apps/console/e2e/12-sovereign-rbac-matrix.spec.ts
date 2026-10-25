import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 12: Sovereign RBAC Permission Matrix Studio & Global User Directory', () => {
  test('Inspect RBAC Matrix Studio and Global User Directory under Sovereign Custody', async ({ page }) => {
    // 1. Authenticate as Sovereign Root Custodian ('system' persona)
    await authenticateWithSandbox(page, 'system');

    // 2. Navigate to System Roles route (/system/roles)
    await page.goto('/system/roles');
    await expect(page.locator('body')).toBeVisible();

    // 3. Verify Sovereign RBAC Matrix Studio heading
    const heading = page.locator('h1, h2').filter({ hasText: /RBAC|Role|Permission Matrix/i }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    // 4. Verify canonical Sovereign & Tenant roles appear in list or grid
    const sovereignRoleBadge = page.locator('body').filter({
      hasText: /Sovereign Root Custodian|ROLE_SYSTEM_ROOT|ROLE_WORKSPACE_OWNER|Standard Member/i,
    }).first();
    await expect(sovereignRoleBadge).toBeVisible({ timeout: 10000 });

    // 5. Audit Accessibility of RBAC Studio (WCAG 2.2 AA)
    await auditAccessibility(page, 'Sovereign RBAC Matrix Studio (/system/roles)');

    // 6. Switch to Global Users tab if tabs exist
    const usersTab = page.getByRole('tab', { name: /Users|Global Users/i });
    if (await usersTab.isVisible()) {
      await usersTab.click();
      await expect(page.locator('table, [role="grid"]').first()).toBeVisible({ timeout: 10000 });
      await auditAccessibility(page, 'Sovereign Global Users Directory (/system/roles?tab=users)');
    }
  });

  test('Access Control Barrier: Non-Sovereign Access Denied to /system/roles', async ({ page }) => {
    // 1. Authenticate as Standard User
    await authenticateWithSandbox(page, 'user');

    // 2. Attempt direct navigation to Sovereign RBAC route
    await page.goto('/system/roles');

    // 3. Verify access is guarded or redirected
    const isGuarded =
      page.url().includes('/sign-in') ||
      page.url() === 'http://localhost:5173/' ||
      (await page.getByText(/403|Forbidden|Unauthorized|Access Denied/i).count()) > 0;

    expect(isGuarded).toBe(true);
  });
});
