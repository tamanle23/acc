# 211. Token Optimization and System Refactoring of Rules & AGENTS.md

## Problem
The active rules in `.agents/rules/` (`00-generic-common.md`, `01-workspace-specific.md`, `02-unified-sandbox.md`, `02-overlay-effects.md`, `03-sound-effects.md`) and the master agent instruction file `AGENTS.md` contained significant token overhead, conversational fluff, and duplicated directives, running counter to the repository's Rule Management SOP and guardrails.

## Plan
1. Refactor and streamline `AGENTS.md` to remove duplicated directives, trim prose, and consolidate guardrails, handoffs, and skill mappings into concise bullet points and tables.
2. Refactor `.agents/rules/00-generic-common.md` to eliminate repetitive headers and streamline engineering invariants and agent directives.
3. Optimize `.agents/rules/01-workspace-specific.md` to preserve exact technical specifications (workspace registry, packaging, Liquid Glass, Video-IR, and metadata invariants) while cutting token bloat.
4. Streamline `.agents/rules/02-unified-sandbox.md` into high-density imperative constraints.
5. Standardize `.agents/rules/02-overlay-effects.md` and `.agents/rules/03-sound-effects.md` with explicit frontmatter triggers.
6. Verify file integrity and track changes in documentation history.

## Changes
- `AGENTS.md`: Reduced token footprint by ~50% while strictly preserving guardrails, domain skill routing matrix, feature handoff sequence, and prohibitions.
- `.agents/rules/00-generic-common.md`: Condensed universal constraints, WCAG 2.2 AA accessibility, and autonomous execution directives into terse imperative bullets.
- `.agents/rules/01-workspace-specific.md`: Streamlined monorepo registry, packaging boundaries, i18n sync, Liquid Glass UI tokens, Video-IR invariants, and metadata engine constraints.
- `.agents/rules/02-unified-sandbox.md`: Compacted unified sandbox integration mandate, handler registration, and dev-only guarding.
- `.agents/rules/02-overlay-effects.md`: Formatted with YAML trigger frontmatter and dense routing/blend specs.
- `.agents/rules/03-sound-effects.md`: Formatted with YAML trigger frontmatter and dense 3-layer frequency specs.

## Verification
- Confirmed zero orphaned directives; all core architectural constraints and references to `docs/master_rules_reference.md` remain 100% intact.
- Verified all 5 rule files and `AGENTS.md` parse cleanly and follow the two-tier rule management standard.

## Walkthrough
1. Inspect initial line counts and token weights across `.agents/rules/` and `AGENTS.md`.
2. Rewrite `AGENTS.md` with high-density architectural tables and direct rules.
3. Compress `.agents/rules/00-generic-common.md` and `.agents/rules/01-workspace-specific.md`.
4. Standardize `.agents/rules/02-unified-sandbox.md`, `02-overlay-effects.md`, and `03-sound-effects.md`.
5. Update history index and stage changes.
