# Technical Debt Evaluation — Spring Security Authorization & RBAC Design

**Date:** 2026-09-22  
**Scope:** `acc-fw` (`CustomPermissionEvaluator`, `JwtTokenHelper`, `JwtAuthenticationTokenFilter`), `acc-ms-identity` (`UserServiceImpl`, `UserRole`, `UserPermission`)  
**Artifact Index:** `walkthrough_08.md`

---

## Executive Summary

An architectural evaluation of the current Spring Security authorization system, role/permission model, and JWT token propagation was conducted. While the current model cleanly separates method-level authorization (`@PreAuthorize`) from controller logic, four critical technical debts and security vulnerabilities were identified that require remediation in future sprints.

---

## Technical Debt Items

### TD-SEC-01: Hardcoded Superuser Bypass in `CustomPermissionEvaluator`

* **Location:** `com.acc.fw.security.CustomPermissionEvaluator` (Line 34)
* **Description:**
  ```java
  (permission.equalsIgnoreCase(PermissionActionConstants.LIST) && 
   grant.getAuthority().equalsIgnoreCase("ROLE_ADMINISTRATOR"))
  ```
* **Impact & Risk:**
  - Hardcoding string literals like `"ROLE_ADMINISTRATOR"` inside low-level framework evaluation logic breaks extensibility.
  - Introducing new administrative roles (e.g., `ROLE_SUPER_ADMIN`, `ROLE_TENANT_ADMIN`) will fail permission checks unless framework code is modified and recompiled.
* **Proposed Remediation:**
  - Replace hardcoded role checks with Spring Security's native `RoleHierarchy` bean configuration (`ROLE_SUPER_ADMIN > ROLE_ADMINISTRATOR > ROLE_USER`).
  - Configure superuser wildcard permissions cleanly via database metadata or application properties.

---

### TD-SEC-02: Authority Inflation & JWT Payload Bloat

* **Location:** `com.acc.user.service.impl.UserServiceImpl` (Lines 437–459), `com.acc.fw.core.jwt.JwtTokenHelper`
* **Description:**
  - During authentication, every permission code associated with a user's roles AND direct permissions is flattened into a single string list and stored directly inside the JWT token's `authorities` claim.
* **Impact & Risk:**
  - For users assigned multiple roles with hundreds of fine-grained permissions, the HTTP `Authorization` header grows significantly in size.
  - Can cause `413 Request Entity Too Large` HTTP errors or exceed Nginx/API Gateway header buffer limits (`large_client_header_buffers`).
* **Proposed Remediation:**
  - Store **only Role codes** (e.g. `ROLE_ADMIN`, `ROLE_OPERATOR`) inside the JWT token payload.
  - Resolve fine-grained permissions dynamically during request execution, backed by a high-speed L2 cache (Redis) keyed by `uid` or session ID.

---

### TD-SEC-03: Stale Permissions & Delayed Revocation (Stateless Gap)

* **Location:** `com.acc.fw.core.jwt.JwtAuthenticationTokenFilter`
* **Description:**
  - Since permissions are encoded directly into the JWT token payload at login, subsequent database updates (revoking a role or removing a permission from a user) have **no immediate effect** on active sessions.
* **Impact & Risk:**
  - A compromised or demoted user retains their full privilege set until their JWT token expires (up to `jwtTokenExpiration`).
* **Proposed Remediation:**
  - Implement a token revocation / blacklist mechanism in Redis (`token_version` or invalidation timestamp check during `JwtAuthenticationTokenFilter.doFilterInternal`).

---

### TD-SEC-04: Schema-Code Naming Disconnect in Permissions

* **Location:** `com.acc.user.model.Permission`, `com.acc.fw.security.CustomPermissionEvaluator`
* **Description:**
  - `Permission` entity defines separate `target` (e.g. `users`) and `action` (e.g. `list`) fields, but `CustomPermissionEvaluator` constructs string comparisons using `NamedModel.code` formatted as `TARGET_ACTION` (e.g. `USERS_LIST`).
* **Impact & Risk:**
  - If a developer creates a `Permission` entity where `code` deviates from the `TARGET_ACTION` pattern, `@PreAuthorize("hasPermission('target', 'action')")` checks will silently fail.
* **Proposed Remediation:**
  - Enforce permission code generation programmatically from `target` and `action` in entity lifecycle listeners (`@PrePersist`, `@PreUpdate`), or validate format in data migrations.

---

## Action Plan & Backlog Summary

| ID | Title | Severity | Target Module |
|---|---|---|---|
| **TD-SEC-01** | Replace hardcoded `ROLE_ADMINISTRATOR` with `RoleHierarchy` | Medium | `acc-fw` |
| **TD-SEC-02** | Refactor JWT payload: store roles only, load permissions to Redis | High | `acc-fw`, `acc-ms-identity` |
| **TD-SEC-03** | Implement Redis-backed JWT revocation check | High | `acc-fw` |
| **TD-SEC-04** | Enforce `target_action` code format in `Permission` model | Low | `acc-ms-identity` |
