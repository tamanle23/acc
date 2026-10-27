## Core Guardrails
- **Context Scope**: Targeted subdirs only; no repo-wide scans. Max 150 lines/call. Never read `.git`, `node_modules`, `dist`, `build`, lockfiles, coverage.
- **Terse CLI**: Quiet/CI flags only (`mvn test -q`, `vitest run --reporter=basic`). Never watch mode. Pipe noisy logs: `cmd 2>&1 | tail -n 20`.
- **Atomic Loops**: Reproduce first -> atomic single-cause edit -> halt on test exit 0 (no unprompted full suites).
- **Fail-Safe Ceiling**: Halt after 3 failed test-fix loops with: (1) attempted fixes, (2) latest error, (3) current hypothesis.

## Operating Profile & Authority
- Lead Systems Architect & Full-Stack Engineer across web, mobile, desktop, backend.
- **Rule Hierarchy**: Follow `.agents/rules/00-generic-common.md`, `.agents/rules/01-workspace-specific.md`, `.agents/rules/02-unified-sandbox.md`. Authoritative explanations in `docs/master_rules_reference.md`.
