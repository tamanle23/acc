# 002: WCAG 2.2 AA Compliance - Milestone 1 (Design Tokens & Contrast Hardening)

## Date: 2026-10-08

## Description
Executed **Milestone 1** of the WCAG 2.2 AA compliance initiative across `@acc/console` and `@acc/ui`. This milestone focuses on color contrast calibration, focus obscuration prevention, and minimum target size enforcement.

## Changes Implemented

1. **Design Token Contrast Calibration (SC 1.4.3 & SC 1.4.11):**
   - Calibrated `--muted-foreground` token in `apps/console/src/styles/theme.css`:
     - Light Mode: `oklch(0.42 0.045 257.4)` (≥ 4.8:1 contrast on glass scrims).
     - Dark Mode: `oklch(0.75 0.035 256.8)` (≥ 5.1:1 contrast on dark glass scrims).
   - Hardened `--border` and `--input` tokens for non-text contrast against frosted glass backgrounds.

2. **Global Focus Obscuration & Focus Ring (SC 2.4.11):**
   - Added `scroll-padding-top: calc(var(--header-height, 4rem) + 1rem)` to `html` and `main` in `apps/console/src/styles/index.css`.
   - Enforced high-contrast global `:focus-visible` ring indicators (`outline: 2px solid var(--ring); outline-offset: 2px;`).

3. **Minimum Pointer Target Sizing (SC 2.5.8):**
   - Updated small icon buttons and pagination triggers across core features to ensure minimum `28×28px` target bounds:
     - `entity-type-sidebar.tsx`
     - `password-input.tsx`
     - `sandbox-dock.tsx`
     - `faceted-search-sidebar.tsx`

## Verification
- `pnpm --filter @acc/console exec tsc -b`: 0 errors
- `pnpm --filter @acc/console test`: Passed (7/7 tests)
- `pnpm --filter @acc/console build:web`: Success
- Visual Frontend Verification: Confirmed via Playwright screenshot. Liquid Glass aesthetics and Bento Box layout remain intact.

## Next Steps for Milestone 2
- Wire `<SkipToMain>` component to `<Main id="content" tabIndex={-1}>`.
- Standardize ARIA landmark regions (`<header role="banner">`, `<nav>`, `<aside>`).
- Enforce strict heading hierarchy (`h1` -> `h2` -> `h3`) across core screens.
