# Walkthrough 158: Console UI Wiring for Functional Indexing & Lease Expired DLQ Badges

**App:** `@acc/console`  
**Master Iteration Reference:** [`docs/iterations/master_implementation_plan_iteration_38.md`](file:///c:/Users/Admin/workspace/git/acc/docs/iterations/master_implementation_plan_iteration_38.md)  
**Date:** 2026-10-27  
**Version:** Iteration 38  

---

## 1. Overview
Wired the Console UI application to support backend resilience and query acceleration features:
1. **Schema Builder Functional Index Toggle (`AttributeDialog`)**:
   - Added a Liquid Glass switch card labeled **"PostgreSQL Functional Index"** in the *Validation & Options* tab.
   - Binds directly to `options.indexed` on `CreateAttributeRequest` / `UpdateAttributeRequest`.
   - Allows users to request automated database index generation without manual DBA interventions.
2. **Dead-Letter Queue Lease Expired Telemetry (`dlq-columns.tsx`)**:
   - Detected `TASK_LEASE_EXPIRED` in `errorMessage`.
   - Rendered high-visibility `⚡ Lease Expired` badge with amber warning accent and retry attempt details.

---

## 2. Verification
1. **Vitest Unit Suite**:
   ```bash
   pnpm --filter @acc/console test -- schema-builder.test.tsx dlq-feature.test.tsx
   ```
   - 2 test files passed, 10 tests green.
2. **TypeScript Compilation**:
   ```bash
   pnpm --filter @acc/console exec tsc --noEmit
   ```
   - Clean compilation with exit code 0.
