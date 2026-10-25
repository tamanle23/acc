# Part 8: Tenant Data Backup, Streaming Export & GDPR Right-to-be-Forgotten Purge

**Series:** Multi-Tenant Architecture Blueprint Series (Document 08 of N)  
**Document Level:** Enterprise Compliance, Data Portability & Lifecycle Management Specification  
**Target Systems:** `@acc/backend` (Spring Modulith / Java 21 / PostgreSQL 16+ / S3/MinIO), `@acc/console` (React 19 / Vite 8)  
**Scope:** Tenant-Isolated Portable Data Bundles, Chunked Streaming Export (JSON/Parquet/NDJSON), Cryptographic Erasure & Cascading Hard-Purge, Audit & Compliance Guarantees (GDPR Art. 17 / Art. 20, SOC 2 Type II)  
**Status:** Canonical Living Architecture Document  

---

## 1. Executive Summary & Regulatory Context

In an enterprise multi-tenant dynamic metadata architecture, enterprise customers require two mandatory, legally enforced data lifecycle capabilities:
1. **Data Portability (GDPR Article 20 / California CCPA)**:
   A tenant must be able to export 100% of their data—including dynamic entity definitions, custom attribute schemas, JSONB records, edge relationships, and audit logs—in a standardized, vendor-neutral machine-readable format.
2. **Right to Be Forgotten / Cryptographic Hard-Purge (GDPR Article 17 / SOC 2 Type II)**:
   When an organization cancels its subscription or a user requests account termination, the platform must permanently delete or cryptographically shred all records associated with that `tenant_id` across physical tables, distributed caches, and file storage, while providing a verifiable Certificate of Erasure.

### Architectural Challenges in Hybrid JSONB Systems:
* **Memory Exhaustion on Large Tenants**: A tenant with 5,000,000 dynamic records cannot be exported into JVM heap memory at once. The export pipeline must be **fully chunked, non-blocking, and streamed**.
* **Foreign Key & Graph Deadlocks**: Deleting records with complex Pattern C relationship edges (`UNIPOST_ENTITY_RELATIONSHIPS`) can cause lock escalation and deadlocks if deleted naïvely.
* **RLS Bypassing during Offboarding**: Tenant deletion jobs require elevated internal privileges to clean up all partitions while ensuring no data from sibling tenants is accidentally touched.

---

## 2. Multi-Tenant Data Export Architecture (Data Portability)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              ASYNC EXPORT EXECUTION PIPELINE                           │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Client triggers Export -> POST /api/v1/tenant/export (Scope: SCHEMAS, DATA, AUDIT)   │
│ 2. Backend registers Job  -> Generates jobId, enqueues to Spring Batch / Modulith     │
│ 3. Streamed Cursor Read   -> PostgreSQL Keyset / Cursor (Fetch 1,000 records / chunk)  │
│ 4. Compression & Zip      -> Stream to S3 / Object Store: `tenant_{tid}_{jobId}.zip`   │
│ 5. Pre-Signed URL Issued  -> Expiry 24h, sent via secure email / Console Notification   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 The Portable Tenant Archive Structure (`tenant_bundle.zip`)
When extracted, the archive contains complete relational schemas and record datasets:
```
tenant_export_tnt_acme_20261008.zip
├── manifest.json                    # Metadata describing export version, timestamp, tenant info
├── schemas/
│   ├── entity_types.json           # All UNIPOST_ENTITY_TYPES definitions (both bespoke & extended)
│   ├── attribute_definitions.json  # Complete attribute definitions with validation rules & UI configs
│   ├── relationship_types.json     # All Pattern C relationship edge types
│   └── compiled_schemas/           # Standalone Draft-07 JSON Schema files for every entity
│       ├── ent_customer_acc.json
│       └── ent_vehicle.json
├── data/                           # Chunked data in Line-Delimited JSON (NDJSON) or Apache Parquet
│   ├── ent_customer_acc.ndjson     # Every line is: {"id": "...", "attributes": {...}, "createdDate": "..."}
│   ├── ent_vehicle.ndjson
│   └── entity_relationships.ndjson # All Pattern C edges with edge_metadata
└── audit/
    └── mutation_history.ndjson     # Audit logs and historical RFC 6902 JSON patches
```

### 2.2 Streaming Export Service Implementation
To prevent OutOfMemory (OOM) errors during export, records are processed using JDBC `FetchSize` streaming and written directly to an encrypted S3 multipart upload stream:

```java
package com.acc.tenant.export;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.domain.metadata.EntityRecord;
import jakarta.persistence.EntityManager;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.OutputStream;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class TenantExportService {

    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;
    private final S3StorageService storageService;

    @Async("accAsyncTaskExecutor")
    @Transactional(readOnly = true)
    public void executeStreamingExport(String tenantId, String jobId) {
        String s3Key = "exports/" + tenantId + "/" + jobId + ".zip";

        try (OutputStream s3Out = storageService.openUploadStream(s3Key);
             ZipOutputStream zipOut = new ZipOutputStream(s3Out)) {

            // 1. Export Metadata Manifest
            zipOut.putNextEntry(new ZipEntry("manifest.json"));
            zipOut.write(generateManifest(tenantId).getBytes());
            zipOut.closeEntry();

            // 2. Stream Data Records per Entity Type using DB Cursor
            zipOut.putNextEntry(new ZipEntry("data/records.ndjson"));
            try (Stream<EntityRecord> recordStream = entityManager
                    .createQuery("SELECT r FROM EntityRecord r WHERE r.tenantId = :tid", EntityRecord.class)
                    .setParameter("tid", tenantId)
                    .setHint("org.hibernate.fetchSize", 1000)
                    .getResultStream()) {

                recordStream.forEach(record -> {
                    try {
                        byte[] jsonBytes = objectMapper.writeValueAsBytes(record);
                        zipOut.write(jsonBytes);
                        zipOut.write('\n');
                    } catch (Exception e) {
                        throw new ExportStreamingException("Error serializing record " + record.getId(), e);
                    }
                });
            }
            zipOut.closeEntry();
            zipOut.finish();

            // 3. Mark Job COMPLETE and issue pre-signed download URL (24h expiry)
            storageService.completeExportJob(jobId, s3Key);

        } catch (Exception e) {
            storageService.failExportJob(jobId, e.getMessage());
        }
    }
}
```

