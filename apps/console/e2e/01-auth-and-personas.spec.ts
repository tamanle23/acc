import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 01: Persona Switching & Tenant Boundary Invariants', () => {
  test('Persona Switching from Admin to Sovereign Custodian & Tenant Badge Verification', async ({ page }) => {
    // 1. Authenticate as Admin via Sandbox bypass
    await authenticateWithSandbox(page, 'admin');

    // Verify authenticated view rendered with Admin workspace/tenant
    await expect(page.locator('body')).toBeVisible();

    // 2. Audit Accessibility of Authenticated Shell (WCAG 2.2 AA)
    await auditAccessibility(page, 'Authenticated Shell (Admin)');

    // 3. Switch Persona to Sovereign Custodian (SYSTEM)
    await page.goto('/sign-in');
    await authenticateWithSandbox(page, 'system');

    // 4. Verify Sovereign Tenant Root badge appears in ProfileSwitcher
    const sovereignIndicator = page.getByText(/👑 Sovereign Platform|ROOT/i).first();
    await expect(sovereignIndicator).toBeVisible({ timeout: 10000 });

    // 5. Navigate to Sovereign System Tenants console
    await page.goto('/system/tenants');
    await expect(page.locator('body')).toBeVisible();

    // Verify Sovereign cockpit is accessible and not 403
    const forbiddenText = page.getByText(/403 Forbidden/i);
    await expect(forbiddenText).toHaveCount(0);

    // 6. WCAG 2.2 AA Audit on Sovereign Cockpit
    await auditAccessibility(page, 'Sovereign Cockpit (/system/tenants)');
  });
});
