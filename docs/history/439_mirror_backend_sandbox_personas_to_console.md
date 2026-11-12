# 439: Mirror Backend Sandbox Personas to Console's Sandbox

## Problem
The backend sandbox (`apps/api/acc-sandbox`) defined authoritative personas in `SandboxPersonaRegistry.java` and `SandboxUserSeeder.java` with canonical credentials, email usernames (`admin@acc.io`, `custodian@system`, `creator@acc.io`, `user@acc.io`), default tenant `tenant-acme` (and `SYSTEM`), and specific authorities/roles (`ROLE_ADMIN`, `ROLE_SYSTEM_SUPPORT`).
In contrast, the frontend console sandbox (`apps/console/src/core/sandbox` and `packages/sandbox`) drifted with differing usernames (`admin_bypass`, `custodian_root`), regional mock tenants (`tenant-us-east-1`, `tenant-eu-central-1`, `tenant-us-west-2`), missing aliases, and lack of bi-directional synchronization between the console Zustand store and the `@acc/sandbox` store manager. When running in dev sandbox against the backend or in local mock mode, mismatched tenant IDs and persona credentials caused 401/403 or empty record sets.

## Plan
1. Update `SandboxPersona` interfaces in both `packages/sandbox/src/types.ts` and `apps/console/src/core/sandbox/types.ts` to include `actorTenantId`, `uid`, and `aliases`.
2. Align `DEFAULT_SANDBOX_PERSONAS` in both `packages/sandbox/src/store.ts` and `apps/console/src/core/sandbox/store/sandbox-store.ts` to mirror the backend's canonical properties (`admin@acc.io`, `custodian@system`, `creator@acc.io`, `user@acc.io`, `defaultTenantId: 'tenant-acme'`, roles, and UIDs).
3. Update `initialDefaultState` and `initialDefaultSandboxState` to default to `activeTenantId: 'tenant-acme'`.
4. Enhance `resolveSandboxPersona` in `packages/sandbox/src/handlers/auth-sandbox-handler.ts` to resolve personas by canonical email or any registered alias (`admin_bypass`, `custodian_root`, etc.) and support both `password` and `bypass` credentials.
5. Bi-directionally synchronize `useSandboxStore` actions (`setEnabled`, `setActivePersona`, `setActiveTenant`, `resetToDefaults`) with `@acc/sandbox`'s `defaultSandboxStore`.
6. Ensure JWT token generation in `UnifiedSandboxManager.syncPersonaAuthTokens` populates claims (`sub`, `personaId`, `uid`, `roles`, `tenantId`, `isSandbox`) and decodes user context into `useSpringAuthStore`.
7. Update sandbox unit and integration tests to verify 100% parity across packages and console.

## Changes
- **`packages/sandbox/src/types.ts` & `apps/console/src/core/sandbox/types.ts`**: Added `actorTenantId`, `uid`, and `aliases` to `SandboxPersona`.
- **`packages/sandbox/src/store.ts` & `apps/console/src/core/sandbox/store/sandbox-store.ts`**: Mirrored backend personas from `SandboxPersonaRegistry.java`:
  - `system`: `custodian@system` (aliases: `custodian_root`, `system`, etc.), `tenantId: 'SYSTEM'`, `actorTenantId: 'SYSTEM'`, `uid: 'usr_sandbox_custodian_001'`.
  - `admin`: `admin@acc.io` (aliases: `admin_bypass`, `admin`, etc.), `tenantId: 'tenant-acme'`, `uid: 'usr_sandbox_admin_001'`, roles include `ROLE_ADMIN`.
  - `creator`: `creator@acc.io` (aliases: `creator_bypass`, `creator`, etc.), `tenantId: 'tenant-acme'`, `uid: 'usr_sandbox_creator_001'`.
  - `user`: `user@acc.io` (aliases: `user_bypass`, `user`, etc.), `tenantId: 'tenant-acme'`, `uid: 'usr_sandbox_user_001'`.
  - Synchronized `useSandboxStore` with `defaultSandboxStore`.
- **`packages/sandbox/src/tenant-auth.ts`**: Enabled fallback to active sandbox store persona and tenant context for direct/internal dispatch without an explicit Bearer header.
- **`packages/sandbox/src/handlers/auth-sandbox-handler.ts`**: Added multi-alias persona resolver `resolveSandboxPersona`, allowed password `"password"` and `"bypass"`, and enriched session claims on `/auth/me` and `/user/profile`.
- **`packages/sandbox/src/handlers/metadata-sandbox-handler.ts`**: Aligned metadata tenant resolution, faceted query support, and record tenant assignment.
- **`apps/console/src/core/sandbox/manager/sandbox-manager.ts`**: Propagated active tenant header when unsupplied and populated JWT claims with `personaId`, `uid`, and canonical username.
- **`apps/console/src/features/spring-auth/store.ts`**: Populated fallback decoded user profile in `setTokens` so session state is immediately reactive upon persona switch.

## Verification
- Executed `pnpm --filter @acc/sandbox test`: 11 test files, 103/103 tests passed.
- Executed `pnpm --filter @acc/console test src/core/sandbox`: 10 test files, 65/65 tests passed.
- Executed `pnpm --filter @acc/console test src/components/auth/__tests__/permission-guard.test.tsx`: 7/7 tests passed.

## Walkthrough
1. Persona Switching: Selecting any persona in the Sandbox Dock or URL parameter immediately sets both the canonical email (`admin@acc.io`, `creator@acc.io`, etc.) and the backend-aligned default tenant (`tenant-acme` or `SYSTEM`).
2. Authentication Compatibility: The frontend sandbox accepts logins using either canonical emails or legacy bypass aliases with password `"bypass"` or `"password"`.
3. Offline & Live Parity: Client-side route handlers and live backend sandbox databases now share identical tenant partitioning (`tenant-acme`) and persona identities.

## Tasks
- [x] Mirror backend persona schemas, UIDs, and aliases.
- [x] Align default tenant to `tenant-acme` across store and handlers.
- [x] Support canonical emails and bypass aliases in auth mock handler.
- [x] Bi-directional sync between `useSandboxStore` and `defaultSandboxStore`.
- [x] Verify all 175 tests pass across `@acc/sandbox` and `@acc/console`.

## Enhancement
Add automated schema/contract verification test between `SandboxPersonaRegistry.java` and `DEFAULT_SANDBOX_PERSONAS` in CI to prevent future attribute drift.
