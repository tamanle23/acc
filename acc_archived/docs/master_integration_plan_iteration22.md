# Master Integration Plan - Iteration 22: Studio UI & Tailwind v4 Consistent Theming

Comprehensive integration plan to harmonize [`ThemeProvider.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/lib/theme/ThemeProvider.tsx), Tailwind CSS v4 design tokens, and components across `@acc/studio`.

---

## 1. Goal Description

Currently, `apps/studio` implements a custom liquid glass theming system in [`ThemeProvider.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/lib/theme/ThemeProvider.tsx) featuring:
- **Theme Modes**: `dark` (Dark Obsidian) and `light` (Light Frosted Acrylic).
- **Glass Styles**: `specular`, `frosted`, `cyber`.
- **Blur Intensities**: `low` (6px), `medium` (18px), `high` (40px).
- **Accent Colors**: `cyan`, `violet`, `emerald`, `amber`, `rose`.

However, the user interface remains inconsistent across components due to three fundamental integration gaps:

1. **Tailwind v4 Token Decoupling**:
   - `apps/studio` uses `@tailwindcss/vite` and `tailwindcss: ^4.3.3`.
   - `src/index.css` defines base CSS custom properties (`--background`, `--foreground`, `--accent-primary`), but does not register them into Tailwind v4's native `@theme` block.
   - Consequently, standard utility classes (such as `bg-accent`, `text-accent`, `border-glass-border`, etc.) do not resolve cleanly to the active theme tokens, forcing components to use ad-hoc arbitrary bracket syntax (e.g. `bg-[var(--accent-primary)]/15`).
2. **Hardcoded Palette Fallbacks**:
   - Over 70 locations across `LeftSidebar.tsx`, `RightSidebar.tsx`, `Sidebar.tsx`, `Timeline.tsx`, and `Preview.tsx` use hardcoded slate/zinc/gray classes (e.g. `bg-slate-950/40`, `hover:bg-slate-100 dark:hover:bg-slate-800`, `text-slate-600 border-slate-200`, `hover:bg-indigo-50`, `bg-cyan-500/20`).
   - When switching to `light` mode or altering `accentColor` (e.g., to Violet or Rose), these elements fail to adapt, causing glaring visual contrast defects, dark-on-dark unreadable text, and mismatched accent hues.
3. **Data-Attribute Selectors Uncoupled from shadcn Primitives**:
   - `ThemeProvider` dynamically injects `data-accent`, `data-glass-style`, and `data-blur-intensity` into `<html>`.
   - However, shadcn primitives ([`Button`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/ui/button.tsx), [`Badge`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/ui/badge.tsx), Select, Dialog, Tooltip) reference `--primary` and `--ring`, which remain hardcoded to default blue (`217.2 91.2% 59.8%`) instead of updating reactively when `accentColor` changes.

---

## 2. User Review Required

> [!IMPORTANT]
> - **Tailwind v4 Native Compatibility**: In Tailwind v4, `@theme` is the primary mechanism to expose CSS variables as semantic utility tokens. All token registrations must adhere to Tailwind v4 CSS configuration standards.
> - **Zero Regression in Timeline & WebGL Render Canvas**: Timeline tracks, playhead canvas, and WebGL preview rendering utilize distinct layer contrast; modifications must ensure transparent glass panels do not bleed unreadable contrast over video overlays or timeline playheads.
> - **Backward Compatibility**: Existing utility classes like `.glass-panel`, `.glass-card`, `.glass-pill`, and `.glass-button` will be preserved and upgraded to leverage `@theme` tokens.

---

## 3. Detailed Proposed Changes

### Phase 1: Tailwind v4 Theme Registration & Variable Synchronization

#### [MODIFY] [`apps/studio/src/index.css`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/index.css)
1. **Declare `@theme` Block in Tailwind v4**:
   - Register all semantic design tokens into `@theme`:
     ```css
     @theme {
       --color-background: hsl(var(--background));
       --color-foreground: hsl(var(--foreground));
       --color-card: hsl(var(--card));
       --color-card-foreground: hsl(var(--card-foreground));
       --color-popover: hsl(var(--popover));
       --color-popover-foreground: hsl(var(--popover-foreground));
       --color-primary: hsl(var(--primary));
       --color-primary-foreground: hsl(var(--primary-foreground));
       --color-secondary: hsl(var(--secondary));
       --color-secondary-foreground: hsl(var(--secondary-foreground));
       --color-muted: hsl(var(--muted));
       --color-muted-foreground: hsl(var(--muted-foreground));
       --color-accent: hsl(var(--accent));
       --color-accent-foreground: hsl(var(--accent-foreground));
       --color-destructive: hsl(var(--destructive));
       --color-destructive-foreground: hsl(var(--destructive-foreground));
       --color-border: hsl(var(--border));
       --color-input: hsl(var(--input));
       --color-ring: hsl(var(--ring));

       /* Liquid Glass & Accent Tokens */
       --color-accent-theme: var(--accent-primary);
       --color-accent-glow: var(--accent-glow);
       --color-glass-surface: var(--glass-bg);
       --color-glass-border: var(--glass-border);
       --color-glass-highlight: var(--glass-border-highlight);
     }
     ```
