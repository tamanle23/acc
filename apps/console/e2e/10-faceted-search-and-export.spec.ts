import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 10: Faceted Search & JSON Export', () => {
  test('Verify Customer Accounts Faceted Search, Filters & Export Trigger', async ({ page }) => {
    // 1. Authenticate as Admin
    await authenticateWithSandbox(page, 'admin');

    // 2. Navigate to Customer Accounts Explorer route
    await page.goto('/customer-accounts');
    await expect(page.locator('body')).toBeVisible();

    // 3. Verify Customer Accounts heading & Data Explorer Grid
    const heading = page.locator('h1').filter({ hasText: /Customer Accounts/i });
    await expect(heading).toBeVisible({ timeout: 15000 });

    // 4. Verify Facets sidebar and toggle button
    const facetsToggle = page.getByRole('button', { name: 'Toggle Faceted Search sidebar' });
    await expect(facetsToggle).toBeVisible({ timeout: 10000 });

    // 5. Verify records table renders
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });

    // 6. Verify Export JSON button is present and enabled
    const exportBtn = page.getByRole('button', { name: 'Export entity records as JSON' });
    await expect(exportBtn).toBeVisible({ timeout: 10000 });
    await expect(exportBtn).toBeEnabled();

    // 7. Automated WCAG 2.2 AA Accessibility Audit on Faceted Search & Data Explorer
    await auditAccessibility(page, 'Customer Accounts Faceted Search & Explorer (/customer-accounts)');
  });
});