---

## 3. The GDPR Right-to-Be-Forgotten (Hard-Purge) Pipeline

When a tenant contract terminates or an admin triggers a GDPR deletion, standard soft-deletion (`deletedDate = NOW()`) is legally insufficient. Article 17 mandates that personal and proprietary data must be **permanently expunged or rendered irreversibly inaccessible**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              THE 5-STAGE PURGE PIPELINE                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ STAGE 1: Tenant Freeze       -> Revoke all active JWTs, set Tenant.status = PURGING    │
│ STAGE 2: Pattern C Edge Wipe -> Delete UNIPOST_ENTITY_RELATIONSHIPS for tenant         │
│ STAGE 3: Record Batch Purge  -> Delete UNIPOST_ENTITIES in batches of 5,000            │
│ STAGE 4: Schema & Meta Wipe  -> Delete Tenant Attribute Defs, Types, and Rel Types     │
│ STAGE 5: Cache & File Shred  -> Evict all Hazelcast keys + Delete S3 tenant prefixes   │
│ STAGE 6: Certificate Created -> Store non-PII audit record: TenantPendedPurgeReceipt   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Batch Deletion to Prevent Lock Escalation
Deleting millions of rows in a single SQL statement causes long-running table locks and WAL spikes. The purge engine operates in small, high-throughput micro-transactions:

```sql
-- Stored Procedure / Scheduled Batch Worker
DO $$
DECLARE
    deleted_count INT;
BEGIN
    -- 1. Purge Pattern C Graph Edges in batches
    LOOP
        DELETE FROM UNIPOST_ENTITY_RELATIONSHIPS
        WHERE id IN (
            SELECT id FROM UNIPOST_ENTITY_RELATIONSHIPS 
            WHERE tenant_id = :targetTenant 
            LIMIT 5000
        );
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        EXIT WHEN deleted_count = 0;
        COMMIT;
    END LOOP;

    -- 2. Purge JSONB Data Records in batches
    LOOP
        DELETE FROM UNIPOST_ENTITIES
        WHERE id IN (
            SELECT id FROM UNIPOST_ENTITIES 
            WHERE tenant_id = :targetTenant 
            LIMIT 5000
        );
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        EXIT WHEN deleted_count = 0;
        COMMIT;
    END LOOP;

    -- 3. Purge Tenant Metadata Overlays & Bespoke Types
    DELETE FROM UNIPOST_ATTRIBUTE_DEFINITIONS WHERE tenant_id = :targetTenant;
    DELETE FROM UNIPOST_RELATIONSHIP_TYPES WHERE tenant_id = :targetTenant;
    DELETE FROM UNIPOST_ENTITY_TYPES WHERE tenant_id = :targetTenant;

    -- Note: Common System Schemas (`tenant_id = 'SYSTEM'`) are NEVER touched!
END $$;
```

### 3.2 Distributed Cache Eviction & Cryptographic Shredding
Once database rows are removed:
1. **Hazelcast Cluster Eviction**:
   A cluster-wide broadcast invalidates all keys matching `schema:{targetTenant}:*` and `data:{targetTenant}:*`.
2. **S3 / Blob Shredding**:
   Issue an S3 batch delete job for the bucket prefix: `s3://acc-storage/tenants/{targetTenant}/*`.
3. **Immutable Certificate of Erasure**:
   An immutable, anonymized audit log is preserved in compliance with regulatory oversight:
   ```json
   {
     "certificateId": "cert_del_99812401",
     "tenantIdHash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
     "purgedAt": "2026-10-08T14:40:00Z",
     "recordsDeleted": 142050,
     "edgesDeleted": 31200,
     "schemasDeleted": 12,
     "executedBy": "usr_compliance_officer_01",
     "status": "PERMANENTLY_EXPUNGED"
   }
   ```

---

## 4. Summary of Compliance Guarantees

| Compliance Standard | Platform Guarantee | Technical Mechanism |
| :--- | :--- | :--- |
| **GDPR Art. 20 (Portability)** | Full data & schema export delivered within $< 15\text{ minutes}$. | Chunked streaming export to encrypted ZIP archive with JSON Schemas + NDJSON data. |
| **GDPR Art. 17 (Erasure)** | Complete destruction of all tenant data within 30 days of cancellation. | 5-stage batch purge, micro-transaction deletes, S3 prefix wipe, and Hazelcast eviction. |
| **SOC 2 Type II (Isolation)** | Purge operations can never bleed into sibling tenants. | All purge operations enforce `tenant_id = :targetTenant` and run under supervised compliance tasks. |
| **Database Stability** | Zero lock escalation or database freeze during massive tenant purges. | Micro-batched deletes (5,000 rows/commit) prevent lock contention on shared PostgreSQL tables. |
