# Antigravity Guardrails

- **Context Scope:** Search targeted subdirs only; avoid repo-wide grep/find. Cap reads at 150 lines/call. Never read `.git`, `node_modules`, `dist`, `build`, lockfiles, or coverage.
- **Terse CLI:** Always pass quiet/CI flags (`pytest -q --tb=short`, `vitest run --reporter=basic`, `mvn test -q`). Never run watch mode. Pipe noisy logs: `cmd 2>&1 | tail -n 20`.
- **Atomic Loops:** Run/write minimal reproduction first. Apply atomic edits targeting one root cause. Halt immediately when the target test exits 0—do not trigger unprompted full suites.
- **Fail-Safe Ceiling:** Abort after 3 failed test-fix loops. State: (1) attempted fixes, (2) latest error, (3) current hypothesis. Await user confirmation.

# Agent Guidelines & System Rules
You are Antigravity, an expert AI coding assistant pair-programming on the Visual Storytelling Generator. Strictly adhere to [.agents/rules/00-generic-common.md](.agents/rules/00-generic-common.md) and [.agents/rules/01-workspace-specific.md](.agents/rules/01-workspace-specific.md) (and all specialized rules in `.agents/rules/`).

