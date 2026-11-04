# 431. Fix Console Login Session Hydration and Route Guard Bounce

## Problem
Following the elimination of client-side JWT cracking and consolidation to opaque bearer tokens with `GET /api/auth/me`, users logging into `apps/console` (via standard credentials, passkeys, or sandbox bypass) experienced a defect where the login success notification was displayed, yet the UI remained stuck on the `/sign-in` page.

### Root Cause Analysis
1. **Asynchronous Profile Omission during Login**:
   `UserAuthForm.onSubmit`, `handlePasskeySignIn`, and `handleSandboxBypass` invoked `setTokens(accessToken, refreshToken)` and immediately triggered `navigate({ to: targetPath, replace: true })`. While `setTokens` stored tokens and marked `isAuthenticated: true`, `user: AuthenticationProfile | null` was left as `null`.
2. **Premature Route Guard Ejection in `ProtectedRoute`**:
   `ProtectedRoute` checked `isHydrating = !useSpringAuthStore.persist.hasHydrated()`. Since Zustand persist storage rehydration finished synchronously, `isHydrating` was `false`. As `user` remained `null`, the condition `(!isAuthenticated || !user)` evaluated to `true`, triggering `navigate({ to: '/sign-in', replace: true })` immediately upon route entry and kicking the user straight back to `/sign-in`.
3. **Response Body Extraction Gap**:
   `fetchAuthenticationProfile()` returned `response.data` directly, which did not account for Spring Boot's standard `ResponseWrapper<ContextHeader, AuthenticationProfileDto>` payload (`response.data.body`).
4. **Missing App-Level Session Hydration**:
   `useAuthHydration` was never mounted at the app root in `__root.tsx`, leaving direct browser refreshes and new tab visits without automated `/auth/me` session profile restoration.

## Plan
1. **Hydrate Profile on Login**: In `user-auth-form.tsx`, await `fetchAuthenticationProfile()` and invoke `setUser(profile)` immediately after `setTokens` across standard login, passkeys, and sandbox bypass.
2. **Resilient `ProtectedRoute` Guard**: In `ProtectedRoute.tsx`, treat sessions with tokens but pending `user` profiles or active `isHydrating` state as hydrating (`isPendingAuth`), presenting the loading spinner rather than prematurely bouncing to `/sign-in`.
3. **Handle ResponseWrapper Payloads**: In `api-client.ts`, update `fetchAuthenticationProfile()` to extract `data?.body || data`.
4. **Mount Session Hydration in App Root**: In `__root.tsx`, mount `useAuthHydration()` and update the hook to hook into `persist.onFinishHydration()` to restore sessions reliably across reloads.
5. **Sign-In Route Bypass**: In `routes/(auth)/sign-in.tsx`, add a `beforeLoad` guard redirecting already authenticated sessions (`isAuthenticated && user && accessToken`) directly to `/dashboard`.

## Changes
- `apps/console/src/features/spring-auth/api-client.ts`: Extract `data?.body || data` in `fetchAuthenticationProfile()`.
- `apps/console/src/features/spring-auth/store.ts`: Ensure `setUser()` and `clearTokens()` reset `isHydrating: false`.
- `apps/console/src/features/spring-auth/hooks/use-auth-hydration.ts`: Wire into `persist.onFinishHydration()`.
- `apps/console/src/features/spring-auth/components/ProtectedRoute.tsx`: Protect against premature ejection when tokens are present but profile is hydrating.
- `apps/console/src/routes/__root.tsx`: Mount `useAuthHydration()` in `RootComponent`.
- `apps/console/src/features/auth/sign-in/components/user-auth-form.tsx`: Await `fetchAuthenticationProfile()` and set `user` before route navigation.
- `apps/console/src/routes/(auth)/sign-in.tsx`: Add `beforeLoad` redirect to `/dashboard` for active sessions.
- `apps/console/src/features/auth/sign-in/components/__tests__/user-auth-form.test.tsx`: Added comprehensive unit tests for form submission, passkey, and sandbox bypass profile hydration.
- `apps/console/src/features/spring-auth/components/__tests__/protected-route.test.tsx`: Added unit tests verifying loading state while tokens exist and profile is pending hydration.

## Verification
- Unit & integration tests passed across `@acc/console`:
  - `src/features/spring-auth/components/__tests__/protected-route.test.tsx` (7 tests passed)
  - `src/features/auth/sign-in/components/__tests__/user-auth-form.test.tsx` (5 tests passed)
  - Full suite `src/features/spring-auth/` & `src/features/auth/` (30 tests passed in 2.36s)
- TypeScript verification passed: `pnpm --filter @acc/console exec tsc --noEmit` exited code 0 with 0 errors.

## Walkthrough
1. **User Sign In (Standard/Sandbox/Passkey)**:
   - User inputs credentials or clicks "Bypass with Sandbox..."
   - Token request succeeds; tokens are stored in `useSpringAuthStore`.
   - `fetchAuthenticationProfile()` requests `GET /api/auth/me`.
   - Resulting `AuthenticationProfile` is saved to store via `setUser(profile)`.
   - Success toast appears and router navigates to `/dashboard`.
   - `ProtectedRoute` sees `isAuthenticated: true` and non-null `user`, rendering `AuthenticatedLayout` smoothly without flashing or redirecting back.
2. **Page Refresh / Direct Navigation**:
   - `useAuthHydration` loads stored tokens and restores the security profile.
   - If tokens are present, `ProtectedRoute` renders a spinner until profile is validated, then reveals protected routes.

## Tasks
- [x] Unify Spring `ResponseWrapper` extraction in `fetchAuthenticationProfile`.
- [x] Populate `useSpringAuthStore.user` before navigation in `UserAuthForm`.
- [x] Fix premature route ejection in `ProtectedRoute`.
- [x] Wire `useAuthHydration` into `__root.tsx`.
- [x] Add automated test coverage and verify zero regressions.

## Enhancement
- Add optional offline persona caching for low-connectivity sandbox diagnostics.
