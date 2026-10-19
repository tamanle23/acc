# Integration Master Plan: Iteration 11 - WCAG 2.2 AA, Liquid Glass Fine-Tuning, DataTable Unification & Full-Stack Defect Resolution

## Goal Description
Iteration 11 elevates the unipost ecosystem to enterprise visual maturity and accessibility compliance while executing production bug fixing across `@unipost/console`, `tekgo-ui`, `mobile-ui`, and `@unipost/backend`.

It consolidates four core workstreams:
1. **Workstream 1: Liquid Glass Optical Presets & Ambient Accents**
2. **Workstream 2: Full-Spectrum WCAG 2.2 AA Accessibility Enforcement**
3. **Workstream 3: DataTable Unification, Overflow Scrolling UX & Screen Migrations**
4. **Workstream 4: Full-Stack Defect Resolution & Zero-Stub Implementations**

---

## Detailed Specifications by Workstream

### Workstream 1: Liquid Glass Optical Presets & Ambient Accents (Drilled & Aligned)
- **First-Class Theme Presets**:
  - `Theme` type expanded to: `'light' | 'dark' | 'acrylic' | 'obsidian' | 'system'`.
  - **Light Frosted Acrylic (`.acrylic`)**: Calibrated daylight frosted glass scrim with high-contrast text (`--foreground: oklch(0.11 0.04 265)`), crisp specular edge highlights, and subtle translucency.
  - **Dark Obsidian (`.obsidian`)**: Deep crystalline obsidian canvas (`--background: oklch(0.08 0.03 264)`), deep blacks, edge reflections (`--glass-specular-alpha: 0.85`), and diffuse backdrops.
- **Ambient Accent Colors**:
  - 5 selectable accents: `'violet'` (Violet Aurora), `'azure'` (Azure Sky), `'emerald'` (Emerald Jade), `'rose'` (Rose Quartz), and `'amber'` (Amber Sovereign).
  - **Deep UI Propagation**:
    1. Tints background mesh caustics (`body::before` radial gradients).
    2. Subtly tints interactive glass highlights, focus rings, active tab indicators, and button specular borders via CSS variables `--accent-glow`, `--ring`, and `--glass-accent-border`.
- **Accessibility Solid Fallback Engine**:
  - Dual-trigger activation:
    1. Manual switch in `/settings/appearance` (`[data-glass-fallback="true"]`).
    2. Automatic native media query listener for `prefers-reduced-transparency: reduce` and `prefers-contrast: more`.
  - Complete glass flattening: sets `backdrop-filter: none`, replaces translucent alphas with high-contrast opaque surface fills, and guarantees $\ge 7:1$ contrast ratios for enhanced readability.
- **Session & Hydration Persistence**:
  - Persists `theme`, `accentColor`, `glassIntensity`, and `glassFallback` in client cookies (`vite-ui-theme`, `vite-ui-accent`, `vite-ui-glass-intensity`, `vite-ui-glass-fallback`) with 1-year expiration and synchronous hydration to prevent layout shift or flashing.

### Workstream 2: Full-Spectrum WCAG 2.2 AA Accessibility Enforcement
- **Contrast Calibration**: Ensure all text meets $\ge 4.5:1$ (normal text) and $\ge 3:1$ (large text / UI controls) across both glass and solid modes.
- **Visible Keyboard Focus Rings**: Consistent `:focus-visible` ring across all interactive controls with high-contrast 2px solid/double rings.
- **Keyboard Trap Defense & Focus Restoration**: Focus trapping, Escape dismissal, and return focus to triggering launcher buttons across all slide-over drawers (`TenantWorkspacesDrawer`, `TenantUsersDrawer`, `DlqInspectorSheet`) and modal dialogs.
- **Screen-Reader Semantics**: `aria-live="polite"` regions for async mutations, toast announcements, and form validation error states.

