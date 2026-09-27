# Generic Common Rules

- **OS-COMPAT**: MUST support Win/Linux/macOS. Use `node:path`. Dynamically detect `process.platform` & `process.arch` for external binaries. Set `chmod +x` on Unix.
- **DEFENSIVE-CODING**: NEVER crash main render loop. MUST wrap external/AI/volatile calls in `try/catch` with seamless fallbacks.
- **STATE-IMMUTABILITY**: NEVER mutate original assets/config in-place. Preserve original files on asset generation.
- **IMPORT-INTEGRITY**: MUST verify `import` statements at top of file when introducing functions/dependencies. NEVER truncate import blocks during edits.
- **ZERO-REGRESSION**: NEVER break existing working flows. MUST verify side-effects & maintain backward compatibility for all options.
