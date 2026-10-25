# 009: Noisy Neighbor Defense & Resource Protection (Phase 7)

## Problem
In a multi-tenant dynamic schema architecture, shared computing resources (API worker threads, CPU during JSON Schema evaluation, and database connection pools) can be compromised by runaway or malicious tenant behavior ("noisy neighbor" problem). Specific vulnerabilities include:
1. High-frequency API floods from individual tenants starving overall throughput.
2. Catastrophic regex backtracking (Regular Expression Denial of Service - ReDoS) in custom attribute validation schemas freezing worker threads.
3. Excessive schema complexity (unbounded models or attributes) bloating caches and memory.
4. Over-sized record payloads consuming large buffers.
5. Long-running unindexed tenant queries locking database connections.

## Plan
1. **Tier 1 (API Perimeter):** Implement distributed token-bucket rate limiting via `TenantRateLimitService` and `TenantRateLimitFilter`, partitioned by `tenant_id` with tiered capacities (`ENTERPRISE`: 5000 rpm, `PRO`: 1000 rpm, `BASIC`: 120 rpm) returning HTTP 429 with `Retry-After`.
2. **Tier 2 (Schema Complexity & ReDoS Defense):**
   - Enforce hard limits: max 50 `EntityType` per workspace, max 100 attributes per entity type, max 1MB per record payload.
   - Pre-flight regex static analysis rejecting catastrophic nested quantifiers (`(a+)+`, `([a-zA-Z]+)*`).
   - Time-bounded schema validation executing within a 50ms computational budget, aborting into `ValidationTimeoutException`.
3. **Tier 3 (Database Circuit Breakers):** Configure dynamic statement timeout (`SET LOCAL statement_timeout = '3000ms'`) in `TenantSessionAspect.java`.

## Changes Made
- **Rate Limiting:**
  - `apps/backend/acc-fw/src/main/java/com/acc/fw/tenancy/ratelimit/TenantRateLimitService.java`
  - `apps/backend/acc-fw/src/main/java/com/acc/fw/tenancy/ratelimit/TenantRateLimitFilter.java`
- **ReDoS & Schema Timeout Defense:**
  - `apps/backend/acc-fw/src/main/java/com/acc/service/exception/ValidationTimeoutException.java`
  - `apps/backend/acc-fw/src/main/java/com/acc/service/SchemaValidationService.java`
- **Resource Quotas & Payload Guard:**
  - `apps/backend/acc-fw/src/main/java/com/acc/repository/jpa/EntityTypeRepository.java`: added `countByDeletedDateIsNull()`
  - `apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java`: wired 50-model cap, 100-attribute cap, 1MB payload check, and `isDangerousRegex` detector.
- **Database Statement Timeout:**
  - `apps/backend/acc-fw/src/main/java/com/acc/fw/tenancy/TenantSessionAspect.java`: added `SET LOCAL statement_timeout = '3000ms'`.
- **Unit & Regression Tests:**
  - `apps/backend/acc-fw/src/test/java/com/acc/fw/tenancy/ratelimit/TenantRateLimitServiceTest.java`
  - `apps/backend/acc-fw/src/test/java/com/acc/service/SafeSchemaValidationTest.java`
  - `apps/backend/acc-fw/src/test/java/com/acc/service/CompositeCacheFabricTest.java`

## Verification
- Maven test-compile and test executions:
  ```powershell
  .\mvnw.cmd test "-Dtest=TenantRateLimitServiceTest,SafeSchemaValidationTest,TenantProvisioningServiceTest,CompositeCacheFabricTest,MetadataRlsIntegrationTest"
  ```
  All tests passed across all 10 modules (`BUILD SUCCESS`).

## Walkthrough & Artifacts
- Plan: `apps/backend/doc/implementation_plan_21.md`
- Walkthrough: `apps/backend/doc/walkthrough_21.md`
- History: `docs/history/009_noisy_neighbor_defense_and_resource_quotas.md`
