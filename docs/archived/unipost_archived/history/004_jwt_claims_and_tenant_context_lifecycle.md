# 004: Cryptographic JWT Claims, TenantContext Lifecycle & Header Sanitization (Phase 3)

**Date:** 2026-10-09  
**Type:** feat  
**Scope:** backend, security, tenancy  

## Problem
Multi-tenant isolation required cryptographic authentication binding to eliminate Insecure Direct Object Reference (IDOR) attacks. If client-supplied `X-Tenant-Id` headers or payload tenant parameters were trusted, unauthorized cross-boundary access could occur. Furthermore, asynchronous thread pools and `@Async` handlers risked context leakage or context loss.

## Plan
1. Create `HeaderSanitizerFilter` to strip spoofed client tenant headers (`X-Tenant-Id`).
2. Add `tid` claim extraction and permissions merging in `JwtTokenHelper` and `JwtAuthenticationToken`.
3. Bind verified `tenantId` to `TenantContextHolder` and SLF4J MDC within `JwtAuthenticationTokenFilter` inside `try/finally` blocks.
4. Enhance `TenantContextHolder` with `getRequiredTenantId()`.
5. Enhance `AsyncContextTaskDecorator` to propagate `TenantContextHolder`, `SecurityContext`, and MDC to worker threads.
6. Enforce authenticated tenant stamping in `MetadataService`.
7. Add automated tests and verify build.

## Changes
- **Security & Tenancy (`apps/backend/acc-fw`)**:
  - `HeaderSanitizerFilter.java`: Perimeter filter stripping client-supplied `X-Tenant-Id` headers.
  - `JwtAuthenticationToken.java`: Added `tenantId` principal property.
  - `JwtTokenHelper.java`: Added `CLAIM_KEY_TENANT_ID`, `CLAIM_KEY_PERMISSIONS`, `getTenantId()`, and permissions-to-authorities mapping.
  - `JwtAuthenticationTokenFilter.java`: Integrated `TenantContextHolder` and MDC lifecycle with strict `finally` cleanup.
  - `TenantContextHolder.java`: Added `getRequiredTenantId()`.
  - `AsyncContextTaskDecorator.java`: Propagates tenant context, security context, and MDC to async worker threads.
  - `MetadataService.java`: Enforces stamping records strictly with active tenant context.
- **Tests (`apps/backend/acc-fw`)**:
  - `HeaderSanitizerFilterTest.java`: Validates header stripping.
  - `TenantSecurityLifecycleTest.java`: Validates JWT claims parsing, required tenant validation, and async context propagation.

## Verification
- `.\mvnw test -Dtest="HeaderSanitizerFilterTest,TenantSecurityLifecycleTest,TenantContextAndAspectTest"`: 8 tests passed, 0 failures across reactor.
- Full 10-module Maven reactor build: **BUILD SUCCESS**.
