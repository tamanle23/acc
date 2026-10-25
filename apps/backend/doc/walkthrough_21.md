# Walkthrough: Phase 7 - Noisy Neighbor Defense & Resource Protection

## Overview
Phase 7 implements multi-tiered noisy neighbor defense mechanisms and resource quota guardrails across `@acc/backend`, ensuring tenant isolation under adversarial or heavy load conditions as specified in `docs/multi-tenants/06_multi_tenant_rate_limiting_and_noisy_neighbor.md`.

---

## Changes Implemented

### Tier 1: Distributed Token-Bucket Rate Limiting
- **Service (`TenantRateLimitService.java`):**
  - Distributed token bucket using Redis when connected, with automatic thread-safe in-memory sliding window bucket fallback.
  - Plan tiers:
    - `ENTERPRISE`: 5000 rpm
    - `PRO`: 1000 rpm
    - `BASIC` / Solo (Default): 120 rpm
  - Atomic token consumption returning `RateLimitResult(allowed, tokensRemaining, retryAfterSeconds, capacity)`.
- **Filter (`TenantRateLimitFilter.java`):**
  - `@Order(10)` servlet filter running directly after header sanitization.
  - Automatically extracts active `tenant_id` from `TenantContextHolder`.
  - Rejects rate-limited requests with HTTP `429 Too Many Requests`, `Retry-After: <seconds>`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and RFC 7807 problem detail payload.

### Tier 2: Schema Complexity & ReDoS Defense
- **Entity Model Quota:** Capped at a maximum of 50 `EntityType` definitions per tenant workspace (`EntityTypeRepository.countByDeletedDateIsNull() >= 50`).
- **Attribute Definition Quota:** Capped at a maximum of 100 `AttributeDefinition` items per entity type.
- **Payload Size Hard Cap:** Capped at 1 MB (1,048,576 bytes) per record mutation (`createEntityRecord`, `updateEntityRecord`, `patchEntityRecord`).
- **Pre-flight Regex Static Analysis:** Rejects catastrophic nested quantifiers (e.g. `(a+)+`, `(x*)*`, `([a-zA-Z]+)*`, `(foo|bar+)+`) on attribute creation.
- **50ms Schema Validation Timeout Budget:** Encapsulated JSON Schema validation in a dedicated thread executor with a strict 50ms timeout. Times out into `ValidationTimeoutException`, neutralizing CPU exhaustion from catastrophic regex backtracking.

### Tier 3: Database Circuit Breakers
- **Dynamic Statement Timeout:** Updated `TenantSessionAspect.java` to execute `SET LOCAL statement_timeout = '3000ms'` alongside `SET LOCAL app.current_tenant_id` at transaction boundaries, protecting PostgreSQL connection pools from unindexed runaway tenant queries.

---

## Verification Results

### Automated Unit & Regression Tests
Executed via Maven:
```powershell
.\mvnw.cmd test "-Dtest=TenantRateLimitServiceTest,SafeSchemaValidationTest,TenantProvisioningServiceTest,CompositeCacheFabricTest,MetadataRlsIntegrationTest"
```
**Results:**
- `TenantRateLimitServiceTest`: Passed (120 BASIC quota exhaustion, PRO/ENTERPRISE tier capacities, in-memory bucket reset).
- `SafeSchemaValidationTest`: Passed (Catastrophic nested quantifier regex detection, 50-model cap, 100-attribute cap, 1MB record payload cap).
- `TenantProvisioningServiceTest`: Passed.
- `CompositeCacheFabricTest`: Passed.
- `MetadataRlsIntegrationTest`: Passed.
- **Reactor Summary:** All 10 Maven modules `BUILD SUCCESS`.
