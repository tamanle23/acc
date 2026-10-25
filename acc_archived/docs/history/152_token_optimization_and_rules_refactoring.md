# [152] Token Optimization & System Refactoring of `.agents/rules/`

## 1. Context & Problem Statement
The rule files inside `.agents/rules/` are injected into context across every interaction and turn. Prior to this refactoring:
- `00-generic-common.md` was 5,745 bytes (~1,450 tokens) with significant conversational padding, verbose section headers, and repetitive phrasing.
- `01-workspace-specific.md` was 3,558 bytes (~900 tokens) with redundant explanatory text and cross-references.
- Total byte footprint was nearly 12 KB, consuming excessive context tokens per turn while violating the project's own rule management directive to strictly distill rules into compact imperative constraints.

## 2. Implementation Plan
1. Audit all 5 rule files in `.agents/rules/` (`00-generic-common.md`, `01-workspace-specific.md`, `02-overlay-effects.md`, `03-sound-effects.md`, `04-backlog-management.md`).
2. Verify master rationale and specifications are preserved in `docs/master_rules_reference.md` as single source of truth.
3. Distill and condense all rules into high-density imperative constraints:
   - Eliminate filler prose, redundant explanations, and duplicate section markers.
   - Retain 100% of functional requirements, safety invariants, commands, codecs, and architectural anchors.
4. Record history entry in `docs/history/README.md` and commit changes.

## 3. Changes Made
- [00-generic-common.md](file:///c:/Users/Admin/workspace/git/acc/.agents/rules/00-generic-common.md): Reduced from 5,745 B to 2,365 B (~59% token reduction). Consolidated directives, discovery bounds, coding standards, and archival protocols into compact imperative statements.
- [01-workspace-specific.md](file:///c:/Users/Admin/workspace/git/acc/.agents/rules/01-workspace-specific.md): Reduced from 3,558 B to 2,064 B (~42% token reduction). Streamlined 8-point sync checklist, zero-copy Bun FFI constraints, and zero-allocation frame loop requirements.
- [02-overlay-effects.md](file:///c:/Users/Admin/workspace/git/acc/.agents/rules/02-overlay-effects.md): Reduced from 1,168 B to 1,065 B. Preserved exact overlay methods (`alpha`, `screen`, `multiply`, `overlay`), filters, and zero-disk memory pipeline rules.
- [03-sound-effects.md](file:///c:/Users/Admin/workspace/git/acc/.agents/rules/03-sound-effects.md): Reduced from 865 B to 809 B. Preserved 3-layer frequency blueprint and engine selection mapping.
- [04-backlog-management.md](file:///c:/Users/Admin/workspace/git/acc/.agents/rules/04-backlog-management.md): Kept intact (already ultra-compact YAML schema at 638 B).

## 4. Verification & Results
- Total `.agents/rules/` footprint decreased from 11,974 bytes to 6,941 bytes (~42% total reduction across the entire rule set, ~59% reduction on generic common rules).
- All core constraints, regexes, codecs, filters, and safety rules remain intact with zero functional loss.
