# Walkthrough - WCAG 2.2 AA Compliance Audit & Verification

This walkthrough documents the full audit, shared primitive hardening, and automated verification executed across `@unipost/console` and `@unipost/ui` for WCAG 2.2 Level AA compliance.

---

## 1. Compliance Audit & Verification Summary

All four core compliance milestones outlined in `apps/console/doc/implementation_plan_59.md` are active and fully verified:

1. **Milestone 1 (Design Tokens & Contrast Hardening)**:
   - Calibrated `--muted-foreground` in `apps/console/src/styles/theme.css` to guarantee ≥ 4.5:1 contrast in both light and dark glass modes.
   - Enforced global `scroll-padding-top: calc(var(--header-height, 4rem) + 1rem)` in `apps/console/src/styles/index.css` to satisfy SC 2.4.11 (Focus Not Obscured).
   - Enforced target sizing (≥ 28×28px) across icon triggers and pagination buttons (SC 2.5.8 Target Size Minimum).

2. **Milestone 2 (Navigation Landmarks, Bypass Blocks & Heading Hierarchy)**:
   - Linked `<SkipToMain>` directly to `<main id="content" tabIndex={-1}>` in `apps/console/src/components/layout/main.tsx`.
   - Standardized explicit ARIA landmark roles (`role="banner"`) and labels (`aria-label="Main Navigation"`).
   - Enforced sequential `h1` → `h2` → `h3` heading structure across major views without skipped levels.

3. **Milestone 3 (Dynamic Features, Data Tables & Schema Builder)**:
   - Configured `EntityDataGrid` with `scope="col"`, dynamic `aria-sort`, and descriptive action `aria-label`s.
   - Provided single-pointer / keyboard `Move Up` and `Move Down` reordering buttons and an `aria-live="polite"` feedback region in `SchemaBuilder` (SC 2.5.7 Dragging Movements).
   - Enforced standard `autoComplete` hints (`username`, `current-password`, `new-password`, `one-time-code`) and verified uninhibited paste support in auth forms (SC 3.3.8).

4. **Milestone 4 (Automated Testing & Governance Pipeline)**:
   - Integrated `eslint-plugin-jsx-a11y` in `apps/console/eslint.config.js`.
   - Configured `vitest-axe` matchers in `apps/console/src/test/setup.ts`.
   - Maintained component accessibility test suite in `apps/console/src/components/__tests__/a11y.test.tsx`.

---

## 2. Shared Primitive Verification (`@unipost/ui`)

Shared Liquid Glass UI primitives from `@unipost/ui` were integrated into the `vitest-axe` test suite in `apps/console/src/components/__tests__/a11y.test.tsx`:
- `<GlassCard>`
- `<GlassButton>`

```tsx
it('GlassCard component from @unipost/ui should have zero a11y violations', async () => {
  const { container } = render(
    <GlassCard intensity="medium">
      <h2>Card Title</h2>
      <p>Accessible frosted glass card content.</p>
    </GlassCard>
  );
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});

it('GlassButton component from @unipost/ui should have zero a11y violations', async () => {
  const { container } = render(
    <GlassButton variant="primary" type="button">
      Click Me
    </GlassButton>
  );
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## 3. Verification Results

- **Unit & Component Accessibility Tests**:
  `pnpm --filter @unipost/console test`
  Passed 33 test files (167 tests passed, including `axe-core` accessibility test suite).

- **Production Web Bundle Build**:
  `pnpm --filter @unipost/console exec vite build --mode web`
  Built successfully in 2.17s.
