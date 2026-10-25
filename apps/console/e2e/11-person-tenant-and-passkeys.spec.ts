import { test, expect } from '@playwright/test';
import { auditAccessibility } from './helpers/axe-helper';

test.describe('Flow 11: Person Tenant Onboarding, OTP Verification, and Passkeys', () => {
  test('Person Registration Funnel & OTP Screen Journey', async ({ page }) => {
    // 1. Visit Sign Up Page
    await page.goto('/sign-up');
    await expect(page.getByRole('button', { name: /Create Account/i })).toBeVisible();

    // 2. Audit Accessibility on Sign Up Screen (WCAG 2.2 AA)
    await auditAccessibility(page, 'Person Sign Up Screen');

    // 3. Fill in registration form
    await page.getByLabel(/Email/i).fill('individual-dev@acc.io');
    await page.getByLabel(/^Password/i).fill('SecureP@ssw0rd2026!');
    await page.getByLabel(/Confirm Password/i).fill('SecureP@ssw0rd2026!');

    // 4. Submit Registration
    await page.getByRole('button', { name: /Create Account/i }).click();

    // 5. Verify redirection to OTP verification route with email parameter
    await expect(page).toHaveURL(/\/otp/);
    await expect(page.getByRole('button', { name: /Verify & Sign In/i })).toBeVisible();

    // 6. Audit Accessibility on OTP Screen (WCAG 2.2 AA)
    await auditAccessibility(page, 'OTP Verification Screen');

    // 7. Verify Resend button with active cooldown indicator
    const resendBtn = page.getByRole('button', { name: /Resend code/i });
    await expect(resendBtn).toBeVisible();
  });

  test('Sign In View Passkey Trigger & Accessibility', async ({ page }) => {
    // 1. Visit Sign In Page
    await page.goto('/sign-in');
    await expect(page.getByRole('button', { name: /^Sign in$/i })).toBeVisible();

    // 2. Verify Passkey Biometric Button
    const passkeyBtn = page.getByRole('button', { name: /Sign in with Passkey \/ Security Key/i });
    await expect(passkeyBtn).toBeVisible();

    // 3. Audit Accessibility of Sign In Screen with Passkey Trigger (WCAG 2.2 AA)
    await auditAccessibility(page, 'Sign In Screen with Passkey');
  });
});
