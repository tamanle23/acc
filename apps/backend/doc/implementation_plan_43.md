# Implementation Plan 43: Backend Unified Sandbox Phase 3 - Seamless Persona & Tenancy Transparency

## 1. Problem Statement
Phase 3 of the Unified Sandbox Platform requires seamless persona authentication and pre-warmed demonstration data without introducing synthetic routes (e.g. `/api/v1/sandbox/*`) or compromising production security filters:
1. **Zero-Endpoint Persona Authentication**: The standard `/api/auth/token` endpoint must authenticatably issue valid cryptographic JWTs for core personas (`system-custodian`, `tenant-admin`, `tenant-creator`, `tenant-user`) with matching tenant claims (`tid`, `actor_tid`, `authorities`, `CLAIM_KEY_USER_DETAILS`) when sandbox mode is active, even if the database contains no user rows.
2. **Pre-warmed Seed Data (Dev Mode)**: In `DEV` mode (`application.sandbox.mode=dev`), the application must pre-warm demonstration tenant data (`tenant-acme`, `tenant-us-east-1`), default workspaces, and schemas using `TenantProvisioningService` and `TenantBillingRepository` upon startup via an idempotent `ApplicationReadyEvent` listener. In `TEST` mode, data stays pristine.
3. **Non-Breaking Isolation**: Production flows, RLS session switching (`TenantSessionAspect`), and token filtering (`JwtAuthenticationTokenFilter`) must execute identically and authentically.

## 2. Proposed Architecture & Design

### Components in `acc-sandbox`
1. **`SandboxPersona` & `SandboxPersonaRegistry`**:
   - Maps persona identities to standard claims:
     - `ADMIN`: `admin@acc.io`, `admin_bypass`, `admin`, `tenant-admin` -> tenant: `tenant-acme`, roles: `ROLE_ADMIN`, `ROLE_USER`, full metadata CRUD authorities.
     - `SYSTEM_CUSTODIAN`: `custodian@system`, `custodian_root`, `system`, `sovereign-custodian@acc.io`, `system-custodian` -> tenant: `SYSTEM`, actor_tid: `SYSTEM`, roles: `ROLE_SYSTEM_CUSTODIAN`, `ROLE_ADMIN`, `ROLE_USER`.
     - `CREATOR`: `creator@acc.io`, `creator_bypass`, `creator`, `tenant-creator` -> tenant: `tenant-acme`, roles: `ROLE_CREATOR`, `ROLE_USER`.
     - `USER`: `user@acc.io`, `user_bypass`, `user`, `tenant-user` -> tenant: `tenant-acme`, roles: `ROLE_USER`.
2. **`SandboxTokenAspect`**:
   - AOP `@Around` interceptor on `com.acc.user.service.TokenService.getToken(..)` and `refreshToken(..)`.
   - If `request.getBody().getUserName()` matches a sandbox persona or password is `"bypass"`:
     - Generates cryptographically-signed JWT via `JwtTokenHelper.getAuthenticationToken(...)` with exact claims.
     - Wraps in standard `ResponseWrapper.success(token)`.
   - If not a sandbox persona:
     - Proceeds to normal database authentication via `pjp.proceed()`.
3. **`SandboxDataPreWarmer`**:
   - Implements `ApplicationListener<ApplicationReadyEvent>`.
   - Executes only when `application.sandbox.enabled=true` AND `application.sandbox.mode=dev`.
   - Idempotently ensures `TenantBilling` exists for `tenant-acme` and `tenant-us-east-1`.
   - Provisions default blueprint (`bp_crm_billing_v1`) for `tenant-acme` if not already provisioned.
4. **`AuthenticationRequestBody` Jackson Alias**:
   - Ensure `@JsonAlias({"username", "user_name"})` on `userName` in `AuthenticationRequestBody` to support both camelCase and lowercase formats seamlessly.

## 3. Verification Plan
- Unit test suite for `SandboxPersonaRegistry`, `SandboxTokenAspect`, and `SandboxDataPreWarmer` in `acc-sandbox`.
- Slice integration test verifying `/api/auth/token` standard authentication for all 4 personas without synthetic endpoints.
- Full backend build and test suite: `mvn test -f apps/backend/pom.xml -q`.
- Decoupling verification: `SandboxDecouplingIntegrationTest`.
