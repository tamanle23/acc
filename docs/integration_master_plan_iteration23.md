# Integration Master Plan: Iteration 23 - Sovereign Identity, System-Wide RBAC Delegation, Person-Tenant Onboarding, Passkeys (WebAuthn) & Full-Stack UI Wirings

**Target Systems:**  
- `@acc/backend` (`apps/backend/acc-db`, `apps/backend/acc-fw`, `apps/backend/acc-ms-aio`)  
- `@acc/client` (`packages/client/src/contracts/users.ts`, `packages/client/src/contracts/auth.ts`)  
- `@acc/console` (`apps/console/src/features/auth`, `apps/console/src/features/spring-auth`, `apps/console/src/core/sandbox`)  
**Lead Systems Architect:** Principal Polyglot Architect, Spring Boot Backend Specialist, TypeScript Frontend Architect & UI/UX Systems Specialist  
**Standards:** W3C WebAuthn Level 3 / FIDO2, NIST SP 800-63B AAL2/AAL3, RFC 6238 TOTP, PostgreSQL 16+ RLS, WCAG 2.2 AA, Liquid Glass Design Tokens  
**Reference SSOT:** [`docs/master_database_schema_architecture.md`](master_database_schema_architecture.md) (v1.5.0)  

---

## 1. Executive Summary & Problem Statement

In enterprise multi-tenant systems, the security and authorization plane frequently suffers from **Three Disconnects**:
1. **The Entitlement vs Permission Paradox**: A user in a tenant may hold a permission (e.g. `workspace:create`), but if the tenant's commercial subscription tier does not license that feature, the user must be blocked. Authority is an **intersection** of user permissions, tenant feature entitlements, and PostgreSQL Row-Level Security.
2. **Missing Frontend UI Wirings & Rogue Mock Stubs**: The console authentication views (`sign-up-form.tsx`, `otp-form.tsx`, `forgot-password-form.tsx`) currently log dummy data to `console.log()` or use `setTimeout()`, lacking real backend wire calls, WebAuthn passkey triggers, and Unified Sandbox integration.
3. **Ambiguous Permission Evaluation (Systemwide vs Tenant-Scoped)**: A permission atom like `metadata:schema:read` defines *capability*, while *data scope* is deterministically bounded by **PostgreSQL RLS (`app.current_tenant_id`)** and `TenantContextHolder`.
4. **Person-Tenant Registration & Passkeys**: Lack of automated personal workspace provisioning for individual users (`tenant_id = 'usr-...'`) and absence of modern phishing-resistant passwordless mechanisms (FIDO2 / WebAuthn Passkeys).

Iteration 23 formalizes the **System-Wide RBAC Catalog with Tenant Entitlement Delegation**, **Two-Dimensional Dual-Barrier Authorization**, **Full-Stack UI Wirings across all Auth Views**, **Unified Sandbox Platform Integration**, and **Zero-Secret Fail-Fast Credential Injection**.

```
+-------------------------------------------------------------------------------------------------------------------------+
|                                    FULL-STACK END-TO-END UI WIRINGS & AUTHORIZATION                                     |
+---------------------------------------------------------------+---------------------------------------------------------+
| CONSOLE UI VIEWS (React 19 / TanStack Router)                 | BACKEND SPRING SECURITY & REST APIS                     |
+---------------------------------------------------------------+---------------------------------------------------------+
| [Sign-Up Form]       ──► POST /api/v1/auth/signup/person      │ - Validates RFC 5322 & NIST 800-63B                     |
| [OTP Verification]   ──► POST /api/v1/auth/verify-otp         │ - Verifies 6-digit code -> Auto-provisions Person Tenant|
| [Passkey Trigger]    ──► POST /api/v1/auth/passkey/login/*    │ - W3C WebAuthn challenge & assertion verification       |
| [Forgot/Reset Flow]  ──► POST /api/v1/auth/forgot-password    │ - 15m single-use cryptographically bound token hash     |
| [Password Rotation]  ──► POST /api/v1/auth/rotate-password    │ - Clears credentialsNonExpired on mandatory first-boot  |
+---------------------------------------------------------------+---------------------------------------------------------+
| UNIFIED SANDBOX PLATFORM (auth-sandbox-handler.ts)            | CLIENT SDK CONTRACTS (@acc/client)                  |
+---------------------------------------------------------------+---------------------------------------------------------+
| - Mock Persona Support: root, ops, verifier, approver, owner  | - Type-safe Request / Response DTO contracts            |
| - Seamless Offline Parity: zero blank screens in offline dev  | - Modern erasable types (as const, no legacy enum)      |
+---------------------------------------------------------------+---------------------------------------------------------+
```

