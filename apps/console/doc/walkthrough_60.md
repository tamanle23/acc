# Walkthrough - Phase 5: Console UI Dual-Mode Context Switching

Implemented dual-mode context switching between "Architect Studio" (schema modeling) and "Operator View" (business data entry) in `@acc/console`, providing tenant administrators instant dogfooding capability while strictly enforcing role-based tab access and visual differentiation for base `SYSTEM` vs. custom attributes.

## Changes

### 1. Store State Expansion & Multi-Tenancy RBAC
- [`use-metadata-ui-store.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/store/use-metadata-ui-store.ts):
  - Defined `WorkspaceMode = 'architect' | 'operator'` and `TenantRole = 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_VIEWER'`.
  - Added state fields: `activeTenantId`, `activeTenantName`, `currentUserRole`, `workspaceMode`.
  - Added actions: `setWorkspaceMode` (with safe fallback redirecting from `schema` tab to `data` tab when switching to `operator`), `toggleWorkspaceMode`, `setCurrentUserRole`, `setActiveTenant`.
  - Added computed selectors: `canManageSchema()` and `canMutateRecords()`.

### 2. Header Mode Switcher & Dynamic Tab Guarding
- [`metadata-feature.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/metadata-feature.tsx):
  - Rendered Liquid Glass mode toggle pill in header for `TENANT_ADMIN` users: `Architect Studio` (amber/sparkles) vs `Operator View` (emerald/user).
  - Dynamically guarded `<TabsTrigger value="schema">` behind `canManageSchema()`.

### 3. Entity Models Sidebar Adaptation
- [`entity-type-sidebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx):
  - Guarded the `+ New` model creation button and the three-dot model mutation menu (`Edit Model`, `Delete Model`) behind `canManageSchema()`.
  - When in `Operator View`, presents a clean, distraction-free model navigation rail.

### 4. Attribute Visual Badges & Immutability Protection
- [`attribute-card.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/schema-builder/attribute-card.tsx):
  - Base `SYSTEM` attributes display 🔒 **System Field** badge (`border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300`).
  - Tenant custom attributes display ✏️ **Custom** badge (`border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300`).
  - Disabled edit, delete, and archive action buttons on `SYSTEM` attributes with informative tooltips.
  - Allowed duplication of system attributes into new tenant custom attributes.

### 5. Dynamic Form Technical Schema Inspection
- [`dynamic-field-renderer.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/dynamic-fields/dynamic-field-renderer.tsx):
  - In `Architect Mode`, renders technical badges (`[SYSTEM]` / `[CUSTOM]`) and datatype indicators in the field header.
  - In `Operator Mode`, renders clean, user-friendly labels with zero technical clutter.

### 6. Internationalization
- [`en/console.json`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/locales/en/console.json) & [`vi/console.json`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/locales/vi/console.json):
  - Added translations for `metadata.mode.architect`, `metadata.mode.operator`, `metadata.badges.systemField`, `metadata.badges.customField`, and protection tooltips.

## Verification Results

### Automated Tests
- `pnpm --filter @acc/console exec tsc -b`: 0 errors.
- `pnpm --filter @acc/console exec eslint ...`: 0 errors.
- `src/features/metadata/__tests__/context-switching-store.test.ts`:
  - `allows TENANT_ADMIN to switch to architect and operator modes freely`: PASS
  - `prevents non-admins from entering architect mode`: PASS
  - `toggles mode back and forth for TENANT_ADMIN`: PASS
  - `enforces record mutation permissions based on role`: PASS
- All existing metadata unit test suites pass (37/37 tests).
