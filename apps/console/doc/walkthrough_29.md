# Walkthrough: i18n Setup for Console

## Changes Made
Successfully executed the i18n initialization plan:

1. **Created `packages/i18n`**:
   - Initialized a new `@acc/i18n` workspace package with `i18next` and `react-i18next` configurations.
   - Added a core English dictionary for common UI elements (`src/locales/en/common.json`).

2. **Configured `apps/console`**:
   - Added `i18next`, `react-i18next`, and the `@acc/i18n` workspace dependency.
   - Created the console-specific dictionary (`src/locales/en/console.json`).
   - Initialized the `i18next` instance in `src/i18n.ts`, merging the shared and local dictionaries.
   - Imported the initialized `i18n` configuration into the `src/main.tsx` entrypoint.

## Validation Results
- `pnpm install` ran successfully, linking the local workspace packages.
- Turborepo build (`pnpm turbo run build --filter @acc/console`) succeeded with zero TypeScript errors, verifying correct module resolution between the console app and the new `i18n` package.
