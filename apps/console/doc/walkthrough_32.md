# Walkthrough: Hide Auth Sandbox Engine Unless Logged In Via Sandbox Bypass

## Overview
Configured the `@acc/console` authentication system and developer tools so that the **"Auth Sandbox Engine"** panel (`<SandboxPanel />`) is hidden at all times by default, appearing exclusively when a user authenticates using the **"Bypass with sandbox"** action.

---

## Key Changes

### 1. Spring Security Auth Store & Types
* **[`types.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/spring-auth/types.ts)**:
  - Extended `JwtPayload` to include optional `isSandbox?: boolean`.
  - Extended `AuthState` to include `isSandbox: boolean`.
* **[`store.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/spring-auth/store.ts)**:
  - Initialized `isSandbox: false`.
  - In `setTokens(access, refresh)`, set `isSandbox` to `true` if any indicator signals sandbox bypass (`user?.isSandbox`, mock signature suffix `.mock_signature`, or `mock_refresh_token_` prefix).
  - In `clearTokens()`, cleanly reset `isSandbox: false`.

### 2. Sandbox Mock Engine
* **[`mock-engine.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/spring-auth/sandbox/mock-engine.ts)**:
  - Included `isSandbox: true` in the minted mock JWT payload on both sandbox bypass login (`/api/auth/token`) and silent refresh (`/api/auth/refresh`).

### 3. Sandbox Panel Conditional Rendering
* **[`SandboxPanel.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/spring-auth/components/SandboxPanel.tsx)**:
  - Added visibility guard:
    ```tsx
    if (!isAuthenticated || !isSandbox) {
      return null;
    }
    ```
  - Removed unauthenticated placeholder text, keeping the interface completely clean and invisible for standard users and visitors.

### 4. Fixes & TypeScript Validation
* **[`user-auth-form.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/auth/sign-in/components/user-auth-form.tsx)**:
  - Corrected `handleSandboxBypass` role parameter type from `'administrator' | 'creator' | 'user'` to `'admin' | 'creator' | 'user'`.
* **[`vite.config.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/vite.config.ts)**:
  - Fixed proxy target to safely read `process.env.VITE_API_BASE_URL || 'http://localhost:8080'`.

---

## Verification Results

### Automated Verification
* **TypeScript Compilation**:
  `pnpm --filter @acc/console exec tsc -b` exited with code `0`.
* **Application Bundling**:
  `pnpm --filter @acc/console build` successfully built both web (`dist/web`) and electron-web (`dist/electron-web`) bundles without errors.

### Behavioral Verification
1. **Unauthenticated visitor**: `<SandboxPanel />` returns `null`, no floating card is rendered.
2. **Normal user login**: Real JWT without sandbox flags leaves `isSandbox = false`, keeping `<SandboxPanel />` hidden.
3. **Sandbox bypass login**: Clicking "Bypass with Sandbox..." mints a mock token with `isSandbox: true`, immediately displaying the Liquid Glass Auth Sandbox Engine panel with JWT inspection and token manipulation actions.
4. **Hard Logout / Token clearing**: Resets `isSandbox: false`, hiding the panel immediately.
5. **Page Refresh / Hydration**: Refreshes session via mock refresh token, retaining `isSandbox: true` and keeping the panel visible.