---

## 2. Complete Frontend UI Wirings & Component Architecture (`@acc/console`)

All authentication components reside in `apps/console/src/features/auth` and wire directly to `springApiClient` (falling back seamlessly to `authSandboxHandler` in offline sandbox mode).

### 2.1 Sign-Up View Wiring (`apps/console/src/features/auth/sign-up/components/sign-up-form.tsx`)
- **API Endpoint**: `POST /api/v1/auth/signup/person`
- **Payload**:
  ```ts
  interface SignUpPersonRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    workspaceName?: string;
  }
  ```
- **Execution Flow**:
  1. Zod client-side validation (`email` format, password length >= 8, uppercase + number + symbol).
  2. Sets `isLoading = true`, changes primary submit button to `Loader2` state with `t('auth.creating_account', 'Creating Account...')`.
  3. On Success (`HTTP 201 Created` with challenge `OTP_VERIFICATION`):
     - Stores temporary registration context (`userUid`, `email`) in `authStore`.
     - Toast notification: `t('auth.otp_sent', 'Verification code sent to {{email}}')`.
     - Navigates to `/otp` route with state.
  4. On Error (`HTTP 409 Conflict`):
     - Sets field error on `email`: `"An account with this email already exists."`.
     - Surfaces recovery link: `"Already registered? Sign In or Reset Password"`.

---

### 2.2 OTP Verification View Wiring (`apps/console/src/features/auth/otp/components/otp-form.tsx`)
- **API Endpoint**: `POST /api/v1/auth/verify-otp`
- **Payload**:
  ```ts
  interface VerifyOtpRequest {
    userUid: string;
    otp: string;
  }
  ```
- **Execution Flow**:
  1. 6 discrete auto-advancing `InputOTPSlot` cells with clipboard paste handler.
  2. Auto-triggers submission upon entering the 6th digit.
  3. On Success (`HTTP 200 OK`):
     - Receives `accessToken`, `refreshToken`, and personal `tenantId = 'usr-<uuid>'`.
     - `useSpringAuthStore.getState().setTokens(accessToken, refreshToken)`.
     - Toast: `t('auth.verified_welcome', 'Account verified! Welcome to your personal workspace.')`.
     - Navigates to `/` (Personal Dashboard) with full sandbox/live parity.
  4. On Error (`HTTP 401 Unauthorized`):
     - Form shake animation + red border glow (`border-destructive`).
     - Clears OTP input cells, refocuses cell 1.
     - Displays recovery copy: `"Invalid or expired code. {{attemptsRemaining}} attempts remaining."`.
  5. Resend Trigger (`POST /api/v1/auth/resend-otp`):
     - Rate-limited 60-second cooldown timer displayed via `ScreenReaderLiveRegion`.

---

### 2.3 Sign-In View & Passkey Trigger Wiring (`apps/console/src/features/auth/sign-in/components/user-auth-form.tsx`)

#### A. Traditional Password Flow
- **API Endpoint**: `POST /auth/token`
- **Payload**: `{ username: data.email, password: data.password }`
- **Error Handling**:
  - `HTTP 401`: Toast `"Invalid email or password"`.
  - `HTTP 423`: Account locked banner.
  - `HTTP 403` with code `PASSWORD_ROTATION_REQUIRED`: Automatically opens the **Mandatory Password Rotation Modal** (`<PasswordRotationModal />`).

#### B. Passkey (FIDO2 / WebAuthn) Passwordless Flow
- **Trigger**: Click **"Sign in with Passkey"** button.
- **Execution Flow**:
  1. Calls `POST /api/v1/auth/passkey/login/options`.
  2. Calls browser native `navigator.credentials.get({ publicKey: options })`.
  3. Sends `AuthenticatorAssertionResponse` to `POST /api/v1/auth/passkey/login/verify`.
  4. On Success: Stores Dual JWT tokens and immediately routes to dashboard.
  5. On Error / Unsupported: Shows inline alert with seamless fallback to password/OTP.

---

