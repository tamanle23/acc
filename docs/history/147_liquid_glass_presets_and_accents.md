# 147. Liquid Glass Flagship Presets, Ambient Accents & Solid Fallback Engine

## Problem
In Iteration 11 Workstream 1, `@unipost/console` needed to elevate its visual system to enterprise maturity while strictly maintaining WCAG 2.2 AA accessibility:
1. **Limited Visual Options**: The application lacked dedicated flagship presets representing the full optical potential of the Liquid Glass design language.
2. **Missing Accent Personalization**: Interactive highlights and background caustics were locked to a static purple hue without user-configurable ambient tones.
3. **Accessibility Compliance**: Users with low vision or vestibular sensitivity requiring reduced transparency lacked an immediate way to disable translucent refraction and fall back to solid, high-contrast surfaces complying with WCAG 2.2 AA.

## Plan
1. **Design System & Optical Tokens**:
   - Introduce `.acrylic` (Light Frosted Acrylic) and `.obsidian` (Dark Obsidian) theme presets.
   - Define 5 ambient accents: `violet` (Aurora), `azure` (Sky), `emerald` (Jade), `rose` (Quartz), and `amber` (Sovereign).
   - Define high-contrast solid surface tokens (`[data-glass-fallback='true']`).
2. **Context Engine & Accessibility Automation**:
   - Update `ThemeProvider` in `@unipost/console` with full state, cookie management (`vite-ui-theme`, `vite-ui-accent`, `vite-ui-glass-intensity`, `vite-ui-glass-fallback`), and dynamic `--glass-*` CSS variable injection.
   - Implement native OS media query listener for `(prefers-reduced-transparency: reduce)` with defensive guards for headless/test environments.
3. **Appearance Form UI & Real-Time Preview**:
   - Provide 4 visual theme cards, 5 ambient accent swatches, an accessibility solid fallback switch, and a live interactive preview card in `/settings/appearance`.
4. **Verification & Testing**:
   - Unit tests covering ThemeProvider invariants and AppearanceForm interactions.
   - Run Vitest full suite and Playwright E2E Mode 1 test runner.

## Changes

### 1. Style & Optical Token Architecture
- [`apps/console/src/styles/theme.css`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/styles/theme.css):
  - Defined `.acrylic` and `.obsidian` class tokens.
  - Defined 5 ambient accent configurations mapping `--ring`, `--accent-glow`, and `--glass-accent-border`.
  - Defined high-contrast fallback tokens (`[data-glass-fallback='true']`).
- [`apps/console/src/styles/index.css`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/styles/index.css):
  - Added radial background caustics incorporating `var(--accent-glow)`.
  - Enforced `backdrop-filter: none !important` under `@media (prefers-reduced-transparency: reduce)`.

### 2. State & Context Hydration Engine
- [`apps/console/src/context/theme-provider.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/context/theme-provider.tsx):
  - Expanded `Theme` type to include `'acrylic' | 'obsidian'`.
  - Added `accentColor` and `glassFallback` state with cookie synchronization.
  - Added defensive guards for `window.matchMedia` across SSR, Node, and test environments.

### 3. Settings Appearance UI
- [`apps/console/src/features/settings/appearance/appearance-form.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/settings/appearance/appearance-form.tsx):
  - Upgraded appearance form with visual radio selectors for all 4 theme presets.
  - Added 5 clickable accent color swatches with active checkmarks.
  - Added High-Contrast Solid Fallback switch with explanatory WCAG description.
  - Added live preview card demonstrating real-time refraction, blur, opacity metrics, and interactive button hover effects.

### 4. Automated Testing
- [`apps/console/src/context/__tests__/theme-provider.test.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/context/__tests__/theme-provider.test.tsx): 5 unit tests for preset application, accent color attribute propagation, and solid fallback behavior.
- [`apps/console/src/features/settings/appearance/__tests__/appearance-form.test.tsx`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/src/features/settings/appearance/__tests__/appearance-form.test.tsx): 4 component tests validating form rendering and switch interactions.

---

## Verification
- **Unit & Component Tests**:
  - `pnpm --filter @unipost/console test -- src/context/__tests__/theme-provider.test.tsx`: 5/5 passed.
  - `pnpm --filter @unipost/console test -- src/features/settings/appearance/__tests__/appearance-form.test.tsx`: 4/4 passed.
  - Full console test suite: 64 test files, 307 tests passed (0 failures).
- **Playwright E2E Mode 1**:
  - `pnpm --filter @unipost/console test:e2e`: 15/15 tests passed in 40.2s with zero regressions.

---

## Walkthrough
- Documented in [`apps/console/doc/walkthrough_121.md`](file:///c:/Users/Admin/workspace/git/unipost/apps/console/doc/walkthrough_121.md).

---

## Tasks
- [x] Configure CSS theme tokens for `.acrylic`, `.obsidian`, 5 accents, and solid fallback.
- [x] Update `ThemeProvider` with full state, cookie hydration, and media query listeners.
- [x] Update `AppearanceForm` with 4 theme cards, 5 accent swatches, and solid fallback switch.
- [x] Write and verify unit and component tests.
- [x] Verify Playwright E2E test suite.
- [x] Record documentation and git commit.

---

## Enhancement
- Future iterations can expose custom hex color picker overrides for sovereign tenants to white-label their ambient caustics directly from the Admin console.
