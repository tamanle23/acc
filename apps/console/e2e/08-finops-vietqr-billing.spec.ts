import { test, expect } from '@playwright/test';
import { authenticateWithSandbox } from './helpers/auth-helper';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 08: FinOps VietQR Billing & Subscription Upgrade', () => {
  test('Verify Plan Pricing Selector, VietQR Payment Modal & Webhook Simulation', async ({ page }) => {
    // 1. Authenticate as Admin
    await authenticateWithSandbox(page, 'admin');

    // 2. Navigate to Settings Billing route
    await page.goto('/settings/billing');
    await expect(page.locator('body')).toBeVisible();

    // 3. Verify Billing & Subscriptions content renders
    const heading = page.locator('h1, h2, h3').filter({ hasText: /Billing & Subscriptions|Chọn gói cước/i }).first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    // 4. Trigger Upgrade via VietQR modal
    const upgradeBtn = page.getByRole('button', { name: /Nâng cấp qua VietQR/i }).first();
    await expect(upgradeBtn).toBeVisible({ timeout: 10000 });
    await upgradeBtn.click();

    // 5. Verify VietQR Dialog opens with dynamic checkout details
    const dialog = page.locator('[role="dialog"]').filter({ hasText: /payOS|VietQR|Napas247/i }).first();
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Verify simulate webhook button exists
    const simulateBtn = dialog.getByRole('button', { name: /Xác nhận đã chuyển khoản/i });
    await expect(simulateBtn).toBeVisible();

    // 6. WCAG 2.2 AA accessibility audit on open VietQR modal
    await auditAccessibility(page, 'FinOps VietQR Payment Modal (/settings/billing)');

    // 7. Simulate payment confirmation
    await simulateBtn.click();

    // Verify success state or message
    await expect(page.locator('text=Nâng cấp thành công!').or(page.locator('text=thành công'))).toBeVisible({ timeout: 10000 });

    // Close modal
    const closeBtn = dialog.getByRole('button', { name: /Đóng/i }).first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    // 8. WCAG 2.2 AA accessibility audit on main billing page
    await auditAccessibility(page, 'FinOps Billing Panel (/settings/billing)');
  });
});
