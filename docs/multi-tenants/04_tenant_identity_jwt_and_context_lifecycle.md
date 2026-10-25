# Part 4: Tenant Identity, JWT Claims & Spring Security Lifecycle

**Series:** Multi-Tenant Architecture Blueprint Series (Document 04 of N)  
**Document Level:** Security Architecture & Technical Specification  
**Target Systems:** `@acc/backend` (Spring Modulith / Spring Security 6 / Java 21), `@acc/console` (React 19 / Axios)  
**Scope:** Cryptographic Token Claims, Security Filter Chains, `TenantContextHolder`, Async / Reactive Context Propagation, Anti-Spoofing Guarantees  
**Status:** Canonical Living Architecture Document  

---

## 1. Context & Security Objectives

In a pure multi-tenant metadata system, the **Security Context** is the primary enforcement mechanism protecting tenant data from unauthorized cross-boundary access. 

### Core Objectives
1. **Zero Client Trust (Eliminate IDOR Attacks)**:
   The backend must **never** trust a client-supplied `tenant_id` from query parameters, request bodies, or custom HTTP headers (`X-Tenant-Id`). The active tenant must be derived exclusively from a cryptographically signed JSON Web Token (JWT).
2. **Context Binding Across Concurrency Boundaries**:
   The active `tenant_id` and user authorities must safely propagate through Spring MVC synchronous threads, `@Async` worker thread pools, and Spring Modulith event handlers without context leakage.
3. **Graceful Multi-Tenant Support**:
   Users who possess memberships in multiple distinct tenants must be able to switch active tenants via a secure Token Exchange protocol without re-authenticating.

---

## 2. JWT Claim Schema Specification

Every access token issued by Acc's Identity service (`acc-ms-identity`) contains structured standard and custom claims:

```json
{
  "iss": "https://auth.acc.io",
  "sub": "usr_991823a1-002",
  "aud": "acc-platform",
  "exp": 1791480000,
  "nbf": 1791476400,
  "iat": 1791476400,
  "jti": "jwt_b710f824-c119-4bb4",
  
  "tid": "tnt_acme_corp_881",
  "tenant_name": "Acme Global Logistics",
  "user_name": "alex.chen@acme.com",
  "user_type": "ORGANIZATION_MEMBER",
  
  "roles": [
    "TENANT_ADMIN"
  ],
  "permissions": [
    "metadata:schema:read",
    "metadata:schema:write",
    "metadata:schema:delete",
    "entity:record:read",
    "entity:record:write",
    "entity:record:delete",
    "entity:edge:manage"
  ]
}
```

### Claim Definitions
* **`sub` (Subject)**: The globally unique identifier of the user principal (`usr_...`).
* **`tid` (Tenant ID)**: The globally unique identifier of the active tenant context (`tnt_...`). **This claim is the cryptographic root of all tenant isolation.**
* **`roles`**: High-level personas (`TENANT_ADMIN`, `TENANT_OPERATOR`, `TENANT_VIEWER`).
* **`permissions`**: Fine-grained capability scopes checked by Spring Method Security (`@PreAuthorize`).

---

## 3. The Spring Security Filter Pipeline

```
Incoming HTTP Request (Authorization: Bearer <JWT>)
                      │
                      ▼
┌────────────────────────────────────────────────────────┐
│ 1. HeaderSanitizerFilter                               │
│    • Strips any client-injected `X-Tenant-Id` header   │
│    • Prevents header-spoofing across reverse proxies   │
└─────────────────────┬──────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────┐
│ 2. JwtAuthenticationTokenFilter                        │
│    • Cryptographically verifies JWT signature (RS256)  │
│    • Validates expiration (`exp`) and not-before (`nbf`)│
│    • Parses `sub`, `tid`, `roles`, and `permissions`   │
│    • Constructs `TenantAuthenticationToken`            │
│    • Binds to Spring `SecurityContextHolder`           │
└─────────────────────┬──────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────┐
│ 3. TenantContextBindingFilter                          │
│    • Extracts `tid` from authenticated Authentication  │
│    • Sets ThreadLocal `TenantContextHolder`            │
│    • Registers cleanup in `finally` block              │
└─────────────────────┬──────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────┐
│ 4. MDCLoggingFilter                                    │
│    • Pushes `tenantId` and `userId` into SLF4J MDC     │
│    • Formats log statements with `[tenant:tnt_...]`    │
└─────────────────────┬──────────────────────────────────┘
                      │
                      ▼
               DispatcherServlet
```

---

## 4. Java Implementation Blueprint

### 4.1 The `TenantContextHolder`
Provides type-safe, thread-scoped access to the active tenant without coupling domain classes to Spring Security internals:

```java
package com.acc.fw.tenancy;

import java.util.Objects;

public final class TenantContextHolder {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContextHolder() {}

    public static void setTenantId(String tenantId) {
        CURRENT_TENANT.set(Objects.requireNonNull(tenantId, "tenantId cannot be null"));
    }

    public static String getTenantId() {
        return CURRENT_TENANT.get();
    }

    public static String getRequiredTenantId() {
        String tenantId = CURRENT_TENANT.get();
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalStateException("Security violation: No active TenantContext found on current thread");
        }
        return tenantId;
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
```

### 4.2 The `TenantContextBindingFilter`
Integrated directly into the Spring Security filter chain:

```java
package com.acc.fw.tenancy;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

public class TenantContextBindingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            
            if (authentication instanceof TenantAuthenticationToken tenantAuth) {
                TenantContextHolder.setTenantId(tenantAuth.getTenantId());
            }

            filterChain.doFilter(request, response);
        } finally {
            // Mandatory ThreadLocal cleanup to prevent thread-pool leakage
            TenantContextHolder.clear();
        }
    }
}
```

---

## 5. Asynchronous Context Propagation (`@Async` & Modulith Events)

A standard vulnerability in multi-tenant Spring applications is context loss when executing asynchronous tasks. Standard `ThreadLocal` variables do not automatically propagate to child or pooled threads.

### 5.1 Custom `TaskDecorator` for Thread Pools
Every `ThreadPoolTaskExecutor` bean in the application must be equipped with a context-propagating decorator:

```java
package com.acc.fw.tenancy;

import org.slf4j.MDC;
import org.springframework.core.task.TaskDecorator;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Map;

public class TenantAwareTaskDecorator implements TaskDecorator {

    @Override
    public Runnable decorate(Runnable runnable) {
        // Snapshot context from the calling parent thread
        String tenantId = TenantContextHolder.getTenantId();
        SecurityContext securityContext = SecurityContextHolder.getContext();
        Map<String, String> mdcContext = MDC.getCopyOfContextMap();

        return () -> {
            try {
                // Restore context onto the worker thread
                if (tenantId != null) {
                    TenantContextHolder.setTenantId(tenantId);
                }
                SecurityContextHolder.setContext(securityContext);
                if (mdcContext != null) {
                    MDC.setContextMap(mdcContext);
                }

                runnable.run();
            } finally {
                // Wipe context when worker thread finishes
                TenantContextHolder.clear();
                SecurityContextHolder.clearContext();
                MDC.clear();
            }
        };
    }
}
```

### 5.2 Thread Pool Configuration
```java
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "accAsyncTaskExecutor")
    public ThreadPoolTaskExecutor asyncTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(50);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("TenantAsync-");
        // Bind the tenant decorator
        executor.setTaskDecorator(new TenantAwareTaskDecorator());
        executor.initialize();
        return executor;
    }
}
```

---

## 6. Multi-Tenant Role-Based Access Control (RBAC) Enforcement

Controller endpoints in the Metadata Management module enforce permissions via Spring Method Security annotations:

```java
@RestController
@RequestMapping("/api/v1/metadata")
public class MetadataEntityController {

    private final EntityTypeService entityTypeService;
    private final EntityRecordService entityRecordService;

    // 1. Schema Management (Requires Metadata Admin scope)
    @PostMapping("/types")
    @PreAuthorize("hasAuthority('metadata:schema:write')")
    public ResponseEntity<EntityTypeDto> createEntityType(@Valid @RequestBody CreateEntityTypeRequest request) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        return ResponseEntity.ok(entityTypeService.createEntityType(tenantId, request));
    }

    // 2. Data Record Creation (Accessible to standard Operators)
    @PostMapping("/entities")
    @PreAuthorize("hasAuthority('entity:record:write')")
    public ResponseEntity<EntityRecordDto> createEntityRecord(@Valid @RequestBody CreateRecordRequest request) {
        String tenantId = TenantContextHolder.getRequiredTenantId();
        return ResponseEntity.ok(entityRecordService.saveRecord(tenantId, request));
    }
}
```

---

## 7. Multi-Tenant Switcher Protocol (Token Exchange)

When a user belongs to multiple organizations (e.g. an external consultant or IT administrator), they switch tenants without requiring credentials re-entry:

```
┌─────────────────┐                                  ┌───────────────────────┐
│ @acc/console│                                  │  acc-ms-identity  │
└────────┬────────┘                                  └───────────┬───────────┘
         │                                                       │
         │ 1. POST /api/v1/auth/switch-tenant                    │
         │    Headers: Authorization: Bearer <CURRENT_JWT>       │
         │    Body:    { "targetTenantId": "tnt_beta_99" }       │
         │──────────────────────────────────────────────────────>│
         │                                                       │
         │                                 2. Validate Membership:
         │                                    Verify user is an active member
         │                                    of targetTenantId
         │                                                       │
         │                                 3. Issue New Token:
         │                                    Mint new JWT with `tid: tnt_beta_99`
         │                                    and user's roles inside Beta
         │                                                       │
         │ 4. Response: { "accessToken": "<NEW_SCOPED_JWT>" }    │
         │<──────────────────────────────────────────────────────│
         │                                                       │
         │ 5. Client Updates Auth Header & Clears Metadata Cache │
```

---

## 8. Summary of Security Guarantees

| Attack Vector | Defense Mechanism in Part 4 |
| :--- | :--- |
| **Insecure Direct Object Reference (IDOR)** | `tenant_id` is never accepted from user payloads; extracted exclusively from signed JWT. |
| **Client Header Spoofing (`X-Tenant-Id`)** | `HeaderSanitizerFilter` strips external tenant headers at the network perimeter. |
| **Thread Pool Context Leaks** | `TenantAwareTaskDecorator` and `try/finally` blocks ensure `TenantContextHolder.clear()` runs after every task. |
| **Privilege Escalation** | Permissions (`metadata:schema:write`) are verified at the method level via `@PreAuthorize`. |
| **Auditing & Traceability** | `MDCLoggingFilter` stamps every log line with `[tenant:tnt_...]`, ensuring clear trace separation in Datadog/ELK. |