2. **Synchronize `[data-accent="..."]` with shadcn `--primary` and `--ring`**:
   - Ensure changing `data-accent` dynamically shifts `--primary` and `--ring` HSL values so all buttons, focus rings, and switches reflect the active theme:
     - `cyan`: `hsl(189 94% 43%)`
     - `violet`: `hsl(258 90% 66%)`
     - `emerald`: `hsl(160 84% 39%)`
     - `amber`: `hsl(38 92% 50%)`
     - `rose`: `hsl(350 89% 60%)`
3. **Register Custom Variant Directives**:
   - Add `@custom-variant glass-cyber`, `@custom-variant glass-frosted`, and `@custom-variant glass-specular` for declarative styling.

---

### Phase 2: ThemeProvider State Enhancements & Storage Robustness

#### [MODIFY] [`apps/studio/src/lib/theme/ThemeProvider.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/lib/theme/ThemeProvider.tsx)
1. **Sync HTML Classes and Attributes**:
   - Ensure `document.documentElement` receives clean attributes and classes synchronously on mount to avoid initial flash of unstyled content (FOUC).
   - Ensure `color-scheme: dark | light` is applied to `document.documentElement.style.colorScheme` for native scrollbars and input elements.
2. **Accent Theme Helper Export**:
   - Provide helper utilities or theme metadata (`ACCENT_CONFIGS`) containing label, hex, HSL, and description so modals and component pickers share a single source of truth (SSOT).

---

### Phase 3: Component Token Normalization (Eliminate Hardcoded Slate / Colors)

#### [MODIFY] [`apps/studio/src/components/Titlebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Titlebar.tsx)
- Replace `bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]` with `bg-accent-theme/15 text-accent-theme`.
- Replace hardcoded `text-slate-950` badge styles with `text-primary-foreground bg-accent-theme shadow-accent-glow`.
- Replace `bg-[var(--glass-bg)] border-[var(--glass-border)]` with `bg-glass-surface border-glass-border`.

#### [MODIFY] [`apps/studio/src/components/LeftSidebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/LeftSidebar.tsx)
- Replace all `bg-slate-950/40`, `bg-slate-950/60`, `bg-slate-950/80` with semantic `bg-muted/40` or `bg-card/60`.
- Replace `bg-slate-500/10` and `bg-slate-50/50` with `bg-muted/50`.
- Replace `text-slate-600 border-slate-200 hover:bg-slate-50` with `text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground`.
- Replace `hover:bg-slate-100 dark:hover:bg-slate-800` with `hover:bg-muted`.
- Replace `group-hover:bg-cyan-500/20` with `group-hover:bg-accent-theme/20`.

#### [MODIFY] [`apps/studio/src/components/RightSidebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/RightSidebar.tsx) & Inspector Sub-components
- Replace `bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300` with `bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground`.
- Ensure inspector badges, active pill tabs, and sliders seamlessly utilize `accent-theme`.

#### [MODIFY] [`apps/studio/src/components/Sidebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Sidebar.tsx)
- Normalize legacy sidebar item styles from `border-slate-200 bg-slate-50/50` to `border-border bg-muted/30`.
- Replace `group-hover:bg-indigo-50` and `bg-slate-100` with `group-hover:bg-accent-theme/10` and `bg-muted`.

#### [MODIFY] [`apps/studio/src/components/Preview.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Preview.tsx)
- Replace gizmo handle styles `bg-white dark:bg-slate-100` with `bg-background border-accent-theme`.
- Ensure preview transport bar and overlay meters adapt between dark and light modes.

#### [MODIFY] [`apps/studio/src/components/Timeline.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/Timeline.tsx)
- Replace track background hardcoded colors with `bg-card/40` and `bg-muted/20`.
- Ensure ruler ticks and playhead lines use `border-border` and `bg-accent-theme`.

---

## 4. Verification & Testing Strategy

1. **Automated Compilation & Test Suite**:
   - Run `bun run build` in `apps/studio` to verify `@tailwindcss/vite` compiles the `@theme` definitions without error.
   - Run `bun test autogenerated-tests/` to ensure no regressions in existing studio or IR tests.
2. **Interactive Manual Matrix Verification**:
   - **Mode Toggling**: Toggle Dark Obsidian ↔ Light Frosted Acrylic in `SettingsModal` and Titlebar.
     - Verify: Backgrounds, sidebars, dialogs, and text maintain high contrast (WCAG 2.1 AA compliant).
   - **Accent Color Switching**: Cycle through all 5 accents (`cyan`, `violet`, `emerald`, `amber`, `rose`).
     - Verify: shadcn buttons, active track badges, gizmo bounding boxes, and icons shift immediately to the selected accent color.
   - **Glass Refraction & Blur Tests**: Switch glass style (`specular`, `frosted`, `cyber`) and blur intensity (`low`, `medium`, `high`).
     - Verify: Backdrop blur, borders, and shadows update dynamically across floating panels.