### 2.4 Forgot Password & Reset View Wiring (`apps/console/src/features/auth/forgot-password`)
- **Request Endpoint**: `POST /api/v1/auth/forgot-password` (`{ email }`)
  - Always returns `200 OK` (anti-enumeration). Navigates to confirmation screen.
- **Reset Execution Endpoint**: `POST /api/v1/auth/reset-password`
  - Payload: `{ token: searchParam.token, newPassword, confirmPassword }`.
  - Validates NIST SP 800-63B complexity.
  - On Success: Toast `"Password reset successfully. Please sign in."` -> Routes to `/sign-in`.

---

### 2.5 Mandatory First-Boot Password Rotation Modal (`<PasswordRotationModal />`)
- **Trigger**: Displayed when `useSpringAuthStore` receives `PASSWORD_ROTATION_REQUIRED` (e.g. seeded custodial accounts or expired credentials).
- **Behavior**:
  - Non-dismissible backdrop blur overlay.
  - Inputs: Current/Temporary Password, New Password, Confirm New Password.
  - Calls `POST /api/v1/auth/rotate-password`.
  - On Success: Clears expiration flag, issues fresh Dual JWT, closes modal, and proceeds to dashboard.

---

## 3. Unified Sandbox Platform Parity (`auth-sandbox-handler.ts`)

In accordance with `.agents/rules/02-unified-sandbox.md`, the mock sandbox engine must achieve complete offline parity with the new roles and endpoints:
1. **Update `SANDBOX_AUTH_USERS` & `SANDBOX_REFRESH_TOKENS`**:
   - `custodian_root`: `['ROLE_SYSTEM_ROOT']` (tenant: `SYSTEM`)
   - `support_ops`: `['ROLE_SYSTEM_SUPPORT']` (tenant: `SYSTEM`)
   - `verifier_system`: `['ROLE_SYSTEM_VERIFIER']` (tenant: `SYSTEM`)
   - `approver_system`: `['ROLE_SYSTEM_APPROVER']` (tenant: `SYSTEM`)
   - `workspace_owner`: `['ROLE_WORKSPACE_OWNER']` (tenant: `tenant-acme`)
   - `personal_user`: `['ROLE_WORKSPACE_OWNER']` (tenant: `usr-personal-001`)
2. **Add Mock Handlers in `auth-sandbox-handler.ts`**:
   - `POST /api/v1/auth/signup/person`: Returns simulated `201 Created` with challenge `OTP_VERIFICATION`.
   - `POST /api/v1/auth/verify-otp`: Validates against sandbox code `123456`, returns mock JWT with personal tenant context `usr-personal-001`.
   - `POST /api/v1/auth/passkey/login/options` & `POST /api/v1/auth/passkey/login/verify`: Returns simulated WebAuthn assertion tokens.
   - `POST /api/v1/auth/forgot-password` & `POST /api/v1/auth/reset-password`: Simulates single-use token lifecycle.
   - `POST /api/v1/auth/rotate-password`: Simulates password rotation and issues fresh mock JWT.

---

## 4. UI/UX 5-State Component Matrix (Liquid Glass Tokens & WCAG 2.2 AA)

Adhering strictly to `.agents/rules/01-workspace-specific.md` (Liquid Glass) and WCAG 2.2 AA accessibility:

| Operational State | Sign-In / Sign-Up Form | OTP Verification View | Passkey Biometric Trigger |
| :--- | :--- | :--- | :--- |
| **Default** | Tinted frosted glass card (`bg-white/65 dark:bg-slate-900/65 backdrop-blur-xl border-white/30`), clear semantic labels, floating focus rings (`focus-visible:ring-2 focus-visible:ring-primary/50`). | 6 discrete auto-advancing input cells with clipboard paste handler. | Primary Passkey button featuring device biometric icon (FaceID/Fingerprint) + secondary password fallback. |
| **Loading** | Inputs disabled, primary button shows spinning `Loader2` with localized copy (`t('auth.verifying', 'Verifying...')`). | Inputs locked, subtle pulse animation over input border glow. | Native browser WebAuthn modal open; UI displays "Touch your sensor or look at your camera". |
| **Empty** | Clean baseline with accessible placeholders (`name@company.com`). | Empty input boxes with autofocus on cell 1. | Initial idle prompt. |
| **Error** | Red outline (`border-destructive`), inline recovery copy (e.g. "Invalid credentials. 2 attempts remaining."). | Red flash across digits, auto-clears on error, focus returns to cell 1 with shake feedback. | Fallback banner: "Biometric authentication failed. Sign in with password or OTP instead." |
| **Disabled** | Submit button disabled until schema requirements satisfied (valid email format, min length). | Submit disabled until all 6 digits entered. | Disabled if browser does not support `PublicKeyCredential`. |

