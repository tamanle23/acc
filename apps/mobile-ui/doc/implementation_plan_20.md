# Implementation Plan 20: Cross-Platform Liquid Glass Tokens & i18n Integration (Phase 13)

## Problem Statement
Visual token divergence between web (`console`, `tekgo-ui`) and native mobile (`mobile-ui`) leads to inconsistent translucency, specular highlights, and accessibility contrast gaps. Centralizing design tokens in a shared package guarantees WCAG 2.2 AA (>= 4.5:1 text contrast) and single-source-of-truth theme values.

## Architectural Design
1. **Create `@unipost/tokens` Package**:
   - Location: `packages/tokens/`.
   - Exports:
     - `liquidGlassTokens`: Web OKLCH and Native Hex/RGBA palettes for light, dark, and sovereign amber modes.
     - `blurMetrics`: Standardized blur depths (8px, 16px, 24px, 32px, 40px).
     - WCAG contrast verification utilities: `getLuminance`, `getContrastRatio`, `isWcagAaCompliant`.
2. **Package Linking & Client Integration**:
   - Link `@unipost/tokens` into `apps/console`, `apps/tekgo-ui`, and `apps/mobile-ui`.
   - Refactor `apps/mobile-ui/src/theme/colors.ts` to consume `liquidGlassTokens.light.native` and `liquidGlassTokens.dark.native`.
   - Wire `@unipost/i18n` with `react-i18next` into `mobile-ui` (`apps/mobile-ui/src/i18n.ts` and `App.tsx`).

## Verification Plan
1. Unit tests in `@unipost/tokens/src/index.test.ts` verifying WCAG 2.2 AA (>= 4.5:1 contrast) across light and dark tokens.
2. Verify `mobile-ui` test suite (`pnpm --filter mobile-ui test`).
3. Verify `@unipost/console` test suite (`pnpm --filter @unipost/console test`).
4. Verify `tekgo-ui` build (`pnpm --filter tekgo-ui build`).