### Workstream 3: DataTable Unification, Overflow UX & Screen Migrations
- **Canonical Reference**: Standardize on `/workflow-executions` as the gold standard for screen layout, tabs/lifecycle switcher, toolbar positioning, and pagination.
- **Core DataTable Ergonomics Upgrades**:
  - **Sticky Frosted Header**: Table header row floats with `sticky top-0 z-20 backdrop-blur-xl` over rows during vertical scrolling.
  - **Horizontal Overflow Indicators**: Dynamic left/right linear gradient shadow masks that activate when columns extend beyond the viewport container, visually cueing users that horizontal content exists.
  - **Sticky Row Actions Column**: Pinned right-hand actions column (`sticky end-0 z-10 backdrop-blur-md bg-card/80`) so context actions are always accessible without scrolling back and forth.
  - **Themed Thin Scrollbars**: Subtly tinted thin scrollbars (`scrollbar-thin scrollbar-thumb-white/20`) that match Liquid Glass themes and prevent toolbar collision on mobile viewports.
- **Target Screen Migrations**:
  - Migrate bespoke raw `<table>` in **System Fleet Tenants (`/system/tenants`)** to TanStack `useReactTable` + `<DataTableToolbar actions={...}>` + `<DataTable>` + `<DataTablePagination>`.
  - Migrate bespoke raw `<table>` in **Billing History (`/settings/billing`)** to `DataTable` + `DataTablePagination`.
  - Align toolbar action slots across **Users (`/users`)** and **Dead-Letter Queue (`/system/dlq`)**.
  - Preserve specialized domain relationship builder exception (`entity-data-grid.tsx` and `composite-master-detail-row.tsx`) while benefiting from base table styling and accessibility.

### Workstream 4: Full-Stack Defect Resolution & Zero-Stub Implementations
- **ESLint Config Collision**: Resolve `tekgo-ui` flat config collision (`jsx-a11y` redefinition) restoring monorepo `pnpm lint` green status.
- **React Compiler Memoization**: Fix React memoization violations (`react-hooks/preserve-manual-memoization`) in `fleet-migration-modal.tsx` and duplicated imports across workflow features.
- **Backend Error Payloads**: Harden backend REST API payload validation and error responses: standardize RFC-7807 problem details with localized messages, eliminating raw stack traces.
- **Zero-Stub Verification**: Ensure all fixes integrate with the production runtime and Unified Sandbox without synthetic mocks.

---

## Architecture & Visual System

```mermaid
flowchart TD
    subgraph Workstream 1: Liquid Glass Optical System
        TP[ThemeProvider & Cookie Persistence] --> CSS[styles/theme.css & index.css]
        TP --> Presets[Themes: light, dark, acrylic, obsidian, system]
        TP --> Accents[5 Ambient Accents: violet, azure, emerald, rose, amber]
        TP --> DualFallback[Dual Solid Fallback: Manual Switch + prefers-reduced-transparency]
        TP --> LivePreview[Live Dynamic Glass Preview Card]
    end

    subgraph Workstream 2: WCAG 2.2 AA Standards
        CSS --> Contrast[Contrast Ratio >= 4.5:1 text, >= 3:1 controls]
        CSS --> FocusRing[High-Contrast Visible Focus Rings]
        Components[UI Components & Drawers] --> ARIA[ARIA Landmarks & aria-live]
        Components --> FocusTrap[Focus Trap & Escape Key Nav]
    end

    subgraph Workstream 3: DataTable Unification & Overflow UX
        DT[DataTable Component] --> SH[Sticky Frosted Header: sticky top-0 backdrop-blur-xl]
        DT --> OI[Overflow Indicators: Left/Right Shadow Gradients]
        DT --> SC[Sticky Actions Column: sticky end-0]
        DT --> CS[Thin Themed Scrollbars]
        TB[DataTableToolbar] --> AS[Standardized Action Slots]
        WE[/workflow-executions] & UT[/users] & DLQ[/system/dlq] & FT[/system/tenants] & BH[/settings/billing] --> DT
    end

    subgraph Workstream 4: Full-Stack Defect Resolution
        TekgoLint[Fix tekgo-ui ESLint Collision]
        ConsoleLint[Fix React Compiler Memoization]
        BackendValidation[Standardize RFC-7807 Error Payloads]
    end
```

