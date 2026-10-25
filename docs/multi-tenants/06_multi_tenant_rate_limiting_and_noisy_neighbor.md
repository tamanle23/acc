# Part 6: Noisy Neighbor Defense, Resource Quotas & Schema Protection

**Series:** Multi-Tenant Architecture Blueprint Series (Document 06 of N)  
**Document Level:** Systems Engineering & Infrastructure Reliability Specification  
**Target Systems:** `@acc/backend` (Spring Modulith / Java 21 / Redis / Hazelcast), PostgreSQL 16+  
**Scope:** Distributed Token-Bucket Rate Limiting, JSON Schema Protection (ReDoS Guards, Recursion Limits), Storage Quotas, Dynamic Query Guardrails  
**Status:** Canonical Living Architecture Document  

---

## 1. Executive Summary & Problem Context

In a pooled multi-tenant architecture, multiple tenants share the same underlying compute nodes, JVM runtimes, Redis/Hazelcast caches, and PostgreSQL databases. Without strict resource containment, a single rogue or runaway tenant can exhaust system resources, leading to the **"Noisy Neighbor Problem"**:
1. **Schema-Level Denial of Service (ReDoS)**: A tenant admin defines an attribute with an exponentially catastrophic regular expression (e.g. `(a+)+$`) or 500 deeply nested attributes that overwhelm the CPU during `SchemaValidationService` runs.
2. **Write-Path Stampedes**: An automated batch script in Tenant A floods the API with 10,000 writes/second, saturating the HikariCP database connection pool.
3. **Storage Bloat**: A tenant injects multi-megabyte base64 strings or unbounded JSON documents into `attributes JSONB`, consuming excessive disk space and bloating GIN indexes.
4. **Unbounded Graph Traversals (Pattern C)**: A tenant triggers a recursive graph traversal that enters a cycle or traverses millions of edges, starving database worker threads.

**Part 6** defines the operational invariants, rate-limiting algorithms, schema complexity guardrails, and query circuit breakers required to guarantee fair resource sharing and total isolation across all tenants.

---

## 2. Multi-Tier Defense Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              INCOMING HTTP TRAFFIC PERIMETER                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ TIER 1: Edge & API Gateway Rate Limiting                                               │
│ • Distributed Token-Bucket per `tenant_id` via Redis                                   │
│ • Rate tiers based on Subscription Plan (Starter: 60 rpm, Enterprise: 5,000 rpm)       │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │ Passed
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TIER 2: Metadata Schema Protection & Validation Guardrails                             │
│ • Attribute Count Caps (Max 100 attributes per Entity Type)                            │
│ • JSON Schema ReDoS Regex Sanitizer & Timeout Budget (< 5ms per validation)            │
│ • Payload Size Limit: Max 1MB per `record.attributes` JSONB document                   │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │ Passed
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TIER 3: Data Plane Query Circuit Breakers & DB Protection                              │
│ • Statement Timeout: `SET LOCAL statement_timeout = '3000ms'`                         │
│ • Pattern C Traversal Depth Clamp: `depth <= 10` on recursive CTEs                     │
│ • Pagination Enforcement: Max `pageSize = 100` on Data Explorer queries                │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tier 1: Distributed Rate Limiting (Token Bucket via Redis)

Rate limiting is enforced at the API boundary using Redis-backed Token Bucket filters partitioned strictly by `tenant_id`.

```java
package com.acc.fw.tenancy.ratelimit;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.redis.lettuce.cas.LettuceBasedProxyManager;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
public class TenantRateLimitService {

    private final LettuceBasedProxyManager<String> proxyManager;

    public TenantRateLimitService(LettuceBasedProxyManager<String> proxyManager) {
        this.proxyManager = proxyManager;
    }

    public Bucket resolveBucket(String tenantId, String planTier) {
        return proxyManager.builder().build(
            "rate_limit:" + tenantId,
            () -> getConfigurationForTier(planTier)
        );
    }

    private BucketConfiguration getConfigurationForTier(String planTier) {
        int capacity = switch (planTier) {
            case "ENTERPRISE" -> 5000;
            case "PRO" -> 1000;
            default -> 120; // Starter / Solo User: 120 requests per minute
        };

        return BucketConfiguration.builder()
            .addLimit(Bandwidth.builder()
                .capacity(capacity)
                .refillGreedy(capacity, Duration.ofMinutes(1))
                .build())
            .build();
    }
}
```

If a tenant exceeds their quota, the filter immediately returns HTTP `429 Too Many Requests` with a `Retry-After` header, halting execution before touching database connection pools or CPU resources.

---

## 4. Tier 2: Metadata Schema Protection & ReDoS Mitigation

Allowing tenant administrators to define dynamic validation constraints requires safeguarding against hostile or accidental regex traps.

### 4.1 Schema Definition Hard Limits
When a tenant creates or edits an entity model in the Metadata Studio:
1. **Attribute Cap**: Maximum **100 attributes** per Entity Type.
2. **Entity Cap**: Maximum **50 Entity Types** per standard tenant.
3. **Payload Limit**: `record.attributes` JSONB payload cannot exceed **1 MB**.
4. **Option Value Cap**: For `ENUM` attributes, maximum **100 choices** with values $\le 100$ characters.

