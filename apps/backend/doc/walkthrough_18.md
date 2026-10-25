# Walkthrough - Phase 3: Cryptographic JWT Claims & TenantContext Lifecycle

## 1. Overview
In Phase 3 of the Multi-Tenant Master Plan, we implemented cryptographic tenant binding, perimeter header sanitization against spoofing (IDOR prevention), MDC log context stamping, and asynchronous context propagation across worker thread pools.

## 2. Key Changes Implemented

### Header Sanitization & Anti-Spoofing (`acc-fw`)
- Created `com.acc.fw.tenancy.HeaderSanitizerFilter`:
  - Enforces Zero Client Trust by stripping incoming `X-Tenant-Id`, `x-tenant`, and `x-acc-tenant` headers.
  - Guarantees the application layer never relies on unverified or client-supplied tenant HTTP headers.

### JWT Cryptographic Claims & Tenant Context Binding (`acc-fw`)
- Updated `JwtAuthenticationToken.java`:
  - Added `tenantId` field and accessor `getTenantId()`.
- Updated `JwtTokenHelper.java`:
  - Added `CLAIM_KEY_TENANT_ID = "tid"` and `CLAIM_KEY_PERMISSIONS = "permissions"`.
  - Added `getTenantId(Claims claims)` to extract the cryptographic tenant claim.
  - Merged granular permissions into Spring Security's `authorities` collection.
  - Made `getAuthenticationToken(Map<String, Object> claims)` publicly accessible.
- Updated `JwtAuthenticationTokenFilter.java`:
  - Extracts verified `tenantId` from JWT claims and injects it into `JwtAuthenticationToken`.
  - Binds active tenant to `TenantContextHolder.setTenantId(tenantId)` and `MDC.put("tenantId", tenantId)`.
  - Wrapped request processing in strict `try / finally` to guarantee cleanup via `TenantContextHolder.clear()` and `MDC.remove("tenantId")`, preventing thread-pool contamination.

### Tenant Context Holder (`acc-fw`)
- Enhanced `TenantContextHolder.java`:
  - Added `getRequiredTenantId()` which raises `IllegalStateException` on missing or blank context.

### Asynchronous & Task Propagation (`acc-fw`)
- Enhanced `AsyncContextTaskDecorator.java`:
  - Snapshots parent thread's `TenantContextHolder`, `SecurityContextHolder`, and SLF4J `MDC`.
  - Re-establishes these contexts upon execution on worker threads (`@Async`, thread pools).
  - Guarantees clean teardown on thread exit.

### Service & Controller Stamping (`acc-fw`)
- Updated `MetadataService.java`:
  - In `createEntityRecord`: Stamped record strictly with `TenantContextHolder.getTenantId()`, overriding client payload attempts.
  - In `getEntityRecords`: Defaulted query `tenantId` to active thread tenant context.

## 3. Verification & Results
- Executed unit test suite covering:
  - `HeaderSanitizerFilterTest`: Verifies `X-Tenant-Id` header is stripped and legitimate headers preserved (1 test, 0 failures).
  - `TenantSecurityLifecycleTest`: Verifies `TenantContextHolder.getRequiredTenantId()`, JWT `tid` extraction, merged authorities, and `AsyncContextTaskDecorator` thread propagation (3 tests, 0 failures).
  - `TenantContextAndAspectTest`: Retained and passed (4 tests, 0 failures).
- Executed full 10-module Maven reactor test suite: **BUILD SUCCESS**.