---

## 5. System-Wide RBAC Catalog & Tenant Entitlement Delegation

### 5.1 Global Schema Architecture (`apps/backend/acc-db`)
In Liquibase `changelog-000.000.00016.xml`:
1. **`${table_prefix}ROLE` Schema Evolution**:
   - Add `role_scope VARCHAR(20) NOT NULL DEFAULT 'TENANT'` (Values: `'SYSTEM'`, `'TENANT'`).
   - Add `min_plan_tier VARCHAR(50) DEFAULT 'COMMUNITY'` (Values: `'COMMUNITY'`, `'STANDARD'`, `'PRO'`, `'ENTERPRISE'`).
   - Unique constraint: `uk_role_code UNIQUE (code)`.
2. **`${table_prefix}USERROLE` Schema Evolution**:
   - Add `tenant_id VARCHAR(255) NOT NULL DEFAULT 'SYSTEM'` to stamp the tenant boundary where the role assignment applies.
   - Index: `CREATE INDEX idx_userrole_tenant ON ${table_prefix}USERROLE (user_uid, tenant_id)`.
3. **`${table_prefix}PERMISSION` Schema**:
   - Global canonical dictionary of permission atoms (`code` is globally unique, tenant-agnostic).

---

### 5.2 Sovereign System Roles (`role_scope = 'SYSTEM'`)

| Role Code | Clearance Tier | Operational Scope & Responsibilities | Core Granted Permission Atoms |
| :--- | :--- | :--- | :--- |
| `ROLE_SYSTEM_ROOT` | Tier 4 (Supreme) | Platform owner and supreme cluster infrastructure custodian. Full control over database schemas, master keys, and cluster nodes. (Replaces legacy `ROLE_SYSTEM_CUSTODIAN`). | `platform:*`, `metadata:*`, `billing:*`, `security:*`, `workflow:*` |
| `ROLE_SYSTEM_SUPPORT` | Tier 3 (Operations) | Customer reliability engineering and Tier-2/3 operations. Authorized to assume tenant sessions (`Assume-Tenant`), adjust quotas, unlock features, and reconcile billing. | `platform:tenant:assume`, `platform:fleet:read`, `platform:quotas:override`, `billing:reconcile`, `tenant:feature:grant` |
| `ROLE_SYSTEM_VERIFIER` | Tier 2 (Audit & KYC) | **System Governance, Audit & KYC Verifier**. Reviews cryptographic audit trails, inspects security anomalies, reviews commercial KYC/KYB documents, and conducts pre-flight checks. | `platform:workflow:verify`, `platform:audit:verify`, `platform:fleet:read`, `platform:security:inspect`, `platform:compliance:export`, `platform:kyc:verify` |
| `ROLE_SYSTEM_APPROVER` | Tier 3 (Governance) | **Four-Eyes Quorum & Sign-off Authority**. Dual-custody gatekeeper. Approves tenant account activations, credit lines, maintenance windows, and authorizes high-risk actions (purge, circuit break). | `platform:workflow:approve`, `platform:tenant:purge:approve`, `platform:circuit:trip`, `platform:kyc:approve` |

---

### 5.3 System-Wide Commercial Tenant Roles (`role_scope = 'TENANT'`)

| Role Code | Display Name | Min Plan Tier | Scope & Authority | Core Granted Permissions |
| :--- | :--- | :--- | :--- | :--- |
| `ROLE_WORKSPACE_OWNER` | Workspace Owner / Org Admin | `COMMUNITY` | Full administrative authority over the tenant's workspaces, member delegations, billing settings, and dynamic records. | `org:workspace:*`, `org:member:*`, `org:role:delegate`, `org:billing:*`, `metadata:schema:read`, `entity:record:*` |
| `ROLE_OPERATIONS_MANAGER` | Operations Manager | `STANDARD` | Operational management over business entities (e.g. orders, logistics, warehouse inventory, workflow dispatching). | `entity:record:*`, `org:workflow:submit`, `org:workflow:approve`, `metadata:schema:read` |
| `ROLE_STANDARD_MEMBER` | Standard Member | `COMMUNITY` | Daily business user who creates, edits, and searches records according to field masks and department rules. | `entity:record:read`, `entity:record:write`, `metadata:schema:read` |
| `ROLE_AUDITOR` | Tenant Auditor / Compliance | `PRO` | Read-only compliance auditor within the tenant. Can inspect audit logs and records; cannot mutate data. | `entity:record:read`, `org:audit:read`, `metadata:schema:read` |

