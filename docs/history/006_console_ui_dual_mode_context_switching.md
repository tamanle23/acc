# 006. Phase 5: Console UI Dual-Mode Context Switching

**Date:** 2026-10-09  
**Status:** Completed  
**Scope:** `@acc/console` (`apps/console`)

## 1. Problem Statement
In a multi-tenant dynamic metadata system, tenant administrators need to design schemas and relationships ("Architect Mode"), but also need to test and verify the operational experience ("Operator Mode") without logging out or opening separate sessions. Operators, conversely, must never see schema builder controls, raw data types, or model mutation actions. Furthermore, base platform `SYSTEM` attributes must be visibly distinct and protected against mutation.

## 2. Plan & Architecture Decisions
- Add workspace mode (`architect` | `operator`) and tenant role (`TENANT_ADMIN`, `TENANT_OPERATOR`, `TENANT_VIEWER`) to `use-metadata-ui-store.ts`.
- Ensure safe tab fallbacks: if an admin switches to operator mode while on the `schema` tab, redirect to `data`.
- Guard `TabsTrigger[value="schema"]`, `+ New Model` button, and three-dot model actions behind `canManageSchema()`.
- Add visual differentiation: 🔒 **System Field** vs ✏️ **Custom** badges on attributes.
- Render technical schema inspection details in `DynamicFieldRenderer` exclusively when `workspaceMode === 'architect'`.
- Localize all labels and tooltips in both `en` and `vi`.

## 3. Changes
- **Store & API Types:**
  - `apps/console/src/features/metadata/api/types.ts`: added `tenantId` to `EntityType` and `AttributeDefinition`.
  - `apps/console/src/features/metadata/store/use-metadata-ui-store.ts`: added `workspaceMode`, `currentUserRole`, `setWorkspaceMode`, `toggleWorkspaceMode`, `canManageSchema()`, `canMutateRecords()`.
- **UI Components:**
  - `apps/console/src/features/metadata/components/metadata-feature.tsx`: added Liquid Glass mode toggle pill in header; conditionally rendered Schema tab.
  - `apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx`: guarded model creation and dropdown actions behind `canManageSchema()`.
  - `apps/console/src/features/metadata/components/schema-builder/attribute-card.tsx`: added `System Field` / `Custom` badges; disabled delete/archive/edit for `SYSTEM` attributes.
  - `apps/console/src/features/metadata/components/dynamic-fields/dynamic-field-renderer.tsx`: added technical schema inspection in `architect` mode.
- **Locales:**
  - `apps/console/src/locales/en/console.json` and `vi/console.json`: synchronized mode and badge keys.
- **Testing:**
  - `apps/console/src/features/metadata/__tests__/context-switching-store.test.ts`: verified mode switching, tab fallback, and role permissions.

## 4. Verification
- `tsc -b`: PASSED with 0 errors.
- `eslint`: PASSED with 0 errors on modified files.
- `vitest`: 37/37 existing tests passed; 4/4 context switching store tests passed.
