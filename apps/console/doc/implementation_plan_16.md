# Hide Auth Sandbox Engine Unless Logged In Via Sandbox Bypass

## Problem & Background
In `@acc/console`, the `<SandboxPanel />` component ("Auth Sandbox Engine") currently renders in the root layout (`__root.tsx`) at all times. When unauthenticated, it displays a helper note prompting the user to bypass authentication. When authenticated normally, it displays developer controls and the JWT payload.

The requirement is: **"Auth Sandbox Engine" should be hidden always, unless the user logs in with "Bypass with sandbox"**.
- If the user is unauthenticated: hidden.
- If the user logs in via normal credentials (e.g., standard email/password or OAuth): hidden.
- ONLY when the user authenticates using "Bypass with sandbox" (from the Sign-In modal's bypass dropdown): visible.
- Upon logout or session expiration: hidden again.
- On browser reload while in a bypass session: persists and stays visible (via token hydration).

## Proposed Changes

### 1. Spring Auth Types & Store
#### [MODIFY] [types.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/spring-auth/types.ts)
- Add `isSandbox?: boolean` to `JwtPayload`.
- Add `isSandbox: boolean` to `AuthState`.

#### [MODIFY] [store.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/spring-auth/store.ts)
- Initialize `isSandbox: false`.
- In `setTokens(access, refresh)`, determine `isSandbox`:
  ```ts
  const isSandbox = Boolean(
    user?.isSandbox ||
    access?.endsWith('.mock_signature') ||
    refresh?.startsWith('mock_refresh_token_')
  );
  ```
- In `clearTokens()`, reset `isSandbox: false`.

### 2. Sandbox Mock Engine
#### [MODIFY] [mock-engine.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/spring-auth/sandbox/mock-engine.ts)
- Include `isSandbox: true` in the mock JWT payload generated for login and refresh endpoints.

### 3. Sandbox Panel Component
#### [MODIFY] [SandboxPanel.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/spring-auth/components/SandboxPanel.tsx)
- Check `isAuthenticated` and `isSandbox` from `useSpringAuthStore()`.
- Return `null` immediately if `!isAuthenticated || !isSandbox`.
- Clean up the unauthenticated placeholder state since the panel will never be rendered when unauthenticated.

### 4. Fix Sign-In Bypass Typing & Vite Config
#### [MODIFY] [user-auth-form.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/auth/sign-in/components/user-auth-form.tsx)
- Update `handleSandboxBypass` role parameter type from `'administrator' | 'creator' | 'user'` to `'admin' | 'creator' | 'user'` matching the callers and mock engine.

#### [MODIFY] [vite.config.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/vite.config.ts)
- Fix TypeScript error in proxy configuration by replacing `import.meta.env.VITE_API_BASE_URL` with `process.env.VITE_API_BASE_URL || 'http://localhost:8080'`.

## Verification Plan

### Automated Verification
- Run `pnpm --filter @acc/console exec tsc -b` to ensure all TypeScript checks pass cleanly.
- Run `pnpm --filter @acc/console build:web` to ensure clean build bundling.
- Run `pnpm --filter @acc/console lint` to ensure ESLint passes with zero warnings/errors.

### Manual / Behavioral Verification
- Verify initial unauthenticated state: `SandboxPanel` returns `null` (not visible on screen).
- Verify standard login simulation: normal JWT does not flag `isSandbox`, panel remains hidden.
- Verify "Bypass with Sandbox...": clicking "Admin Role (All Access)" marks session as `isSandbox: true` and reveals "Auth Sandbox Engine".
- Verify hard logout: resets tokens and `isSandbox: false`, immediately hiding "Auth Sandbox Engine".
- Verify browser reload while in sandbox bypass: silent refresh maintains `isSandbox: true`, keeping the panel visible.
