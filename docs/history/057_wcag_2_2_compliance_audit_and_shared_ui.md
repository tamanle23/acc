# 057: WCAG 2.2 Level AA Compliance Audit & Shared UI Accessibility Hardening

## Date: 2026-10-12

## Task Objective
Perform a full audit, shared primitive accessibility hardening (`@unipost/ui`), and automated verification across `@unipost/console` to confirm **WCAG 2.2 Level AA compliance** across all four implementation plan milestones.

---

## Changes & Milestones Verified

1. **Milestone 1: Design Tokens & Contrast Hardening**
   - Calibrated `--muted-foreground` in `theme.css` to guarantee ≥ 4.5:1 text contrast on light/dark glass scrims.
   - Enforced global `scroll-padding-top` in `index.css` to address SC 2.4.11 (Focus Not Obscured).
   - Enforced target sizing (≥ 28×28px) on icon controls and pagination triggers (SC 2.5.8 Target Size Minimum).

2. **Milestone 2: Navigation Landmarks, Bypass Blocks & Heading Structure**
   - Configured `<SkipToMain>` pointing to `<main id="content" tabIndex={-1}>` on `Main`.
   - Applied explicit landmark roles (`role="banner"`) and labels (`aria-label="Main Navigation"`).
   - Standardized `h1` → `h2` → `h3` heading hierarchy across core screens.

3. **Milestone 3: Dynamic Data Tables, Schema Reordering & Form Controls**
   - Added `scope="col"`, dynamic `aria-sort`, and descriptive action `aria-label`s in `EntityDataGrid`.
   - Implemented single-pointer / keyboard `Move Up` and `Move Down` reordering buttons with an `aria-live="polite"` feedback region in `SchemaBuilder` (SC 2.5.7 Dragging Movements).
   - Enforced standard `autoComplete` hints (`username`, `current-password`, `new-password`, `one-time-code`) and verified uninhibited paste support in auth forms (SC 3.3.8).

4. **Milestone 4 & Shared Primitive Hardening (@unipost/ui)**
   - Configured static JSX accessibility analysis with `eslint-plugin-jsx-a11y`.
   - Integrated `vitest-axe` matchers in `apps/console/src/test/setup.ts`.
   - Extended `apps/console/src/components/__tests__/a11y.test.tsx` to assert zero WCAG violations on shared `@unipost/ui` primitives (`<GlassCard>` and `<GlassButton>`).

---

## Verification Summary

- **Unit & A11y Test Suite**: `pnpm --filter @unipost/console test`
  - Result: 33/33 test files passed, 167/167 tests passed (0 failures).
- **Web Build**: `pnpm --filter @unipost/console exec vite build --mode web`
  - Result: Web bundle built cleanly in 2.17s.
