# Zero Regression & Workflow Stability Rule

**Context:** The codebase has reached a high level of complexity with multiple interconnected features (e.g., rendering pipelines, overlay effects, upscaling, 3D depth, subtitles). Isolated bug fixes or new implementations have a high risk of breaking existing working flows if not carefully integrated.

### The Constraint

When fixing bugs, writing new implementations, or refactoring:
1. **Zero Regression Guarantee**: Your changes **MUST NOT** break any currently functioning workflow. A fix for one edge case cannot be allowed to crash the main execution path.
2. **Side-Effect Awareness**: Before deleting code or changing a function signature, trace its usage. If a variable, flag, or import is used by another module, you must preserve it or refactor the dependents safely.
3. **Strict Code Replacement**: When applying code edits (e.g., via `replace_file_content`), ensure that surrounding logic, fallbacks, error handling, and imports are completely preserved.
4. **End-to-End Mindset**: Always ask: "Does this change alter the behavior of existing features?" If a new feature is added, it must be opt-in or have safe fallbacks so that older configurations run flawlessly.
