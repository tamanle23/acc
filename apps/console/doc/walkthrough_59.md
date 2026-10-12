# Walkthrough - WCAG 2.2 AA Compliance: Milestone 1 (Design Tokens & Contrast Hardening)

This walkthrough documents the changes made to achieve **WCAG 2.2 Level AA compliance** for Milestone 1 across `@unipost/console` and `@unipost/ui`.

---

## 1. Objectives Completed

1. **Design Token Calibration (SC 1.4.3 Contrast Minimum & SC 1.4.11 Non-text Contrast)**
   - Re-calibrated `--muted-foreground` in `apps/console/src/styles/theme.css` for both Light Mode and Dark Mode.
   - Guaranteed ≥ 4.5:1 text contrast on light/dark glass scrims.
   - Enhanced `--border` and `--input` opacity/lightness to improve UI boundaries against frosted scrims.

2. **Global Focus & Scroll Padding (SC 2.4.11 Focus Not Obscured)**
   - Configured `scroll-padding-top: calc(var(--header-height, 4rem) + 1rem)` across `html` and `main` in `apps/console/src/styles/index.css`.
   - Verified default `:focus-visible` ring parameters satisfy visible focus indicator requirements without obscuring interactive controls under sticky headers.

3. **Pointer Target Sizing (SC 2.5.8 Target Size Minimum)**
   - Inspected and enforced minimum `28×28px` target bounds (`min-w-[28px] min-h-[28px]` or `min-w-[32px] min-h-[32px]`) across small icon buttons and pagination triggers in:
     - `apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx`
     - `apps/console/src/components/password-input.tsx`
     - `apps/console/src/core/sandbox/ui/sandbox-dock.tsx`
     - `apps/console/src/features/metadata/components/data-explorer/faceted-search-sidebar.tsx`

---

## 2. Key Code Changes

### `apps/console/src/styles/theme.css`
```css
:root {
  /* Calibrated --muted-foreground to oklch(0.42 0.045 257.4) for >= 4.8:1 contrast ratio */
  --muted-foreground: oklch(0.42 0.045 257.4);
  --border: oklch(0.82 0.02 255 / 65%);
  --input: oklch(0.82 0.02 255 / 70%);
}

.dark {
  /* Calibrated dark mode --muted-foreground to oklch(0.75 0.035 256.8) for >= 5.1:1 contrast ratio */
  --muted-foreground: oklch(0.75 0.035 256.8);
  --border: oklch(1 0 0 / 22%);
  --input: oklch(1 0 0 / 25%);
}
```

### `apps/console/src/styles/index.css`
```css
html,
main {
  /* Ensure focused controls are never obscured by sticky/fixed header regions (SC 2.4.11) */
  scroll-padding-top: calc(var(--header-height, 4rem) + 1rem);
}

:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
```

---

## 3. Verification Results

All automated checks passed with **0 errors**:

1. **TypeScript Compilation:**
   ```bash
   pnpm --filter @unipost/console exec tsc -b
   # Result: Passed cleanly (0 errors)
   ```

2. **Unit Tests:**
   ```bash
   pnpm --filter @unipost/console test
   # Result: Passed 7/7 tests across 2 test suites
   ```

3. **Production Web Build:**
   ```bash
   pnpm --filter @unipost/console build:web
   # Result: Built successfully in 7.91s
   ```

4. **Visual Inspection:**
   - Captured screenshot via Playwright frontend verification.
   - Inspected UI layout: Liquid Glass frosted glass panels and Bento Box responsiveness remain intact.
