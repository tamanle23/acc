# [156] Token Optimization & System Refactoring of `.agents/rules/` and `AGENTS.md`

## 1. Context & Problem Statement
The rule files inside `.agents/rules/` and the root `AGENTS.md` are continuously injected into the agent context across every turn. Even minor redundant phrasing, unnecessary carriage returns, filler words, or duplicate instructions inflate context consumption on every interaction.

## 2. Implementation Plan
1. Audit and streamline `AGENTS.md` and all rules in `.agents/rules/`:
   - `00-generic-common.md`
   - `01-workspace-specific.md`
   - `02-overlay-effects.md`
   - `03-sound-effects.md`
   - `04-backlog-management.md`
2. Eliminate redundant prose, trailing empty lines, and excessive sentence padding while retaining 100% of architectural invariants, safety constraints, codecs, FFI zero-copy rules, and 8-point sync checklists.
3. Update `docs/history/README.md` and record entry `156`.

## 3. Changes Made
- `AGENTS.md`: Distilled into a single concise imperative instruction referencing rule files.
- `.agents/rules/00-generic-common.md`: Compressed directives, context discovery boundaries, and coding standards.
- `.agents/rules/01-workspace-specific.md`: Streamlined 8-point sync checklist and native memory frame loop rules.
- `.agents/rules/02-overlay-effects.md`: Consolidated overlay mode mappings and routing specs.
- `.agents/rules/03-sound-effects.md`: Trimmed engine classifications and frequency blueprint definitions.
- `.agents/rules/04-backlog-management.md`: Verified and preserved clean structured schema.

## 4. Verification & Results
- Total bytes and tokens reduced across rules directory and `AGENTS.md`.
- Full test suite verified for zero regression.