### 4.2 ReDoS Protection in `SchemaValidationService`
Regular expressions defined in attribute validation rules (e.g. `pattern: "^([a-zA-Z0-9]+)*$"`) can cause exponential backtracking in standard regex engines.

1. **Pre-flight Regex Static Analysis**: During attribute creation (`POST /api/v1/metadata/types/{id}/attributes`), the regex is inspected for nested quantifiers.
2. **Interruptible Regex Evaluation**: In `SchemaValidationService`, JSON Schema validation is wrapped in an interruptible execution thread with a **5ms CPU timeout**:

```java
package com.acc.domain.metadata.validation;

import com.networknt.schema.JsonSchema;
import com.networknt.schema.ValidationMessage;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.concurrent.*;

@Service
public class SafeSchemaValidationService {

    private final ExecutorService validationExecutor = Executors.newVirtualThreadPerTaskExecutor();

    public Set<ValidationMessage> validateWithTimeout(JsonSchema schema, JsonNode payload) {
        Future<Set<ValidationMessage>> future = validationExecutor.submit(() -> schema.validate(payload));
        
        try {
            // Strictly enforce max 50ms total validation time budget
            return future.get(50, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            throw new ValidationTimeoutException("Validation rejected: Schema evaluation exceeded computational time budget");
        } catch (Exception e) {
            throw new SchemaValidationException("Validation engine failure: " + e.getMessage(), e);
        }
    }
}
```

---

## 5. Tier 3: Database Circuit Breakers & Query Guardrails

PostgreSQL transactions must be protected against malicious, malformed, or unindexed queries.

### 5.1 Dynamic Statement Timeouts per Transaction
In addition to setting `app.current_tenant_id`, the transaction aspect configures a strict `statement_timeout`:
```sql
-- Executed at transaction start
SET LOCAL statement_timeout = '3000ms'; -- Max 3 seconds per OLTP query
```
Any heavy table scan or blocked lock triggers an automatic PostgreSQL abort (`57014: query_canceled`), releasing database connections back to the HikariCP pool.

### 5.2 Pattern C Recursive Traversal Clamp
When querying connected edges (`UNIPOST_ENTITY_RELATIONSHIPS`), graph queries must prevent infinite recursion and limit CPU consumption:
```sql
WITH RECURSIVE graph_cte AS (
    -- Anchor member
    SELECT source_entity_id, target_entity_id, relationship_type_id, 1 AS depth
    FROM UNIPOST_ENTITY_RELATIONSHIPS
    WHERE source_entity_id = :startId 
      AND tenant_id = :tenantId 
      AND deleted_date IS NULL

    UNION ALL

    -- Recursive member
    SELECT r.source_entity_id, r.target_entity_id, r.relationship_type_id, g.depth + 1
    FROM UNIPOST_ENTITY_RELATIONSHIPS r
    INNER JOIN graph_cte g ON r.source_entity_id = g.target_entity_id
    WHERE r.tenant_id = :tenantId 
      AND r.deleted_date IS NULL
      AND g.depth < 10 -- HARD CLAMP: Max depth 10
)
SELECT * FROM graph_cte LIMIT 250; -- HARD LIMIT: Max 250 traversed edges
```

---

## 6. Tier 4: Storage Quota Tracking & Auditing

To prevent disk exhaustion on shared PostgreSQL storage:

1. **Daily Tenant Usage Aggregation Job**:
   A scheduled Spring Batch / Modulith cron job aggregates disk utilization per tenant:
   ```sql
   SELECT 
       tenant_id,
       COUNT(*) AS total_records,
       SUM(pg_column_size(attributes)) AS attributes_bytes
   FROM UNIPOST_ENTITIES
   WHERE deleted_date IS NULL
   GROUP BY tenant_id;
   ```
2. **Quota Enforcement Thresholds**:
   * **Starter Plan**: 500 MB attributes data / 100,000 records.
   * **Pro Plan**: 5 GB attributes data / 1,000,000 records.
   * **Enterprise Plan**: Custom / Uncapped (Routed to dedicated partitioned tables).
3. **Graceful Degraded Mode**: If a tenant reaches 100% of their storage quota:
   * Write operations (`POST /entities`) return `403 Forbidden: Storage quota exceeded`.
   * Read operations (`GET /entities`) and Delete operations (`DELETE /entities`) remain 100% functional, allowing the tenant to clean up data without admin intervention.

---

## 7. Summary of Noisy Neighbor Protections

| Threat Vector | Mitigation Strategy | Enforcement Layer |
| :--- | :--- | :--- |
| **API Request Floods** | Redis Token Bucket per `tenant_id` ($120 - 5000\text{ rpm}$). | Web Filter / Gateway |
| **Catastrophic Regex (ReDoS)** | Pre-flight syntax validation + 50ms validation timeout. | `SafeSchemaValidationService` |
| **Monstrous Payloads** | 1MB hard cap on `record.attributes` JSON payload. | Jackson HTTP Deserializer |
| **Database Connection Exhaustion** | 3,000ms `statement_timeout` on all tenant transactions. | PostgreSQL / HikariCP |
| **Infinite Graph Traversal Loops** | Hard clamp `depth < 10` and `LIMIT 250` on Pattern C CTEs. | Recursive SQL Engine |
| **Storage Disk Hogging** | Daily usage tracking + graceful read-only transition at quota limit. | Batch Accounting Service |
