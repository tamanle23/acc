import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 12: Sovereign RBAC Permission Matrix Studio & Global User Directory', () => {
  test('Inspect RBAC Matrix Studio, Roles Management, and Global User Directory under Sovereign Custody', async ({ page }) => {
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

    // 5. Verify the 3 tabs: Permission Matrix, Roles Management, Universal Users Directory
    const matrixTab = page.getByRole('tab', { name: /Permission Matrix/i });
    const rolesTab = page.getByRole('tab', { name: /Roles Management/i });
    const usersTab = page.getByRole('tab', { name: /Universal Users Directory|Users/i });

    await expect(matrixTab).toBeVisible();
    await expect(rolesTab).toBeVisible();
    await expect(usersTab).toBeVisible();

    // 6. Audit Accessibility of RBAC Studio (WCAG 2.2 AA)
    await auditAccessibility(page, 'Sovereign RBAC Matrix Studio (/system/roles)');

    // 7. Switch to Roles Management tab
    await rolesTab.click();
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });

    // 8. Switch to Global Users tab
    await usersTab.click();
    await expect(page.locator('table').first()).toBeVisible({ timeout: 10000 });
    await auditAccessibility(page, 'Sovereign Global Users Directory (/system/roles?tab=users)');
  });
});