---

## 6. Two-Dimensional Dual-Barrier Authorization Specification

```
                                Incoming HTTP Request
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ BARRIER 1: CAPABILITY CHECK (Spring Security @PreAuthorize SpEL)               │
│ - Checks if Principal holds required permission (e.g. 'metadata:schema:read')   │
│ - Missing? ──► Abort with HTTP 403 Forbidden                                    │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ Passed
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ BARRIER 2: DATA SCOPE BARRIER (PostgreSQL Row-Level Security)                   │
│ - Evaluates: current_setting('app.current_tenant_id')                           │
│   ├── If 'SYSTEM' ──► Evaluates to TRUE (Systemwide inspection)                 │
│   └── If 'tenant-x' ──► Evaluates to tenant_id = 'tenant-x'                     │
│ - All records outside the caller's tenant boundary are physically hidden        │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │ Passed
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│ BARRIER 3: TENANT ENTITLEMENT GATE (TenantEntitlementService)                   │
│ - Checks if tenant's plan tier / UNIPOST_TENANT_FEATURES entitles the feature   │
│ - Unlicensed? ──► Abort with HTTP 402 Payment Required / 403 Feature Disabled   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Migration & Implementation Strategy

### Step 1: Liquibase Migration (`changelog-000.000.00016.xml`)
- Author `apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00016.xml`:
  1. Pre-flight PL/pgSQL assertion for `${SOVEREIGN_*_PASSWORD_HASH}`.
  2. Evolve `${table_prefix}ROLE` (`role_scope`, `min_plan_tier`).
  3. Evolve `${table_prefix}USERROLE` (`tenant_id`, index).
  4. Deactivate legacy `admin` (`status = 0, nonLocked = false`).
  5. Seed 4 sovereign roles & 4 commercial tenant roles.
  6. Seed enterprise permission atoms.
  7. Map role permissions.
  8. Seed 4 sovereign personas with `credentialsNonExpired = false`.
  9. Create `${table_prefix}WEBAUTHN_CREDENTIALS` table for passkey storage.
  10. Add `is_verified` and `phone_number_verified` columns to `${table_prefix}USER`.
- Register in `changelog-master.xml`.

### Step 2: Backend Controller & Service Alignment (`apps/backend/acc-fw`)
- Update `SystemFleetController.java` `@PreAuthorize` annotations.
- Update `SystemFleetService.java` in-memory seeds to match new roles.

### Step 3: TypeScript Client SDK Alignment (`packages/client`)
- Update `packages/client/src/contracts/users.ts` with `SovereignRole` and `TenantRole`.

### Step 4: Console UI Views & Wire Implementations (`apps/console`)
- Wire `sign-up-form.tsx` to `POST /api/v1/auth/signup/person`.
- Wire `otp-form.tsx` to `POST /api/v1/auth/verify-otp`.
- Add Passkey biometric button to `user-auth-form.tsx`.
- Wire `forgot-password-form.tsx` and create `PasswordRotationModal.tsx`.
- Update `use-permissions.ts` and `ProtectedRoute.tsx`.
- Update `auth-sandbox-handler.ts` with mock handlers for complete offline dev parity.

### Step 5: Verification & Quality Gates
- Execute `cmd.exe /c "mvnw.cmd test-compile -q"`.
- Execute targeted backend tests:
  `cmd.exe /c "mvnw.cmd test -pl acc-fw -Dtest=SystemFleetServiceTest,RecordMutationPipelineTest,SchemaValidationServiceTest,CompositeRecordServiceTest,MetadataServiceTest -q"`.
- Execute frontend type checking:
  `pnpm --filter @acc/console exec tsc --noEmit`.
- Run Playwright / Vitest test suites.
