# Implementation Plan - Phase 7: Noisy Neighbor Defense & Resource Protection

## Overview
Implement the **Noisy Neighbor Defense & Resource Protection** framework in `@acc/backend` (`apps/backend/acc-fw`) based on specifications in [`docs/multi-tenants/06_multi_tenant_rate_limiting_and_noisy_neighbor.md`](file:///c:/Users/Admin/workspace/git/acc/docs/multi-tenants/06_multi_tenant_rate_limiting_and_noisy_neighbor.md):
1. **Tier 1 (API Perimeter):** Distributed Token Bucket rate limiting partitioned by `tenant_id` via Redis with plan tiers (`ENTERPRISE`: 5000 rpm, `PRO`: 1000 rpm, `BASIC`/default: 120 rpm), returning HTTP 429 with `Retry-After`.
2. **Tier 2 (Schema Complexity & ReDoS Defense):**
   - Entity and Attribute caps per tenant (max 50 entity types, max 100 attributes per entity type).
   - Payload size limits: max 1 MB per `record.attributes` JSON payload.
   - Pre-flight regex static analysis rejecting catastrophic nested quantifiers.
   - Interruptible JSON Schema validation with a strict **50ms computational timeout budget** via dedicated executor, preventing ReDoS attacks.
3. **Tier 3 (Database Circuit Breakers):**
   - Configure dynamic transaction statement timeout: `SET LOCAL statement_timeout = '3000ms'` in [`TenantSessionAspect.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/fw/tenancy/TenantSessionAspect.java).

## Proposed Changes

### 1. Tier 1: Distributed Token Bucket Rate Limiting (`com.acc.fw.tenancy.ratelimit`)
- Create `TenantRateLimitService.java`:
  - Uses Spring Data Redis `StringRedisTemplate` with atomic Lua token bucket script (or standalone in-memory fallback when Redis is absent/mocked).
  - Tiers: `BASIC` (120 rpm), `PRO` (1000 rpm), `ENTERPRISE` (5000 rpm).
  - Evaluates `isAllowed(String tenantId, String tier)` returning tokens remaining and reset duration.
- Create `TenantRateLimitFilter.java`:
  - Once tenant context is established (after `HeaderSanitizerFilter`), checks rate limit.
  - If limit exceeded, returns HTTP 429 Too Many Requests with header `Retry-After: <seconds>` and standardized JSON error payload without touching database pools.

### 2. Tier 2: Schema Hard Limits, ReDoS Analysis & Safe Validation
- Update `MetadataService.java`:
  - Enforce max 50 entity types per tenant in `createEntityType`.
  - Enforce max 100 attributes per entity in `createAttributeDefinition`.
  - Pre-flight static regex inspection on string attributes with regex patterns (check for dangerous nested quantifiers e.g. `(a+)+`, `(x*)*`, `([a-zA-Z]+)*`).
  - Enforce max 1MB payload size on `CreateRecordRequest.attributes()` and `UpdateRecordRequest.attributes()`.
- Update `SchemaValidationService.java`:
  - Implement `validatePayloadWithTimeout(Long entityTypeId, Map<String, Object> payload, long timeoutMs)` using a dedicated executor thread with a 50ms timeout.
  - If timeout triggers, abort execution and throw `ValidationTimeoutException` / return HTTP 422 with descriptive error ("Schema validation exceeded 50ms computational budget; possible catastrophic backtracking").

### 3. Tier 3: Database Statement Timeout Circuit Breaker
- Update [`TenantSessionAspect.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/fw/tenancy/TenantSessionAspect.java):
  - In addition to `SET LOCAL app.current_tenant_id = :tenantId`, execute:
    `SET LOCAL statement_timeout = '3000ms'` (guarded by PostgreSQL DBMS check / catch so HSQLDB/mocks don't error).
  - Automatically aborts any runaway queries or deadlock scans after 3 seconds.

## Verification Plan

### Automated Tests
1. `TenantRateLimitServiceTest.java`:
   - Verify Basic tier allows 120 requests and rejects on the 121st with HTTP 429 and Retry-After.
   - Verify Pro tier capacity of 1000 rpm.
2. `SafeSchemaValidationTest.java`:
   - Validate payload against normal schema completes $< 5\text{ ms}$.
   - Validate payload against a ReDoS regex (e.g. `^([a-zA-Z0-9]+)*$`) with malicious payload (`aaaaaaaaaaaaaaaaaaaaaaaaaaaa!`) aborts within 50ms and throws `ValidationTimeoutException`.
3. `SchemaHardLimitsTest.java`:
   - Verify attempting to create 51st entity type throws `MetadataConflictException`.
   - Verify attempting to create 101st attribute throws `MetadataConflictException`.
   - Verify payload exceeding 1MB throws `PayloadTooLargeException` / `MetadataConflictException`.
4. Run full Maven test suite across all 10 modules: `mvn test-compile -DskipTests`.