---

## Proposed Changes

### Workstream 1: Liquid Glass & Theme Architecture (`@unipost/console`)

#### [MODIFY] [`apps/console/src/styles/theme.css`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/styles/theme.css)
- Add theme classes for `.acrylic` (Light Frosted Acrylic) and `.obsidian` (Dark Obsidian).
- Define ambient accent color token variants (`[data-accent="violet"]`, `[data-accent="azure"]`, `[data-accent="emerald"]`, `[data-accent="rose"]`, `[data-accent="amber"]`).
- Define high-contrast solid surface tokens activated when `[data-glass-fallback="true"]`.

#### [MODIFY] [`apps/console/src/styles/index.css`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/styles/index.css)
- Implement caustic radial gradients for ambient accent colors on `body::before`.
- Enforce WCAG 2.2 AA high-contrast `:focus-visible` styling globally.
- Support `data-glass-fallback="true"` and `@media (prefers-reduced-transparency: reduce)` by disabling `backdrop-filter` and substituting opaque scrims.

#### [MODIFY] [`apps/console/src/context/theme-provider.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/context/theme-provider.tsx)
- Add `Theme` variants `'acrylic' | 'obsidian'`.
- Add `accentColor`, `glassFallback` state with cookie synchronization.
- Provide helper methods `setAccentColor(accent)` and `setGlassFallback(enabled)`.
- Listen to `window.matchMedia('(prefers-reduced-transparency: reduce)')` to automatically engage solid fallback.

#### [MODIFY] [`apps/console/src/features/settings/appearance/appearance-form.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/settings/appearance/appearance-form.tsx)
- Add preset selector: Light Frosted Acrylic vs. Dark Obsidian vs. Light vs. Dark vs. System.
- Add Accent Color picker with live color swatch pills.
- Add High-Contrast / Solid Fallback toggle switch with descriptive WCAG helper label.
- Expand live glass preview card to reflect real-time accent caustic and fallback state.

---

### Workstream 2: WCAG 2.2 AA Compliance & Keyboard Ergonomics

#### [MODIFY] [`apps/console/src/components/ui/sheet.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/components/ui/sheet.tsx) & Drawers
- Ensure all drawers (`TenantWorkspacesDrawer`, `TenantUsersDrawer`, `DlqInspectorSheet`) have explicit `aria-describedby`, focus trap, and restore focus to trigger element on close.
- Add `aria-live="polite"` status announcements for async mutations (e.g. workspace creation, user lock/unlock, DLQ task replay).

#### [MODIFY] [`apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx)
- Ensure all action buttons in table rows have unique, screen-reader friendly labels (`aria-label={`Actions for record ${record.id}`}`).
- Verify table header sorting indicators have proper `aria-sort` attributes (`ascending`, `descending`, `none`).

---

### Workstream 3: DataTable Unification, Overflow Scrolling UX & Screen Migrations

#### [MODIFY] [`apps/console/src/components/data-table/data-table.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/components/data-table/data-table.tsx)
- Add scroll state detection (`hasScrollLeft`, `hasScrollRight`) via `useRef` and `onScroll` handler on the container.
- Render dynamic specular edge shadow indicators on the left and right edges of the table viewport.
- Wrap `TableHeader` in `sticky top-0 z-20 bg-card/85 backdrop-blur-xl shadow-xs`.
- Add sticky actions column support pinned to `sticky end-0 z-10`.
- Integrate WCAG AA compliant keyboard arrow scrolling accessibility cues.

#### [MODIFY] [`apps/console/src/components/data-table/toolbar.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/components/data-table/toolbar.tsx)
- Add `actions?: React.ReactNode` slot to `DataTableToolbarProps`.
- Standardize layout with flex wrap and spacing.

