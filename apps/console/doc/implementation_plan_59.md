# Implementation Plan 59 - Enterprise WCAG 2.2 Level AA Specification Compliance

## Executive Summary

This comprehensive implementation plan outlines the engineering roadmap to achieve full **WCAG 2.2 Level AA compliance** across `@acc/console` and shared `@acc/ui`. The strategy enforces accessibility across four core milestones—covering design tokens, contrast hardening, navigation landmarks, custom data tables, keyboard alternatives for dragging operations, minimum target sizes, and automated CI/CD accessibility testing—while preserving the signature **Liquid Glass** aesthetic and **Bento Box** multi-pane architecture.

---

## 1. Compliance Baseline & Scope

### 1.1 In-Scope Applications & Packages
- `@acc/console` (`apps/console`)
- `@acc/ui` (`packages/ui`)

### 1.2 Core WCAG 2.2 AA Success Criteria Mapping
| WCAG 2.2 SC | Success Criterion Name | Level | Core Monorepo Focus Area |
| :--- | :--- | :--- | :--- |
| **1.3.1** | Info and Relationships | A | Semantic HTML landmarks, heading hierarchy (`h1`–`h4`), table header `scope="col"`. |
| **1.4.3** | Contrast (Minimum) | AA | Text contrast ≥ 4.5:1 (normal) / 3:1 (large) across Liquid Glass scrims over mesh wallpapers. |
| **1.4.11** | Non-text Contrast | AA | Control boundaries, switch track states, and icons ≥ 3:1 against background. |
| **2.1.1** | Keyboard Accessible | A | All actions reachable via keyboard; no hover-only features. |
| **2.4.1** | Bypass Blocks | A | Functional `<SkipToMain>` linked to `<main id="content" tabIndex={-1}>`. |
| **2.4.7** | Focus Visible | AA | High-visibility focus indicators (`outline: 2px solid var(--ring)`, `outline-offset: 2px`). |
| **2.4.11** | Focus Not Obscured (Minimum) | AA | **(WCAG 2.2 New)** Global `scroll-padding-top` to prevent sticky headers from obscuring focused items. |
| **2.5.7** | Dragging Movements | AA | **(WCAG 2.2 New)** Single-pointer/keyboard reordering alternatives for drag-and-drop in Schema Builder. |
| **2.5.8** | Target Size (Minimum) | AA | **(WCAG 2.2 New)** Minimum pointer target size of 24×24px (with 28–32px target bounding boxes enforced). |
| **3.3.8** | Accessible Authentication (Min) | AA | **(WCAG 2.2 New)** Ensure password and OTP fields support password managers, autofill, and copy-paste. |
| **4.1.2** | Name, Role, Value | A | Accessible names on icon buttons; `aria-sort` on data table columns; ARIA expanded/controls on collapsible rails. |
| **4.1.3** | Status Messages | AA | Async operation feedback announcements (toasts, live regions) for screen readers. |

---

## 2. Milestone 1: Design Tokens, Contrast Hardening & Focus Visibility

### Objective
Guarantee that all text and interactive UI elements pass contrast thresholds (≥ 4.5:1 text, ≥ 3:1 controls) over Liquid Glass frosted scrims and dynamic wallpapers, and ensure focus indicators are prominent and never obscured by sticky headers.

### Detailed Engineering Tasks

1. **Tokens Calibration in [`theme.css`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/styles/theme.css)**:
   - Adjust `--muted-foreground` in light mode from `oklch(0.554 0.046 257.417)` (~55% lightness) to `oklch(0.42 0.045 257.4)` (~42% lightness) to guarantee ≥ 4.8:1 contrast over frosted glass (`--card` / `bg-white/65`).
   - In dark mode, ensure `--muted-foreground` maintains `oklch(0.75 0.035 256.8)` with minimum card scrim lightness ensuring ≥ 5.1:1 contrast.
   - Adjust `--border` and `--input` tokens to guarantee ≥ 3:1 contrast against adjacent background colors for form fields and control boundaries.

2. **Global Focus Indicator & Scroll Padding in [`index.css`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/styles/index.css)**:
   - Add global `scroll-padding-top` to `html` and `main` to address **SC 2.4.11 (Focus Not Obscured)**:
     ```css
     html,
     main {
       scroll-padding-top: calc(var(--header-height, 4rem) + 1rem);
     }
     ```
   - Standardize `:focus-visible` styling:
     ```css
     :focus-visible {
       outline: 2px solid var(--ring);
       outline-offset: 2px;
     }
     ```

