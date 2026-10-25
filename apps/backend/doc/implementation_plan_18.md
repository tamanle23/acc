# Implementation Plan - Phase 3: Cryptographic JWT Claims & TenantContext Lifecycle

## 1. Context & Motivation
Phase 3 of the Master Implementation Plan establishes cryptographic tenant binding and eliminates Insecure Direct Object Reference (IDOR) attacks:
1. **Header Sanitization**: Strip external, client-injected `X-Tenant-Id` headers so upstream proxies or clients cannot spoof tenant context.
2. **Cryptographic Claims Parsing**: In `JwtTokenHelper` and `JwtAuthenticationToken`, extract custom claims `tid` (tenant ID) and `permissions`.
3. **TenantContext Lifecycle**: Ensure `TenantContextHolder` has `getRequiredTenantId()`, `getTenantId()`, `setTenantId()`, and is populated in `JwtAuthenticationTokenFilter` / `TenantContextBindingFilter` within strict `try/finally` blocks to guarantee zero thread pool leakage.
4. **MDC Logging**: Bind `tenantId` to SLF4J MDC (`[tenant:tnt_...]`) so logs can be partitioned by tenant.
5. **Asynchronous Context Propagation**: Enhance `AsyncContextTaskDecorator` to propagate `TenantContextHolder`, `SecurityContext`, and `MDC` to `@Async` and worker thread pools.
6. **API Stamping & Protection**: In `MetadataService` and `MetadataController`, stamp records with `TenantContextHolder.getRequiredTenantId()` rather than trusting client payloads.

## 2. Proposed Changes

### 1. Header Sanitization (`apps/backend/acc-fw`)
- Create `com.acc.fw.tenancy.HeaderSanitizerFilter`:
  - Extends `OncePerRequestFilter`.
  - Wraps `HttpServletRequest` using `HttpServletRequestWrapper` to strip or neutralize `X-Tenant-Id` header (and variants `x-tenant-id`).
  - Registered as highest precedence or before JWT filters in Spring Security chain.

### 2. Token Claims & Authentication Principal (`apps/backend/acc-fw`)
- Update `JwtAuthenticationToken.java`:
  - Add `tenantId` field and getter.
- Update `JwtTokenHelper.java`:
  - Add constant `CLAIM_KEY_TENANT_ID = "tid"`.
  - Add helper method `getTenantId(Claims claims)` that extracts `tid` (with fallback to `"default-tenant"` if missing).
  - Add `CLAIM_KEY_PERMISSIONS = "permissions"`.
  - Incorporate permissions into authorities collection if present.
- Update `JwtAuthenticationTokenFilter.java`:
  - Extract `tenantId` via `jwtTokenHelper.getTenantId(claims)`.
  - Pass `tenantId` into `JwtAuthenticationToken`.
  - Bind `tenantId` into `TenantContextHolder.setTenantId(tenantId)` and `MDC.put("tenantId", tenantId)`.
  - Guarantee `TenantContextHolder.clear()` and `MDC.remove("tenantId")` in `finally` block.

### 3. TenantContextHolder Enhancement (`apps/backend/acc-fw`)
- Update `com.acc.fw.tenancy.TenantContextHolder`:
  - Add `getRequiredTenantId()` which throws `IllegalStateException` when tenant context is empty or null.

### 4. Asynchronous Task Propagation (`apps/backend/acc-fw`)
- Update `AsyncContextTaskDecorator.java`:
  - Capture parent thread's `TenantContextHolder.getTenantId()`, `SecurityContextHolder.getContext()`, and `MDC.getCopyOfContextMap()`.
  - In worker thread `Runnable`, restore `TenantContextHolder`, `SecurityContextHolder`, and `MDC`.
  - In `finally`, clean up `TenantContextHolder.clear()`, `SecurityContextHolder.clearContext()`, and `MDC.clear()`.

### 5. Controller & Service Stamping (`apps/backend/acc-fw`)
- In `MetadataService.java`:
  - In `createEntityRecord`: If `request.tenantId()` is supplied, override or validate against `TenantContextHolder.getRequiredTenantId()` (stamping strictly with authenticated tenant).
  - In `getEntityRecords`: Default query `tenantId` parameter to `TenantContextHolder.getTenantId()` if present.

### 6. Verification & Automated Tests
- Unit test `HeaderSanitizerFilterTest`: Verifies incoming `X-Tenant-Id` header is stripped.
- Unit test `TenantJwtSecurityLifecycleTest`: Verifies JWT parsing with `tid`, `TenantAuthenticationToken`, `TenantContextHolder`, MDC binding, and `AsyncContextTaskDecorator` thread propagation.
- Run `.\mvnw test-compile` and execute all new and existing tests.
