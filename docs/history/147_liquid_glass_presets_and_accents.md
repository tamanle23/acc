# 147. Liquid Glass Flagship Presets, Ambient Accents & Solid Fallback Engine

## Problem
In Iteration 11 Workstream 1, initial implementation of theme presets and ambient accents had two visual issues:
1. **Accents Changed Nothing**: The ambient accent selector only modified `--ring` and `--accent-glow`. Core UI tokens (`--primary`, `--accent`, `--sidebar-primary`) remained hardcoded to static values, meaning buttons, active links, badges, and highlights never changed color.
2. **Presets Looked Identical**: `body` possessed an opaque background color that covered the `body::before` liquid wallpaper layer. Both `Light` vs `Acrylic` and `Dark` vs `Obsidian` rendered with nearly identical solid background colors and identical wallpaper configurations.

## Plan
1. **Theme Distinction**:
   - `Light`: Pure, clean, solid SaaS dashboard with solid white cards and no distracting background caustics.
   - `Light Frosted Acrylic`: Apple macOS / Fluent Acrylic frosted glass with visible dynamic liquid wallpaper and radial caustics shining through translucent cards.
   - `Dark`: Clean developer dark slate layout with solid slate cards and no wallpaper.
   - `Dark Obsidian`: Deepest crystalline obsidian glass with glowing cosmic liquid wallpaper, nebula caustics, and specular top-rim insets.
2. **Deep Ambient Accent Propagation**:
   - Wire all 5 accents (Aurora, Sky, Jade, Quartz, Sovereign) into `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, `--ring`, `--sidebar-primary`, and `--accent-glow`.
   - Calibrate lightness (`oklch(0.46 - 0.48)` light, `oklch(0.70 - 0.76)` dark) to guarantee strict WCAG 2.2 AA ($\ge 4.5:1$) compliance across badges and text.
3. **Controlled Form State**:
   - Update RadioGroups to controlled value with immediate `setTheme` and `setAccentColor` callbacks on click.
4. **Verification**:
   - Unit tests, full Vitest suite (307 tests), and Playwright E2E suite (15 tests with Axe audits).

## Changes

### 1. Style & Optical Token Architecture
- [`apps/console/src/styles/theme.css`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/styles/theme.css):
  - Defined high-contrast default `:root` and solid `.dark` tokens alongside translucent `.acrylic` and crystalline `.obsidian` tokens.
  - Defined full token palettes for all 5 ambient accents across both light and dark modes (`--primary`, `--accent`, `--ring`, `--sidebar-primary`, `--accent-glow`, `--glass-accent-border`).
- [`apps/console/src/styles/index.css`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/styles/index.css):
  - Configured `body::before` to display vibrant liquid caustics exclusively in `.acrylic` and `.obsidian` presets, keeping `.light` and `.dark` clean and solid.
  - Configured `html` and `body` backgrounds to allow optical wallpaper refraction.

### 2. State & Context Hydration Engine
- [`apps/console/src/context/theme-provider.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/context/theme-provider.tsx):
  - Set both CSS classes and `data-theme` attribute on the root element.
- [`apps/console/src/features/settings/appearance/appearance-form.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/settings/appearance/appearance-form.tsx):
  - Converted radio groups to controlled components with immediate `setTheme` and `setAccentColor` triggers.

---

## Verification
- **Unit & Component Tests**:
  - `src/context/__tests__/theme-provider.test.tsx`: 5/5 passed.
  - `src/features/settings/appearance/__tests__/appearance-form.test.tsx`: 4/4 passed.
  - Full console test suite: 64 test files, 307 tests passed (0 failures).
- **Playwright E2E Mode 1**:
  - `pnpm --filter @acc/console test:e2e`: 15/15 tests passed in 31.8s with 0 WCAG 2.2 AA violations.

---

## Walkthrough
- Documented in [`apps/console/doc/walkthrough_121.md`](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/walkthrough_121.md).

---

## Tasks
- [x] Configure deep accent propagation across primary, accent, ring, and sidebar tokens.
- [x] Configure distinct optical treatments for Classic Light vs Frosted Acrylic and Classic Dark vs Obsidian.
- [x] Wire controlled RadioGroup state with immediate context updates.
- [x] Validate WCAG 2.2 AA contrast compliance across all ambient accents.
- [x] Run full Vitest and Playwright test suites (all passing).
- [x] Commit and archive history log.
