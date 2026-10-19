# 135: Backend Unified Sandbox Platform: Seamless Persona & Tenancy Transparency (Iteration 8 Phase 3)

## Problem
In Phase 3 of Iteration 8 ("Backend Unified Sandbox Platform"), developers and automated test suites required:
1. **Zero-Endpoint Persona Authentication**: The standard `/api/auth/token` endpoint must issue valid, cryptographically-signed JWTs for standard sandbox personas (`admin@unipost.io`, `custodian@system`, `creator@unipost.io`, `user@unipost.io`) without requiring user rows in the database or synthetic `/api/v1/sandbox/*` routes.
2. **Authentic Security Pipeline Execution**: Incoming requests using these tokens must pass through all authentic production filters (`JwtAuthenticationTokenFilter`, `TenantSessionAspect`, `HeaderSanitizerFilter`) and properly set `tenantId` (`tenant-acme`, `SYSTEM`), actor impersonation (`actor_tid`), and authorities.
3. **Pre-warmed Seed Data in DEV Mode**: When booted in `DEV` mode (`application.sandbox.mode=dev`), the platform must pre-warm demonstration tenants (`tenant-acme`, `tenant-us-east-1`) and default workspaces and schemas via blueprints, while keeping database state pristine in `TEST` mode.

## Plan
1. Implement `SandboxPersona` and `SandboxPersonaRegistry` in `com.unipost.sandbox.auth` mapping usernames, aliases, and universal `'bypass'` passwords to authoritative claims.
2. Implement `SandboxTokenAspect` using Spring AOP `@Around` on `com.unipost.user.service.TokenService.getToken` and `refreshToken` to dynamically issue cryptographic JWTs using `JwtTokenHelper.getAuthenticationToken(...)`.
3. Implement `SandboxDataPreWarmer` as an `ApplicationReadyEvent` listener to idempotently seed `TenantBilling` records and provision `bp_crm_billing_v1` via `TenantProvisioningService` in `DEV` mode.
4. Support `@JsonAlias({"username", "user_name"})` on `AuthenticationRequestBody` to accept various client casing patterns.
5. Verify with unit tests, slice integration tests, multi-module backend test suite, and Playwright Flow 01.

## Changes

### `apps/backend/unipost-sandbox`
- **`com.unipost.sandbox.auth.SandboxPersona`**:
  - Immutable record defining `id`, `name`, `username`, `defaultTenantId`, `actorTenantId`, `roles`, `authorities`, and `uid`.
- **`com.unipost.sandbox.auth.SandboxPersonaRegistry`**:
  - Registers `admin`, `system` (Sovereign Custodian), `creator`, and `user` personas with aliases.
  - Supports universal `'bypass'` password fallback.
- **`com.unipost.sandbox.auth.SandboxTokenAspect`**:
  - `@Around` advice on `TokenService.getToken` and `TokenService.refreshToken`.
  - Mints genuine HMAC-SHA512 JWTs with `tid`, `actor_tid`, `CLAIM_KEY_USER_DETAILS`, and `authorities`.
  - Pass-through execution for non-sandbox identities.
- **`com.unipost.sandbox.seed.SandboxDataPreWarmer`**:
  - Pre-warms `TenantBilling` (ENTERPRISE / PRO) and provisions `bp_crm_billing_v1` on startup when `application.sandbox.mode=dev`.
- **`com.unipost.sandbox.config.SandboxAutoConfiguration`**:
  - Registered `SandboxPersonaRegistry`, `SandboxTokenAspect`, and `SandboxDataPreWarmer` beans.

### `apps/backend/unipost-ms-identity`
- **`AuthenticationRequestBody`**:
  - Added `@JsonAlias({"username", "user_name"})` on `userName`.

## Verification
- **Unit & Slice Tests**:
  - `SandboxPersonaRegistryTest`: 5 test cases passing.
  - `SandboxTokenAspectTest`: 3 test cases passing.
  - `SandboxDataPreWarmerTest`: 2 test cases passing.
  - `SandboxDecouplingIntegrationTest`: 3 test cases passing.
  - `mvn clean test -f apps/backend/unipost-sandbox/pom.xml -q`: 26/26 tests passing in 8s.
- **Full Backend Regression Suite**:
  - `mvn test -f apps/backend/pom.xml -q`: 300+ tests passing across all backend modules with JaCoCo $\ge 90\%$.
- **Playwright E2E Verification**:
  - `pnpm --filter @unipost/console exec playwright test e2e/01-auth-and-personas.spec.ts --reporter=line`: 1/1 passed in 5.6s.

## Walkthrough
Refer to [`apps/backend/doc/walkthrough_43.md`](../../apps/backend/doc/walkthrough_43.md) for full architectural details and code samples.

## Tasks
- [x] Establish persona specifications and claims matrix
- [x] Implement SandboxPersonaRegistry with alias and bypass fallback
- [x] Implement SandboxTokenAspect AOP token generator
- [x] Implement SandboxDataPreWarmer for DEV mode demonstration data
- [x] Add JsonAlias to AuthenticationRequestBody
- [x] Verify decoupling and full test suites

## Enhancement
- In Phase 4, establish formal PGlite RLS query integration tests (`PgLiteRlsIntegrationTest`) to assert in-memory PostgreSQL RLS tenant isolation under simulated multi-tenant concurrency.
