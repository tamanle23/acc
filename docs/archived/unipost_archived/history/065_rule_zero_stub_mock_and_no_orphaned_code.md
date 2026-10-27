# History Entry 065: Rule SOP - Zero-Stub/Mock Prohibition & Active Execution Invariant

## Problem Statement
When executing implementation plans or architectural phases, writing synthetic mocks, temporary stubs, fake test targets, or "implemented but put aside" orphaned code introduces severe risks:
1. Deceptive green test suites that test synthetic mocks rather than real production behavior.
2. Invariants (security, multi-tenancy, RLS, cryptographic guarantees) remain unverified against real execution engines.
3. Dead, unreferenced code paths accumulate across the codebase.

## Proposed Plan
Follow the mandatory **Rule Management SOP**:
1. **Step 1 (Source of Truth)**: Document the full rationale, architecture, and non-negotiable directives in Section 10 of `docs/master_rules_reference.md`.
2. **Step 2 (Categorization)**: Categorize the constraint as Generic Common (applicable across all projects, tiers, and technologies).
3. **Step 3 (Distillation)**: Condense the rules into imperative constraints:
   - `ZERO-STUB-PROHIBITION`: Strictly forbids synthetic stubs, mocks, fake adapters, or deterministic pass-throughs when validating backend, security, multi-tenancy, RLS, cryptographic, or architectural invariants. Tests MUST exercise actual production classes, filters, and engines.
   - `NO-ORPHANED-CODE`: Forbids creating code that is put aside or disconnected from the active runtime graph. Every implementation MUST be wired into real consumers, registries, stores, or router pipelines.
4. **Step 4 (Append Active Rule)**: Append the distilled constraints to `.agents/rules/00-generic-common.md`.

## Changes Made
- `docs/master_rules_reference.md`: Added Section 10 ("Production-Grade Implementation & Zero-Stub / Mock Invariant") explaining the rationale and non-negotiable rules for real production execution.
- `.agents/rules/00-generic-common.md`: Added `ZERO-STUB-PROHIBITION` and `NO-ORPHANED-CODE` directives to Generic Common Rules.
- `docs/history/README.md`: Updated index with entry 065.

## Verification
- Verified rule SOP alignment across master reference and compact active rules.
- Confirmed strict adherence by checking existing test suites and code boundaries.

## Tasks Completed
- [x] Documented Section 10 in `docs/master_rules_reference.md`.
- [x] Appended distilled rules to `.agents/rules/00-generic-common.md`.
- [x] Created history log entry and updated history index.
