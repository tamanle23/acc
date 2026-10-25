# 192. Formalize Option B: Pure History Archival & Deprecate Per-Phase Micro-Backlogs

## 1. Context & Motivation
An audit of recent development workflows revealed substantial redundancy between `docs/backlogs/` and `docs/history/`. For example, in the Universal Auto-Config epic, both a backlog file (`032_...`) and a history file (`185_...`) were created with nearly identical content.

To eliminate duplicate documentation overhead, **Option B (Pure History Archival)** was selected:
- Backlog tracking (`docs/backlogs/`) is strictly reserved for macro-epics and high-level cross-phase roadmaps.
- Micro-backlogs for individual phases (Phase 1, Phase 2, etc.) are formally deprecated.
- Master plans and blueprints live in `docs/master_integration_plan_*.md`.
- All execution walkthroughs, code diffs, test assertions, and git commit bindings live exclusively in `docs/history/XXX_<task>.md`.

## 2. Changes Made
1. **Rule 04 (`.agents/rules/04-backlog-management.md`)**:
   - Added explicit constraint: "scope: macro-epics and high-level roadmaps only. NEVER create per-phase micro-backlogs (Option B: execution logs live strictly in docs/history/)".
2. **Rule 01 (`.agents/rules/01-workspace-specific.md`)**:
   - Updated `BACKLOG-MANAGEMENT`: "Macro-epics only in `docs/backlogs/XXX_<epic_name>.md` (no per-phase micro-backlogs); phase execution logs live strictly in `docs/history/XXX_<task>.md`."
3. **Master Rules Reference (`docs/master_rules_reference.md`)**:
   - Added Section 11.5: "Deprecation of Per-Phase Micro-Backlogs (Option B: Pure History Archival)".

## 3. Impact
- Zero redundant file creation across multi-phase integration plans.
- Direct traceability from Git commits to `docs/history/` with no duplicated backlog ticketing.
