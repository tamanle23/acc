# Part 2: Database Migrations, Tenant-Scoped Uniqueness & Row-Level Security (RLS) Specification

**Series:** Multi-Tenant Architecture Blueprint Series (Document 02 of N)  
**Document Level:** Low-Level Technical Specification (LLTS) & Database DDL Blueprint  
**Target Systems:** `@acc/backend` (Spring Modulith / Java 21 / Liquibase / PostgreSQL 16+)  
**Scope:** Tenant-Scoped Indexing, Row-Level Security (RLS) Policies, Spring Modulith Connection Hooks, Zero Cross-Tenant Leakage  
**Status:** Canonical Living Architecture Document  

---

## 1. Context & Motivation

In Unipost's dynamic metadata architecture, both schemas (`UNIPOST_ENTITY_TYPES`, `UNIPOST_ATTRIBUTE_DEFINITIONS`) and records (`UNIPOST_ENTITIES`, `UNIPOST_ENTITY_RELATIONSHIPS`) are tenant-scoped. 

In initial single-tenant iterations:
1. `UNIPOST_ENTITY_TYPES.system_name` was enforced via a global partial unique index (`uk_entity_type_sysname_active`). This prevented two distinct tenants from having an entity with the same slug (e.g. `ent_customer`).
2. `UNIPOST_ATTRIBUTE_DEFINITIONS` did not carry a denormalized `tenant_id` column, forcing relationship joins whenever tenant checks were performed.
3. Database isolation relied strictly on client-provided query predicates (`WHERE tenant_id = ?`), which is vulnerable to developer error or subtle bypass bugs.

This specification defines the database migration strategy, Liquibase changelog DDL, PostgreSQL Row-Level Security (RLS) safety nets, and Spring Modulith session-binding interceptors required to achieve mathematical tenant isolation.

---

## 2. Liquibase Migration Changelog (`changelog-000.000.00005.xml`)

