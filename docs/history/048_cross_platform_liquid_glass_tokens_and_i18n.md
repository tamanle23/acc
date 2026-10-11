# 048. Cross-Platform Liquid Glass Tokens & i18n Integration (Phase 13)

## Problem
Design tokens and blur parameters previously differed across `apps/console`, `apps/tekgo-ui`, and `apps/mobile-ui`, risking visual divergence and accessibility contrast regressions. In addition, `mobile-ui` lacked integration with `@unipost/i18n`.

## Plan
1. Extract and create `@unipost/tokens` package (`packages/tokens`) with OKLCH (Web) and Hex/RGBA (Native) tokens, blur metrics, and WCAG 2.2 AA verification helpers.
2. Link `@unipost/tokens` into `apps/console`, `apps/tekgo-ui`, and `apps/mobile-ui`.
3. Link `@unipost/i18n` with `react-i18next` into `apps/mobile-ui`.
4. Refactor `apps/mobile-ui/src/theme/colors.ts` to consume `@unipost/tokens`.
5. Run test suites across tokens, mobile-ui, console, and build tekgo-ui.

## Changes
- **New Package (`packages/tokens`)**:
  - [`package.json`](file:///c:/Users/Admin/workspace/git/unipost/packages/tokens/package.json).
  - [`tsconfig.json`](file:///c:/Users/Admin/workspace/git/unipost/packages/tokens/tsconfig.json).
  - [`src/index.ts`](file:///c:/Users/Admin/workspace/git/unipost/packages/tokens/src/index.ts).
  - [`src/index.test.ts`](file:///c:/Users/Admin/workspace/git/unipost/packages/tokens/src/index.test.ts).
- **Client Dependencies & Wiring**:
  - Linked `@unipost/tokens` in `apps/console/package.json`, `apps/tekgo-ui/package.json`, and `apps/mobile-ui/package.json`.
  - Added `@unipost/i18n` and `react-i18next` in `apps/mobile-ui/package.json`.
  - Refactored [`apps/mobile-ui/src/theme/colors.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/mobile-ui/src/theme/colors.ts).
  - Added [`apps/mobile-ui/src/i18n.ts`](file:///c:/Users/Admin/workspace/git/unipost/apps/mobile-ui/src/i18n.ts) and imported in [`App.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/mobile-ui/App.tsx).
- **Artifacts**:
  - [`apps/mobile-ui/doc/implementation_plan_20.md`](file:///c:/Users/Admin/workspace/git/unipost/apps/mobile-ui/doc/implementation_plan_20.md).
  - [`apps/mobile-ui/doc/walkthrough_20.md`](file:///c:/Users/Admin/workspace/git/unipost/apps/mobile-ui/doc/walkthrough_20.md).

## Verification
- `@unipost/tokens`: 4/4 tests passed (WCAG 2.2 AA contrast >= 4.5:1 verified).
- `mobile-ui`: 13/13 tests passed.
- `@unipost/console`: 147/147 tests passed.
- `tekgo-ui`: Next.js 15 build passed.