3. **Pointer Target Sizing (SC 2.5.8)**:
   - Audit icon-only buttons across pagination, filters, and tables:
     - Upgrade `h-6 w-6` in [`entity-type-sidebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx) to `h-7 w-7` (28×28px) with `p-1`.
     - In table row action triggers, ensure the hit area has `min-h-[28px] min-w-[28px]`.

---

## 3. Milestone 2: Navigation Landmarks, Bypass Blocks & Document Structure

### Objective
Ensure screen readers and keyboard-only users can navigate, bypass repetitive blocks, and understand the document hierarchy efficiently.

### Detailed Engineering Tasks

1. **Fix Disconnected Skip Link (SC 2.4.1)**:
   - Update [`Main`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/main.tsx):
     ```tsx
     export function Main({ fixed, className, fluid, id = 'content', ...props }: MainProps) {
       return (
         <main
           id={id}
           tabIndex={-1}
           data-layout={fixed ? 'fixed' : 'auto'}
           className={cn('outline-none', ...)}
           {...props}
         />
       );
     }
     ```
   - Test [`SkipToMain`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/skip-to-main.tsx) to ensure pressing Tab on page load focuses the skip link, and pressing Enter jumps focus directly into the `<main>` element past the navigation bars.

2. **ARIA Landmarks & Labels**:
   - Ensure [`Header`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/header.tsx) renders `<header role="banner">`.
   - Ensure [`AppSidebar`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/app-sidebar.tsx) renders `<nav aria-label="Main Navigation">`.
   - In [`MetadataFeature`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/metadata-feature.tsx), ensure [`EntityTypeSidebar`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx) has `<aside aria-label="Entity Models Rail">`.

3. **Heading Hierarchy (SC 1.3.1)**:
   - Standardize page titles to start with `<h1>` followed by `<h2>` for major sections and `<h3>` for cards/sub-sections.
   - Prevent skipped heading levels (e.g. jumping from `<h1>` to `<h4>`).

---

## 4. Milestone 3: Dynamic Features, Data Tables & Complex Interactions

### Objective
Address complex WAI-ARIA states for interactive widgets, custom tables, drag-and-drop operations, and authentication.

### Detailed Engineering Tasks

1. **Data Explorer Table Accessibility in [`EntityDataGrid`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx)**:
   - **Header Semantics**: Add `scope="col"` to all `<th>` elements.
   - **Sort State Announcements**: Add `aria-sort="ascending" | "descending" | "none"` to sortable column headers based on `table.getState().sorting`.
   - **Action Buttons**: Ensure icon-only buttons (Edit, Delete, Inspect JSON) have descriptive `aria-label` attributes (e.g. `aria-label="Edit record ${row.id}"`, `aria-label="Delete record ${row.id}"`).

2. **Accessible Reordering for Schema Builder (SC 2.5.7)**:
   - In [`SchemaBuilder`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx):
     - In addition to pointer drag handles, provide single-pointer keyboard action buttons for each attribute card:
       - `Move attribute up` (Button with `ArrowUp` icon, disabled on first item).
       - `Move attribute down` (Button with `ArrowDown` icon, disabled on last item).
     - Announce position changes to screen readers via an `aria-live="polite"` region.

3. **Accessible Authentication & Form Verification (SC 3.3.8 & 3.3.7)**:
   - In sign-in, sign-up, and OTP components (`apps/console/src/features/auth/`):
     - Ensure password and OTP input fields support paste events (`onPaste` is never blocked).
     - Provide autocomplete hints (`autocomplete="current-password"`, `autocomplete="one-time-code"`, `autocomplete="username"`).

4. **Live Region Status Announcements (SC 4.1.3)**:
   - Verify that toasts triggered via `sonner` include `role="status"` or `aria-live="polite"` so async success/error states (e.g., "Entity model saved", "Record deleted") are announced to assistive technologies.

---

## 5. Milestone 4: Automated Testing & Continuous Governance Pipeline

### Objective
Embed accessibility verification into the standard build and pull request pipeline so regressions are prevented autonomously.

### Detailed Engineering Tasks

1. **Static Analysis with `eslint-plugin-jsx-a11y`**:
   - Install `eslint-plugin-jsx-a11y` as a devDependency in `@acc/console`.
   - Configure in `eslint.config.js`:
     - Enforce `jsx-a11y/alt-text`.
     - Enforce `jsx-a11y/anchor-is-valid`.
     - Enforce `jsx-a11y/aria-props`, `aria-role`, `aria-proptypes`.
     - Enforce `jsx-a11y/click-events-have-key-events`.
     - Enforce `jsx-a11y/no-noninteractive-element-interactions`.

2. **Component-Level Automated A11y Testing with `axe-core`**:
   - Install `vitest-axe` and `axe-core` in `@acc/console`.
   - Create reusable test suite `apps/console/src/__tests__/a11y.test.tsx` testing core design system components:
     ```tsx
     import { render } from '@testing-library/react';
     import { axe, toHaveNoViolations } from 'vitest-axe';
     expect.extend(toHaveNoViolations);

     it('GlassCard should have no a11y violations', async () => {
       const { container } = render(<GlassCard>Content</GlassCard>);
       const results = await axe(container);
       expect(results).toHaveNoViolations();
     });
     ```

3. **CI Pipeline Integration**:
   - Add accessibility assertion step to Turborepo pipeline:
     `turbo run test lint --filter=@acc/console`.

---

## 6. Verification & Acceptance Criteria

| Criteria | Verification Method | Target Outcome |
| :--- | :--- | :--- |
| **Color Contrast** | Color Contrast Analyzer / Axe DevTools | ≥ 4.5:1 for all body text; ≥ 3:1 for graphical objects and controls. |
| **Keyboard Navigation** | Manual keyboard walk (Tab, Shift+Tab, Enter, Space, Esc, Arrows) | 100% of interactive flows operable with keyboard only; zero keyboard traps. |
| **Skip Link** | Manual keyboard activation | Tab on initial page load focuses Skip Link; Enter focuses `<main id="content">`. |
| **Focus Not Obscured** | Keyboard navigation down long table / form | Focused element is completely visible below sticky header with `scroll-padding-top`. |
| **Target Sizing** | DevTools layout inspector | All pointer targets ≥ 24×24px bounding box. |
| **Dragging Alternative** | Keyboard navigation in Schema Builder | Reordering can be completed via Move Up / Move Down buttons without dragging. |
| **Automated A11y Tests** | `pnpm --filter @acc/console test` | Vitest-axe test suites pass with 0 violations. |