The following migration must be applied to the PostgreSQL schema via Liquibase:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<databaseChangeLog
  xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog
                      http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-3.4.xsd">

    <changeSet id="hybrid-metadata-tenant-scoped-rls-05" author="antigravity">
        <comment>Enforce pure tenant-scoped uniqueness, denormalized tenant_id, and PostgreSQL RLS</comment>

        <!-- ========================================================================= -->
        <!-- STEP 1: Add tenant_id to Metadata Plane Tables                            -->
        <!-- ========================================================================= -->
        <addColumn tableName="UNIPOST_ENTITY_TYPES">
            <column name="tenant_id" type="VARCHAR(255)" defaultValue="default-tenant">
                <constraints nullable="false"/>
            </column>
        </addColumn>

        <addColumn tableName="UNIPOST_ATTRIBUTE_DEFINITIONS">
            <column name="tenant_id" type="VARCHAR(255)" defaultValue="default-tenant">
                <constraints nullable="false"/>
            </column>
        </addColumn>

        <addColumn tableName="UNIPOST_RELATIONSHIP_TYPES">
            <column name="tenant_id" type="VARCHAR(255)" defaultValue="default-tenant">
                <constraints nullable="false"/>
            </column>
        </addColumn>

        <addColumn tableName="UNIPOST_ENTITY_RELATIONSHIPS">
            <column name="tenant_id" type="VARCHAR(255)" defaultValue="default-tenant">
                <constraints nullable="false"/>
            </column>
        </addColumn>

        <!-- ========================================================================= -->
        <!-- STEP 2: Replace Global Unique Indexes with Tenant-Scoped Partial Indexes   -->
        <!-- ========================================================================= -->
        <sql dbms="postgresql">
            -- 2.1 Entity Types: Tenant + System Name
            DROP INDEX IF EXISTS uk_entity_type_sysname_active;
            
            CREATE UNIQUE INDEX uk_entity_type_tenant_sysname_active 
            ON UNIPOST_ENTITY_TYPES (tenant_id, system_name) 
            WHERE "deletedDate" IS NULL;

            -- 2.2 Attribute Definitions: Tenant + Entity Type + System Name
            DROP INDEX IF EXISTS uk_attr_def_type_sysname_active;

            CREATE UNIQUE INDEX uk_attr_def_tenant_type_sysname_active 
            ON UNIPOST_ATTRIBUTE_DEFINITIONS (tenant_id, entity_type_id, system_name) 
            WHERE "deletedDate" IS NULL;

            -- 2.3 Relationship Types: Tenant + System Name
            DROP INDEX IF EXISTS uk_rel_type_sysname_active;

            CREATE UNIQUE INDEX uk_rel_type_tenant_sysname_active 
            ON UNIPOST_RELATIONSHIP_TYPES (tenant_id, system_name) 
            WHERE "deletedDate" IS NULL;
        </sql>

        <!-- ========================================================================= -->
        <!-- STEP 3: Composite Performance Indexes for Tenant-Scoped Queries            -->
        <!-- ========================================================================= -->
        <sql dbms="postgresql">
            CREATE INDEX IF NOT EXISTS idx_entities_tenant_type_active 
            ON UNIPOST_ENTITIES (tenant_id, entity_type_id) 
            WHERE "deletedDate" IS NULL;

            CREATE INDEX IF NOT EXISTS idx_entity_rels_tenant_source_active 
            ON UNIPOST_ENTITY_RELATIONSHIPS (tenant_id, source_entity_id) 
            WHERE "deletedDate" IS NULL;

            CREATE INDEX IF NOT EXISTS idx_entity_rels_tenant_target_active 
            ON UNIPOST_ENTITY_RELATIONSHIPS (tenant_id, target_entity_id) 
            WHERE "deletedDate" IS NULL;
        </sql>

        <!-- ========================================================================= -->
        <!-- STEP 4: PostgreSQL Row-Level Security (RLS) Safety Nets                    -->
        <!-- ========================================================================= -->
        <sql dbms="postgresql">
            -- 4.1 Enable and Force RLS on all Dynamic Metadata & Record tables
            ALTER TABLE UNIPOST_ENTITY_TYPES ENABLE ROW LEVEL SECURITY;
            ALTER TABLE UNIPOST_ENTITY_TYPES FORCE ROW LEVEL SECURITY;

            ALTER TABLE UNIPOST_ATTRIBUTE_DEFINITIONS ENABLE ROW LEVEL SECURITY;
            ALTER TABLE UNIPOST_ATTRIBUTE_DEFINITIONS FORCE ROW LEVEL SECURITY;

            ALTER TABLE UNIPOST_RELATIONSHIP_TYPES ENABLE ROW LEVEL SECURITY;
            ALTER TABLE UNIPOST_RELATIONSHIP_TYPES FORCE ROW LEVEL SECURITY;

            ALTER TABLE UNIPOST_ENTITIES ENABLE ROW LEVEL SECURITY;
            ALTER TABLE UNIPOST_ENTITIES FORCE ROW LEVEL SECURITY;

            ALTER TABLE UNIPOST_ENTITY_RELATIONSHIPS ENABLE ROW LEVEL SECURITY;
            ALTER TABLE UNIPOST_ENTITY_RELATIONSHIPS FORCE ROW LEVEL SECURITY;

            -- 4.2 Define RLS Policies for Metadata Plane (Allows Reading SYSTEM Schemas)
            CREATE POLICY tenant_isolation_entity_types ON UNIPOST_ENTITY_TYPES
                FOR ALL
                USING (
                    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
                    OR tenant_id = 'SYSTEM'
                )
                WITH CHECK (
                    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
                    AND tenant_id != 'SYSTEM'
                );

            CREATE POLICY tenant_isolation_attribute_defs ON UNIPOST_ATTRIBUTE_DEFINITIONS
                FOR ALL
                USING (
                    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
                    OR tenant_id = 'SYSTEM'
                )
                WITH CHECK (
                    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
                    AND tenant_id != 'SYSTEM'
                );

            CREATE POLICY tenant_isolation_rel_types ON UNIPOST_RELATIONSHIP_TYPES
                FOR ALL
                USING (
                    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
                    OR tenant_id = 'SYSTEM'
                )
                WITH CHECK (
                    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')
                    AND tenant_id != 'SYSTEM'
                );

            -- 4.3 Define RLS Policies for Data Plane
            CREATE POLICY tenant_isolation_entities ON UNIPOST_ENTITIES
                FOR ALL
                USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
                WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));

            CREATE POLICY tenant_isolation_entity_rels ON UNIPOST_ENTITY_RELATIONSHIPS
                FOR ALL
                USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''))
                WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), ''));
        </sql>
    </changeSet>
