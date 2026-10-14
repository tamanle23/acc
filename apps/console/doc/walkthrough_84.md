# Walkthrough 84: Fix React Rules of Hooks Order in SchemaBuilder

We resolved the React error `Error: Rendered more hooks than during the previous render` in `SchemaBuilder` by moving all React hooks above the `isLoading` conditional return.

---

## 1. Problem & Root Cause

- In [`schema-builder.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx), `useTenantBilling()`, `useSpringAuthStore()`, and `useSandboxStore()` were placed below the conditional early return:
  ```tsx
  if (isLoading) {
    return <LoadingIndicator />;
  }

  const { data: billing } = useTenantBilling(); // <-- VIOLATION: Hook called after early return!
  ```
- When `isLoading` was `true` during the initial fetch, the component rendered and returned early, executing 6 hooks.
- Once the schema loaded and `isLoading` flipped to `false`, React proceeded past the `if` check and executed 3 additional hooks (`useTenantBilling`, `useSpringAuthStore`, `useSandboxStore`).
- React immediately caught the disparity and threw:
  `Error: Rendered more hooks than during the previous render. at useTenantBilling`.

---

## 2. Changes Made

### Top-Level Hook Placement (`schema-builder.tsx`)
- Relocated `useTenantBilling()`, `useSpringAuthStore()`, and `useSandboxStore()` to the top of `SchemaBuilder`, strictly before any conditional early returns:
  ```tsx
  export const SchemaBuilder: React.FC<Props> = ({ entityTypeId }) => {
    const { data: attributesResponse, isLoading } = useAttributeDefinitions(entityTypeId);
    const { data: entityType } = useEntityType(entityTypeId);
    const { openCreateAttributeDialog, openJsonSchemaPreview } = useMetadataUiStore();
    const { data: billing } = useTenantBilling();
    const { user } = useSpringAuthStore();
    const { activePersonaId } = useSandboxStore();
    const activeTenantId = useMetadataUiStore((s) => s.activeTenantId);
    ...
    if (isLoading) {
      return <LoadingIndicator />;
    }
  ```
- Guaranteed a deterministic, identical hook execution count on every render pass.

---

## 3. Verification

- Ran `pnpm --filter @unipost/console test src/features/metadata`:
  - **9 test files passed**, **55 tests passed** (100% pass rate).