#### [MODIFY] [`apps/console/src/features/system/tenants/fleet-tenants-table.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/system/tenants/fleet-tenants-table.tsx)
- Extract column definitions into `fleet-tenants-columns.tsx`.
- Migrate to TanStack `useReactTable` + `<DataTableToolbar actions={...}>` + `<DataTable>` + `<DataTablePagination>`.

#### [MODIFY] [`apps/console/src/features/settings/billing/billing-history-table.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/settings/billing/billing-history-table.tsx)
- Implement `billing-history-columns.tsx` using `@tanstack/react-table`.
- Wrap transactions with `useReactTable` and render via `<DataTable table={table} />` and `<DataTablePagination table={table} />`.

#### [MODIFY] [`apps/console/src/features/workflow-executions/components/workflow-executions-table.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/workflow-executions/components/workflow-executions-table.tsx)
- Pin the right-side actions column (`data-table-row-actions`) with `sticky end-0 z-10`.

---

### Workstream 4: Full-Stack Defect Resolution

#### [MODIFY] [`apps/tekgo-ui/eslint.config.mjs`](file:///c:/Users/Admin/workspace/git/unipost/apps/tekgo-ui/eslint.config.mjs)
- Fix the `jsx-a11y` duplicate plugin declaration in ESLint flat configuration.
- Validate that `pnpm --filter tekgo-ui lint` exits 0.

#### [MODIFY] [`apps/console/src/features/workflows/components/fleet-migration-modal.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/workflows/components/fleet-migration-modal.tsx)
- Fix the React Compiler memoization dependency discrepancy.

#### [MODIFY] [`apps/backend/unipost-core/src/main/java/com/unipost/core/exception/GlobalExceptionHandler.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-core/src/main/java/com/unipost/core/exception/GlobalExceptionHandler.java)
- Ensure all uncaught exceptions produce standardized RFC-7807 JSON error responses.

---

## Verification Plan

### Automated Tests
1. **Monorepo Linting**: `pnpm lint` (must pass across backend, console, and tekgo-ui with 0 plugin conflicts).
2. **Console Vitest Suite**: `pnpm --filter @unipost/console test` (all 298+ unit and component tests passing, including migrated tables).
3. **Backend Sandbox & Modulith**: `pnpm test:backend:sandbox` and `pnpm --filter @unipost/backend test:modulith`.
4. **Playwright Mode 1 E2E**: `pnpm test:e2e` (all 15/15 tests passing, verifying zero regression on appearance and WCAG).
5. **Playwright Mode 2 Live E2E**: `pnpm test:e2e:live` (all 15/15 tests passing against live Spring Boot backend).

### Manual Verification
1. **Liquid Glass & Presets**:
   - Open `/settings/appearance` in Console.
   - Toggle **Light Frosted Acrylic** and **Dark Obsidian** presets and observe instant theme transformation.
   - Switch between **Ambient Accent Colors** (Violet, Azure, Emerald, Rose, Amber) and verify background caustics update.
   - Enable **Solid Surface Fallback** and observe all glass elements immediately render opaque with high contrast.
2. **DataTable Overflow & Sticky Scrolling**:
   - Open `/workflow-executions` and resize viewport down to mobile/tablet width or expand columns.
   - Verify dynamic shadow gradients appear on the left/right edges when horizontal scrolling is available.
   - Scroll horizontally and observe shadows fade in/out dynamically as scroll bounds are reached.
   - Scroll vertically down 50+ records and confirm the header row stays pinned at the top with frosted glass blur.
   - Confirm right-side action menu (`MoreVertical` or button trigger) stays pinned at the edge of the visible table.
3. **Screen Consistency Across Console**:
   - Navigate between `/workflow-executions`, `/system/tenants`, `/users`, `/system/dlq`, and `/settings/billing`.
   - Verify visual parity in typography, padding, search placement, faceted filter badges, and pagination controls.
4. **Keyboard & WCAG Navigation**:
   - Tab through the navigation bar, settings panel, and drawers without pointer device. Verify visible focus ring on every interactive element.
   - Press `Escape` inside `TenantWorkspacesDrawer` and confirm drawer closes and focus returns to the launcher button.