</databaseChangeLog>
```

---

## 3. Spring Modulith Session Binding Architecture

To activate PostgreSQL RLS on every transaction, the application must execute:
```sql
SET LOCAL app.current_tenant_id = '<active_tenant_id>';
```
This is bound via a custom Spring `@Transactional` connection interceptor or HikariCP connection wrapper.

```
Incoming Request (Bearer JWT)
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ TenantSecurityFilter (Spring Security)                 │
│ • Validates JWT signature                              │
│ • Binds `tenantId` to ThreadLocal `TenantContextHolder` │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ TenantAwareDataSourceAspect (@Around transactional)    │
│ • Obtains Connection from HikariPool                  │
│ • Executes `SET LOCAL app.current_tenant_id = ?`       │
│ • `SET LOCAL` automatically clears at TX commit/abort  │
└───────────────────────┬────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│ PostgreSQL Engine (RLS Active)                         │
│ • Any query without tenant filter is rejected          │
│ • Zero possibility of cross-tenant data leakage        │
└────────────────────────────────────────────────────────┘
```

### 3.1 Backend Interceptor Implementation Details
```java
package com.acc.fw.tenancy;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(-100)
public class TenantContextFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            // Extracted securely from verified JWT Claims
            String tenantId = JwtClaimsExtractor.extractTenantId(request);
            if (tenantId != null && !tenantId.isBlank()) {
                TenantContextHolder.setTenantId(tenantId);
            }
            filterChain.doFilter(request, response);
        } finally {
            TenantContextHolder.clear();
        }
    }
}
```

```java
package com.acc.fw.tenancy;

import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Aspect
@Component
public class TenantSessionAspect {

    private final JdbcTemplate jdbcTemplate;

    public TenantSessionAspect(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Before("@annotation(org.springframework.transaction.annotation.Transactional)")
    public void setPostgresTenantSession() {
        String tenantId = TenantContextHolder.getTenantId();
        if (tenantId != null && !tenantId.isBlank()) {
            jdbcTemplate.execute("SET LOCAL app.current_tenant_id = '" + tenantId.replace("'", "''") + "'");
        }
    }
}
```

---

## 4. Multi-Tenant Cache Key Specifications

The distributed Hazelcast and L1 in-memory caches must incorporate `tenant_id` into all cache keys to ensure isolated invalidation:

| Cache Domain | Key Pattern | Invalidation Trigger |
| :--- | :--- | :--- |
| **Compiled JsonSchema** | `schema:{tenant_id}:{system_name}:v{version}` | When an attribute is added/updated/archived in that tenant. |
| **Entity Type Metadata** | `type:{tenant_id}:{id_or_system_name}` | When entity model description or title changes. |
| **Attribute Definitions**| `attrs:{tenant_id}:{entity_type_id}` | When attributes for an entity are reordered or modified. |
| **Relationship Types** | `rel_types:{tenant_id}` | When edge types are created or modified in that tenant. |

---

## 5. Architectural Invariants Enforced by Part 2

1. **FORCE ROW LEVEL SECURITY**: The `FORCE` modifier ensures that even if the backend connects with table owner privileges, PostgreSQL still subjects the query to the tenant policy.
2. **SET LOCAL Scope**: `SET LOCAL` ensures that when the connection returns to the HikariCP connection pool, the tenant session variable does not persist or leak to the next worker thread.
3. **Double-Barreled Defense**: The backend code filters queries by `tenant_id = :tenantId` as standard practice, but PostgreSQL RLS acts as a mathematical backstop to catch developer omissions.
