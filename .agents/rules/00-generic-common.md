---
trigger: always_on
---

# RULE MANAGEMENT SOP (CRITICAL CONSTRAINT)
Constraint: YOU MUST NEVER write long, detailed rules directly into the `.agents/rules/` directory.
Workflow:
  Step_1: Whenever the user asks to add or update a rule, FIRST write the full, verbose explanation and logic into `docs/master_rules_reference.md`.
  Step_2: SECOND, strictly distill the rule into a highly compact, imperative constraint (using YAML or bullet points).
  Step_3: THIRD, append ONLY the compacted version to either `00-generic-common.md` (if broad) or `01-workspace-specific.md` (if domain-specific).

# Generic Common Rules

- **OS-COMPAT**: MUST support Win/Linux/macOS. Use `node:path`. Dynamically detect `process.platform` & `process.arch` for external binaries. Set `chmod +x` on Unix.
- **DEFENSIVE-CODING**: NEVER crash main render loop. MUST wrap external/AI/volatile calls in `try/catch` with seamless fallbacks.
- **STATE-IMMUTABILITY**: NEVER mutate original assets/config in-place. Preserve original files on asset generation.
- **IMPORT-INTEGRITY**: MUST verify `import` statements at top of file when introducing functions/dependencies. NEVER truncate import blocks during edits.
- **ZERO-REGRESSION**: NEVER break existing working flows. MUST verify side-effects & maintain backward compatibility for all options.
