# Implementation Plan 164: Declarative Client-Side Authorization Safeguards (Zero-Legacy Clean Architecture)

## Goal Description
Eliminate all ad-hoc, component-by-component permission checks across `@acc/console` by introducing a centralized, declarative authorization safeguard layer (`<PermissionGuard />`, `<AuthorizedButton />`, `<AuthorizedDropdownMenuItem />`) wired directly to the canonical permission catalog across Workflows, Metadata Studio, User Directory, Settings, and DLQ.

## Alignment Decisions (from /grill-me)
- **Zero Backward Compatibility**: Clean-slate purge of all legacy strings (`WORKFLOW_*`, `METADATA_RECORD_*`, `ROLE_PERMISSIONS_FALLBACK`).
- **Visual Behavior**: Strict `disable` across all action triggers with zero hidden action buttons.
- **Tooltips**: Explain required role and clearance tier (e.g. "Requires Operations Manager or Workspace Owner clearance").
- **Dual-Gate**: UI disabled state + Axios pre-flight mutation cancellation.
- **Reactive Sandbox**: Instant permission re-evaluation on Sandbox Dock persona changes with zero full-page reload.
- **Store Modernization**: Remove `canManageSchema()` and `canMutateRecords()` from `useMetadataUiStore`. Consolidate on `useHasPermission()`.

## Proposed Changes

### Core Authorization Primitives (`apps/console/src/components/auth/`)
- `[NEW] permission-guard.tsx`: Core declarative guard component supporting `behavior="hide"` and `behavior="disable"`. Integrates accessible Radix tooltips to explain missing permission requirements.
- `[NEW] authorized-button.tsx`: Polymorphic button wrapper using `useHasPermission()`. Renders disabled with reason tooltip or hides when unauthorized.
- `[NEW] authorized-dropdown-item.tsx`: Dropdown menu item wrapper with automatic disabled/hidden state and accessible tooltip description.
- `[NEW] __tests__/permission-guard.test.tsx`: Comprehensive test suite verifying `'hide'`, `'disable'`, multi-permission `'all'`/`'any'` evaluation, and tooltip rendering.

### Workflows Domain (`apps/console/src/features/workflows/`)
- `[MODIFY] components/catalog/workflow-catalog-table.tsx`: Replace ad-hoc checks with `<AuthorizedButton permission="workflow:definition:manage">`.
- `[MODIFY] components/catalog/workflow-catalog-columns.tsx`: Wrap row actions (delete, toggle status) in `<AuthorizedDropdownMenuItem permission="workflow:definition:manage">`.
- `[MODIFY] components/studio/toolbar/dag-header-command-bar.tsx`: Wrap "Save Workflow", "Publish Version" with `<AuthorizedButton permission="workflow:definition:manage">`, and "Run / Simulate" with `<AuthorizedButton permission="workflow:execution:submit">`.
- `[MODIFY] approvals/approvals-inbox.tsx`: Wrap approval/rejection actions with `<AuthorizedButton permission="workflow:approval:execute">`.

### Metadata Domain (`apps/console/src/features/metadata/`)
- `[MODIFY] components/entity-type/entity-type-sidebar.tsx`: Wrap "New Model" button and row menu actions (Edit, Delete) with `<AuthorizedButton permission="metadata:schema:write">` and `<AuthorizedDropdownMenuItem permission="metadata:schema:write">`.
- `[MODIFY] components/metadata-feature.tsx`: Replace legacy `canManageSchema()` checks with `<PermissionGuard permission="metadata:schema:write">`.
- `[MODIFY] components/schema-builder/schema-builder.tsx`: Wrap "Add Attribute", "Reorder" with `<AuthorizedButton permission="metadata:schema:write">`.
- `[MODIFY] components/data-explorer/entity-data-grid.tsx`: Replace manual boolean flags with `<AuthorizedButton permission="entity:record:create">`, `<AuthorizedButton permission="entity:record:delete">`, and `<AuthorizedButton permission="entity:record:export">`.

### Users & Settings Domain (`apps/console/src/features/users/` & `settings/`)
- `[MODIFY] features/users/components/users-primary-buttons.tsx`: Wrap "Invite Member" / "Add User" with `<AuthorizedButton permission="workspace:members:manage">`.
- `[MODIFY] features/users/components/data-table-row-actions.tsx`: Wrap "Edit Roles", "Deactivate", "Reset Password" with `<AuthorizedDropdownMenuItem permission="workspace:members:manage">`.
- `[MODIFY] features/settings/billing/billing-panel.tsx`: Wrap "Upgrade Plan" / "Checkout" with `<AuthorizedButton permission="billing:subscription:upgrade">`.

## Verification Plan
1. **Automated Unit Tests**:
   - `pnpm --filter @acc/console test src/components/auth/`
   - `pnpm --filter @acc/console test src/features/workflows/`
   - `pnpm --filter @acc/console test src/features/metadata/`
   - `pnpm --filter @acc/console test src/features/users/`
2. **Manual Persona Verification**:
   - Switch between `Standard Member`, `Operations Manager`, `Workspace Owner`, and `Sovereign Custodian` in the Sandbox Dock.
   - Verify unauthorized buttons display accessible tooltips or are hidden without any 401/403 network failures.
