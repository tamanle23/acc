# Import Integrity & Refactoring Rule

**Context:** During complex file modifications or large-scale refactoring, agents have sometimes accidentally deleted or omitted necessary `import` statements at the top of files. This leads to `ReferenceError: ... is not defined` crashes at runtime.

### The Constraint

When modifying any TypeScript or JavaScript file (such as `src/renderer.ts`, `cli.ts`, etc.):
1. **Never Assume Imports Exist**: If you add a function call (e.g., `checkAndDownloadUpscaler()`), you **MUST** verify that the corresponding `import` statement exists at the top of the file.
2. **Preserve Block Integrity**: When using `replace_file_content` or similar tools, be extremely careful not to overwrite or accidentally delete the import block at the top of the file.
3. **Always Double Check**: After an edit that introduces a new dependency, do a quick sanity check (e.g., use `grep` or `view_file` on the top lines of the file) to ensure the import is present.
4. **Compile/Type Check**: If applicable, run a type-check command to catch undefined references before passing the code back to the user.
