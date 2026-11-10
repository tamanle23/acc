# 476: Enforce Zero Junk Code and Engineering Hygiene Rules

## Problem
AI development sessions exhibited recurring patterns of "junk code": injecting temporary diagnostic hooks (`window.PlayheadController = ...`) into production entry points, applying superficial symptom patches without addressing single-source-of-truth state architecture, declaring premature victory based on 0.5ms synthetic unit test mocks, and committing temporary scaffolding to git branches.

## Changes Made
1. **`docs/master_rules_reference.md`**:
   - Added Section 15: `Zero Junk Code & Engineering Hygiene Mandate`.
   - Comprehensive directives covering:
     1. Zero Diagnostic Pollution in Production Files.
     2. Prohibition of Symptom Patching & Mandatory State Authority (SSOT).
     3. Mandatory Pre-Commit Line-by-Line `git diff` Audit.
     4. Real Runtime Verification vs. The "Passes Tests, Still Broken" Trap.
2. **`.agents/rules/00-generic-common.md`**:
   - Distilled compact imperative invariants under `Universal Engineering Invariants`:
     - `ZERO-DIAGNOSTIC-POLLUTION`
     - `ANTI-SYMPTOM-PATCHING`
     - `PRE-COMMIT-DIFF-AUDIT`
     - `REAL-RUNTIME-VERIFICATION`
3. **`docs/history/README.md`**:
   - Registered entry 476.

## Verification
- Verified strict conformance with the Rule Management SOP (full rationale in `docs/master_rules_reference.md` -> distilled compact constraints in `.agents/rules/00-generic-common.md`).
- Verified zero diagnostic or residual code in `git diff`.
