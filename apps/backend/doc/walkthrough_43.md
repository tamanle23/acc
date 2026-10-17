# Walkthrough 43: Backend Unified Sandbox Phase 3 - Seamless Persona & Tenancy Transparency

## 1. Overview
In Phase 3 of Iteration 8 ("Backend Unified Sandbox Platform"), we implemented zero-endpoint persona authentication and DEV-mode demonstration data pre-warming. This guarantees that:
- Core sandbox personas (`admin`, `system-custodian`, `creator`, `user`) can authenticate via the standard `/api/auth/token` endpoint and receive genuine, cryptographically-signed JWTs without needing database user records.
- Standard Unipost filters (`JwtAuthenticationTokenFilter`, `TenantSessionAspect`, `HeaderSanitizerFilter`) operate authentically with proper tenant scope (`tenant-acme`, `SYSTEM`), actor impersonation (`actor_tid`), and roles.
- Demonstration tenants (`tenant-acme`, `tenant-us-east-1`) and default blueprints (`bp_crm_billing_v1`) are pre-warmed on startup in `DEV` mode while remaining pristine in `TEST` mode.

## 2. Changes Made

### `apps/backend/unipost-sandbox`
- **`SandboxPersona` & `SandboxPersonaRegistry`**:
  - Implemented persona definition and concurrent registry for:
    - `admin` (`admin@unipost.io`, `admin_bypass`, `admin`, `tenant-admin`) -> `tenant-acme`, `ROLE_ADMIN`, `ROLE_USER`, and full schema/record metadata permissions.
    - `system` (`custodian@system`, `custodian_root`, `system`, `sovereign-custodian@unipost.io`) -> `SYSTEM` tenant, `SYSTEM` actor_tid, `ROLE_SYSTEM_CUSTODIAN`, `ROLE_ADMIN`, `ROLE_USER`.
    - `creator` (`creator@unipost.io`, `creator_bypass`) -> `tenant-acme`, `ROLE_CREATOR`, `ROLE_USER`.
    - `user` (`user@unipost.io`, `user_bypass`) -> `tenant-acme`, `ROLE_USER`.
    - Universal fallback for `password="bypass"`.
- **`SandboxTokenAspect`**:
  - Intercepts `com.unipost.user.service.TokenService.getToken` and `refreshToken` using Spring AOP `@Around`.
  - Mints cryptographically-signed HMAC-SHA512 JWTs using standard `JwtTokenHelper` with complete claims (`sub`, `tid`, `actor_tid`, `authorities`, `userDetails`).
  - Transparently falls through to standard database authentication when non-sandbox users authenticate.
- **`SandboxDataPreWarmer`**:
  - Idempotent `ApplicationReadyEvent` listener active only when `application.sandbox.mode=DEV`.
  - Seeds `TenantBilling` for `tenant-acme` (ENTERPRISE) and `tenant-us-east-1` (PRO).
  - Provisions `bp_crm_billing_v1` blueprint for `tenant-acme` via `TenantProvisioningService`.
- **`SandboxAutoConfiguration`**:
  - Registered `SandboxPersonaRegistry`, `SandboxTokenAspect`, and `SandboxDataPreWarmer`.

### `apps/backend/unipost-ms-identity`
- **`AuthenticationRequestBody`**:
  - Added `@JsonAlias({"username", "user_name"})` on `userName` to support both camelCase and lowercase formats.

## 3. Verification & Results

### Automated Test Suites
1. **`unipost-sandbox` Tests**:
   - `SandboxPersonaRegistryTest`: Verified persona lookups, aliases, and bypass fallbacks.
   - `SandboxTokenAspectTest`: Verified JWT claims, `tid` stamping, and pass-through.
   - `SandboxDataPreWarmerTest`: Verified mode-dependent seeding (TEST skips, DEV provisions).
   - `SandboxDecouplingIntegrationTest`: Verified bean isolation when sandbox is enabled vs disabled.
   - Command: `mvn clean test -f apps/backend/unipost-sandbox/pom.xml -q` (26 tests, 0 failures).

2. **Full Multi-Module Backend Suite**:
   - Command: `mvn test -f apps/backend/pom.xml -q` (300+ tests, all passing, 0 regressions).

3. **Playwright E2E Verification**:
   - Command: `pnpm --filter @unipost/console exec playwright test e2e/01-auth-and-personas.spec.ts --reporter=line` (1 passed in 5.6s).
