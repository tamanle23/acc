# Implementation Plan 158: Console UI Wiring for Dynamic Functional Indexing & Lease Expired DLQ Telemetry

**App:** `@acc/console`  
**Master Plan Reference:** [`docs/iterations/master_implementation_plan_iteration_38.md`](file:///c:/Users/Admin/workspace/git/acc/docs/iterations/master_implementation_plan_iteration_38.md)  
**Backend Companion Plan:** [`apps/backend/doc/implementation_plan_49.md`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/doc/implementation_plan_49.md)  

---

## 1. Goal Description
Wire `@acc/console` to leverage new backend resilience capabilities:
1. **Dynamic Attribute-Level Index Optimization**:
   - Provide an "Accelerate Filters with PostgreSQL Functional Index" switch in `AttributeDialog` so users can easily configure JSONB expression indexing without SQL knowledge.
2. **Lease Expired DLQ Classification**:
   - In the Dead-Letter Queue table (`/system/dlq`), visually highlight tasks quarantined due to `TASK_LEASE_EXPIRED` with dedicated badges, attempt counts, and one-click replay controls.

---

## 2. Proposed UI Changes

### `apps/console/src/features/metadata/components/schema-builder/attribute-dialog.tsx`
- State addition: `const [isIndexed, setIsIndexed] = useState<boolean>(false);`
- Populate `isIndexed` from `editingAttribute?.options?.indexed`.
- In `handleSave`, append `options.indexed = isIndexed`.
- Add Liquid Glass card in the *Validation & Options* tab with the switch control.

### `apps/console/src/features/dlq/components/dlq-columns.tsx`
- Parse `errorMessage` for `TASK_LEASE_EXPIRED`.
- Render `⚡ Lease Expired` badge with warning accent and attempt count.

---

## 3. Verification Plan
- `pnpm --filter @acc/console test -- schema-builder.test.tsx dlq-feature.test.tsx`
- `pnpm --filter @acc/console exec tsc --noEmit`
