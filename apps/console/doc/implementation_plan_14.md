# Initialize i18n Strategy for Console and Monorepo

This plan outlines the architecture and execution steps for introducing internationalization into the monorepo, starting with the `packages/i18n` shared library and the `apps/console` UI.

## User Review Required

- We will be using `i18next` and `react-i18next`.
- We will configure English (`en`) as the default language.
- Are there any other specific target languages you want set up immediately (e.g., `es`, `fr`), or just a placeholder for now?

## Proposed Changes

### Shared i18n Package (`packages/i18n`)

#### [NEW] `packages/i18n/package.json`
Define the `@acc/i18n` package, declaring dependencies on `i18next` and `react-i18next`.

#### [NEW] `packages/i18n/src/index.ts`
Export the configured `i18next` base configuration and common dictionaries.

#### [NEW] `packages/i18n/src/locales/en/common.json`
Create a base English dictionary containing common terms (e.g., "Save", "Cancel", "Loading...").

#### [NEW] `packages/i18n/tsconfig.json`
Extend the workspace TypeScript configuration for the package.

---

### Console App (`apps/console`)

#### [MODIFY] `apps/console/package.json`
Add a dependency on the internal workspace package `"@acc/i18n": "workspace:*"`. Also install `i18next` and `react-i18next` in the app to prevent peer dependency issues.

#### [NEW] `apps/console/src/i18n.ts`
Initialize the `i18next` instance specifically for the console app. Import the shared configurations and dictionaries from `@acc/i18n` and merge them with console-specific dictionaries.

#### [NEW] `apps/console/src/locales/en/console.json`
Create the domain-specific English dictionary for the console app.

#### [MODIFY] `apps/console/src/main.tsx` (or root entrypoint)
Import the initialized `./i18n` module so it runs and configures the instance before the React tree mounts. Wrap the app with `<I18nextProvider>` if strictly needed, or just rely on the global instance.

## Verification Plan

### Automated Tests
N/A (No automated unit tests for this pure setup step).

### Manual Verification
1. Run `pnpm install` from the root to link workspaces.
2. Verify TypeScript compilation `pnpm turbo run build --filter @acc/console`.
3. Start the console dev server and verify no runtime errors occur.
