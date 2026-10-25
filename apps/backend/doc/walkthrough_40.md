# Walkthrough 40 - Authorize Workflow DLQ Controller for SYSTEM Root Custodians

## Summary
Secured Dead-Letter Queue management endpoints with strict authorization and aligned routing with Sovereign Platform Root:
1. **Sovereign Authorization**: Applied `@PreAuthorize("hasAuthority('ROLE_SYSTEM_CUSTODIAN') or hasAuthority('platform:dlq:manage')")` to `WorkflowDlqController`.
2. **Dual-Route Mapping**: Mapped controller to both `{"/api/v1/system/dlq", "/api/v1/workflow/dlq"}` to match the sovereign system path while preserving backward compatibility.
3. **Cross-Tenant Fleet Querying**: Updated `resolveTenantId()` so Sovereign Custodians can inspect poison tasks across the entire fleet or pass `?tenantId=...` for tenant-scoped diagnostics.
4. **Role Matrix & Ephemeral Authorities**: Enriched `ROLE_SYSTEM_CUSTODIAN` in `SystemFleetService` and ephemeral Assume-Tenant delegation tokens with `"platform:dlq:manage"`.

---

## Changes
- **Controller**:
  - `apps/backend/acc-ms-aio/.../WorkflowDlqController.java`: Added dual route mapping, `@PreAuthorize`, and `queryTenantId` parameter in `listDlqTasks`.
- **System Fleet Service**:
  - `apps/backend/acc-fw/.../SystemFleetService.java`: Added `"platform:dlq:manage"` to `ROLE_SYSTEM_CUSTODIAN` permissions and ephemeral token generation.
- **Tests**:
  - `apps/backend/acc-ms-aio/.../WorkflowDlqRestApiTest.java`: Added tests for security annotations, `/api/v1/system/dlq` mapping, and fleet-wide querying.
  - `SystemFleetControllerTest.java`: 11/11 tests green.

---

## Verification Results
- `WorkflowDlqRestApiTest`: 3/3 passed.
- `SystemFleetControllerTest`: 11/11 passed.
- `workflow-engine`: 45/45 passed.
