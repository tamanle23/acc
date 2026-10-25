# Walkthrough 100: Person Tenant Registration, OTP Verification, Passkeys, and Password Rotation

**App:** `@acc/console`  
**Date:** 2026-10-25  
**Version:** Iteration 23  

---

## 1. Overview
Implemented frontend authentication workflows for person tenant auto-provisioning, 6-digit OTP verification with timer and error shake animation, FIDO2/WebAuthn passkey authentication, mandatory password rotation modal for expired credentials, and synchronized Unified Sandbox handlers.

## 2. Changes Made
1. **Person Registration Form (`sign-up-form.tsx`)**:
   - Wired form submission to `POST /api/v1/auth/signup/person`.
   - Added loading spinner and error toast handling via `sonner`.
   - On success, redirects to `/otp` passing registered email in query parameters.
2. **OTP Verification Form (`otp-form.tsx`)**:
   - Wired code verification to `POST /api/v1/auth/verify-otp`.
   - Implemented auto-submit when all 6 digits are entered.
   - Added `animate-shake` on invalid code submission.
   - Added 60-second cooldown timer for resend request (`POST /api/v1/auth/resend-otp`).
   - Stored returned `accessToken` and `refreshToken` in `useSpringAuthStore`.
3. **Passkeys & Sign-In Form (`user-auth-form.tsx`)**:
   - Added "Sign in with Passkey / Security Key" button.
   - Triggered `POST /auth/passkey/login/options` and `navigator.credentials.get()`.
   - Intercepted `PASSWORD_ROTATION_REQUIRED` / `CREDENTIALS_EXPIRED` to trigger `PasswordRotationModal`.
4. **Mandatory Password Rotation Modal (`password-rotation-modal.tsx`)**:
   - Created modal requiring current password and new password meeting enterprise complexity rules.
   - Posts to `POST /api/v1/auth/password/rotate`.
5. **Unified Sandbox Parity (`auth-sandbox-handler.ts`)**:
   - Registered sandbox endpoints for `/auth/signup/person`, `/auth/verify-otp`, `/auth/resend-otp`, `/auth/passkey/login/options`, `/auth/passkey/login/verify`, and `/auth/password/rotate`.
   - Synchronized sandbox users with canonical roles (`ROLE_SYSTEM_ROOT`, `ROLE_SYSTEM_SUPPORT`, `ROLE_WORKSPACE_OWNER`, `ROLE_STANDARD_MEMBER`).
6. **Permissions Hook (`use-permissions.ts`)**:
   - Exposed reactive role and authority flags: `isSovereignRoot`, `isSovereignSupport`, `isSovereignVerifier`, `isSovereignApprover`, `isWorkspaceOwner`, `isOperationsManager`, `isStandardMember`, `isAuditor`, `canVerifyTasks`, `canApproveQuorum`.

## 3. Verification
- `pnpm --filter @acc/console exec tsc --noEmit` exited with code 0 (zero type errors).
- Client tests passed cleanly.
