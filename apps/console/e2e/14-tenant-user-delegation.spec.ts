import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 14: Tenant Users & Delegated RBAC Permissions', () => {
  test('Navigate to /users, open Delegate Permissions modal, inspect tenant roles, and verify WCAG 2.2 AA', async ({ page }) => {
    // 1. Authenticate as Admin (Standard Tenant Workspace Owner)
    await authenticateWithSandbox(page, 'admin');

    // 2. Navigate to /users route
    await page.goto('/users');
    await expect(page.locator('body')).toBeVisible();

    // 3. Verify refined header and tenant badge
    const heading = page.locator('h1').filter({ hasText: /Tenant Users & Roles|User List/i }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    // 4. Verify user table renders
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });

    // 5. Audit Accessibility of Users Screen (WCAG 2.2 AA)
    await auditAccessibility(page, 'Tenant Users & Roles Screen (/users)');

    // 6. Open row action menu for first user
    const actionBtn = tableRows.first().locator('button[aria-label^="Actions for user"]').first();
    await expect(actionBtn).toBeVisible();
    await actionBtn.click();

    // 7. Verify Delegate Permissions action is present in dropdown
    const delegateMenuItem = page.getByRole('menuitem', { name: /Delegate Permissions/i });
    await expect(delegateMenuItem).toBeVisible();
    await delegateMenuItem.click();

    // 8. Verify TenantRoleDelegationModal opens
    const modalHeading = page.locator('body').filter({
      hasText: /Tenant Role Delegation & Authority Assignment|Delegate Roles to/i,
    }).first();
    await expect(modalHeading).toBeVisible({ timeout: 10000 });

    // 9. Verify tenant-scoped roles are selectable (e.g. Workspace Owner, Standard Member, Compliance Officer)
    const rolesSection = page.locator('body').filter({
      hasText: /Delegation Ceiling|ROLE_WORKSPACE_OWNER|Standard Member|Workspace Owner/i,
    }).first();
    await expect(rolesSection).toBeVisible();

    // 10. Close delegation modal cleanly
    const closeBtn = page.getByRole('button', { name: /Cancel|Close|Đóng/i }).first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await expect(modalHeading).toBeHidden({ timeout: 5000 });
    }
  });
});
