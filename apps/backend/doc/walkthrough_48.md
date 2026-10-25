# Walkthrough 48: Sovereign RBAC, Fail-Fast Liquibase, and Passkey Credentials

**App:** `@unipost/backend`  
**Date:** 2026-10-25  
**Version:** Iteration 23  

---

## 1. Overview
Implemented Liquibase `changelog-000.000.00016.xml` and backend service updates for sovereign RBAC governance, fail-fast SQL password assertions, passkey credential storage, and inside-tenant permission catalogs.

## 2. Changes Made
1. **Liquibase Migration `changelog-000.000.00016.xml`**:
   - `000.000.00016-assert-passwords`: Preconditions enforcing non-empty BCrypt password hashes.
   - `000.000.00016-evolve-role-and-userrole`: Added `role_scope` and `min_plan_tier` to `UNIPOST_IDENTITY_ROLE`, and `tenant_id` to `UNIPOST_IDENTITY_USERROLE`.
   - `000.000.00016-webauthn-credentials`: Created `UNIPOST_WEBAUTHN_CREDENTIALS` table for FIDO2 passkeys.
   - `000.000.00016-deactivate-legacy-accounts`: Deactivated `admin` and `anonymous`.
   - `000.000.00016-seed-sovereign-roles` & `seed-tenant-roles`: Seeded 4 sovereign roles and 4 tenant roles.
   - `000.000.00016-seed-permission-atoms`: Seeded 24 granular permission atoms.
   - `000.000.00016-seed-role-permissions`: Mapped permissions to sovereign and tenant roles.
   - `000.000.00016-seed-sovereign-users`: Seeded 4 sovereign custodian accounts with `credentialsNonExpired = false`.
2. **Spring Controller & Service Layer**:
   - `SystemFleetController`: Harmonized `@PreAuthorize` expressions to require `ROLE_SYSTEM_ROOT`, `ROLE_SYSTEM_SUPPORT`, and specific permission atoms.
   - `SystemFleetService`: Updated default in-memory role and user stores to match canonical sovereign and tenant roles.

## 3. Verification
- Maven test-compile passed with exit code 0.
- Unit and integration tests (`SystemFleetServiceTest`, `RecordMutationPipelineTest`, etc.) passed with exit code 0.
