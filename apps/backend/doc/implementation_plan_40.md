# Implementation Plan 40 - Authorize Workflow DLQ Controller for SYSTEM Root Custodians

## Problem Statement
The Dead-Letter Queue (DLQ) is an infrastructure-level capability that isolates poisoned tasks and zombie worker leases across all tenant workflows. Access must be restricted to Sovereign Custodians (`ROLE_SYSTEM_CUSTODIAN`) and system administrators with `platform:dlq:manage` authority. Furthermore, the controller should support both `/api/v1/system/dlq` and `/api/v1/workflow/dlq` to match the Sovereign Platform Root layout while preserving backward compatibility.

## Proposed Changes
1. **Backend SystemFleetService**:
   - Add `"platform:dlq:manage"` authority to `ROLE_SYSTEM_CUSTODIAN` in `roleMatrixStore` and ephemeral Assume-Tenant delegation tokens.
2. **Backend WorkflowDlqController**:
   - Add `@RequestMapping({"/api/v1/system/dlq", "/api/v1/workflow/dlq"})`.
   - Add `@PreAuthorize("hasAuthority('ROLE_SYSTEM_CUSTODIAN') or hasAuthority('platform:dlq:manage')")`.
   - Update `resolveTenantId` so Sovereign Custodians can query fleet-wide poison tasks (across all tenants) or filter to a specific tenant via `?tenantId=...`.
3. **Integration & Controller Tests**:
   - Update `WorkflowDlqRestApiTest.java` to verify new `/system/dlq` path, fleet-wide querying, and security annotations.

## Verification
- Run `mvn test -pl acc-ms-aio -Dtest=WorkflowDlqRestApiTest` and `mvn test -pl workflow-engine`.
