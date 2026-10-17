import { Page, expect } from '@playwright/test';

export async function authenticateWithSandbox(page: Page, persona: 'admin' | 'system' | 'creator' | 'user' = 'admin') {
  // Ensure sandbox dock is minimized by default so it does not intercept clicks
  await page.addInitScript(() => {
    localStorage.setItem('unipost_unified_sandbox_minimized', 'true');
  });

  await page.goto('/sign-in');

  const bypassBtn = page.getByRole('button', { name: /Bypass with Sandbox/i });
  await expect(bypassBtn).toBeVisible({ timeout: 15000 });
  await bypassBtn.click();

  const pattern = persona === 'system'
    ? /Sovereign Custodian/i
    : persona === 'creator'
    ? /Creator/i
    : persona === 'user'
    ? /Standard User/i
    : /Admin/i;

  const option = page.getByRole('menuitem', { name: pattern });
  await expect(option).toBeVisible({ timeout: 5000 });
  await option.click();

  await page.waitForURL((url) => !url.pathname.includes('/sign-in'), { timeout: 15000 });
  await expect(page.locator('body')).toBeVisible();
}
