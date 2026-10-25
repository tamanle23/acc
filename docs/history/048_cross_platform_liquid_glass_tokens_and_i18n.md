# 048. Cross-Platform Liquid Glass Tokens & i18n Integration (Phase 13)

## Problem
Design tokens and blur parameters previously differed across `apps/console`, `apps/tekgo-ui`, and `apps/mobile-ui`, risking visual divergence and accessibility contrast regressions. In addition, `mobile-ui` lacked integration with `@acc/i18n`.

## Plan
1. Extract and create `@acc/tokens` package (`packages/tokens`) with OKLCH (Web) and Hex/RGBA (Native) tokens, blur metrics, and WCAG 2.2 AA verification helpers.
2. Link `@acc/tokens` into `apps/console`, `apps/tekgo-ui`, and `apps/mobile-ui`.
3. Link `@acc/i18n` with `react-i18next` into `apps/mobile-ui`.
4. Refactor `apps/mobile-ui/src/theme/colors.ts` to consume `@acc/tokens`.
5. Run test suites across tokens, mobile-ui, console, and build tekgo-ui.

## Changes
- **New Package (`packages/tokens`)**:
  - [`package.json`](file:///c:/Users/Admin/workspace/git/acc/packages/tokens/package.json).
  - [`tsconfig.json`](file:///c:/Users/Admin/workspace/git/acc/packages/tokens/tsconfig.json).
  - [`src/index.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/tokens/src/index.ts).
  - [`src/index.test.ts`](file:///c:/Users/Admin/workspace/git/acc/packages/tokens/src/index.test.ts).
- **Client Dependencies & Wiring**:
  - Linked `@acc/tokens` in `apps/console/package.json`, `apps/tekgo-ui/package.json`, and `apps/mobile-ui/package.json`.
  - Added `@acc/i18n` and `react-i18next` in `apps/mobile-ui/package.json`.
  - Refactored [`apps/mobile-ui/src/theme/colors.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/theme/colors.ts).
  - Added [`apps/mobile-ui/src/i18n.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/i18n.ts) and imported in [`App.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/App.tsx).
- **Artifacts**:
  - [`apps/mobile-ui/doc/implementation_plan_20.md`](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/doc/implementation_plan_20.md).
  - [`apps/mobile-ui/doc/walkthrough_20.md`](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/doc/walkthrough_20.md).

## Verification
- `@acc/tokens`: 4/4 tests passed (WCAG 2.2 AA contrast >= 4.5:1 verified).
- `mobile-ui`: 13/13 tests passed.
- `@acc/console`: 147/147 tests passed.
- `tekgo-ui`: Next.js 15 build passed.
