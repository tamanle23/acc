# Implementation Plan - Refactor acc-console with Liquid Glass UI Design

This plan outlines the end-to-end refactoring of [`apps/acc-console`](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console) to implement the **Liquid Glass** design system in accordance with the monorepo design standards defined in [`.agents/rules/liquid-glass-design.md`](file:///c:/Users/Admin/workspace/git/acc/.agents/rules/liquid-glass-design.md).

## User Review Required

> [!IMPORTANT]
> The refactor transitions the web console from flat, opaque surfaces (`bg-card`, solid borders, plain backgrounds) to optical translucency with multi-layered backdrop blurs (`backdrop-blur-xl`), specular glass borders, ambient chromatic mesh glow, and elevated floating cards. 
> Text contrast and WCAG AA compliance will be strictly maintained by utilizing semi-translucent scrims (`bg-white/70`, `dark:bg-slate-900/75`).

## Proposed Changes

Grouped by layer and component hierarchy:

---

### Layer 1: Ambient Mesh & CSS Theme Tokens

#### [MODIFY] [theme.css](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/styles/theme.css)
- Refine color variables to support translucency and liquid refraction:
  - Configure semi-translucent values for `--card`, `--popover`, `--sidebar`, and borders.
  - Define custom Liquid Glass utility tokens for specular borders, inset reflections, and diffuse elevation shadows.

#### [MODIFY] [index.css](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/styles/index.css)
- Implement a rich, subtle ambient background underneath the entire UI shell:
  - Add radial chromatic caustics and subtle fluid mesh gradient to the root `body` and layout wrapper.
  - Add reusable `@utility liquid-glass` and `@utility liquid-glass-card` classes with specular highlights:
    - Light mode: `bg-white/70 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_0_rgba(0,0,0,0.06)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]`
    - Dark mode: `bg-slate-900/70 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]`
  - Add micro-interaction sheen effects for hover/active states.

---

### Layer 2: Core Primitives & Components

#### [MODIFY] [card.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/card.tsx)
- Upgrade `Card` to render as a floating frosted glass surface:
  - Apply backdrop blur, translucent background tint, crisp translucent border, specular top highlight, and soft diffuse depth shadow.

#### [MODIFY] [button.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/button.tsx)
- Enhance button variants with liquid glass aesthetics:
  - Add a dedicated `glass` variant: `bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/15 border border-white/30 dark:border-white/15 backdrop-blur-md active:scale-95 transition-all`.
  - Add specular highlight edges and subtle smooth scaling on hover/press.

#### [MODIFY] [dialog.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/dialog.tsx) & [sheet.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/sheet.tsx)
- Upgrade modals, sheets, and overlays:
  - Use `backdrop-blur-md bg-black/40` on overlays.
  - Apply `backdrop-blur-2xl` with frosted glass scrims on dialog content cards.

#### [MODIFY] [tabs.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/tabs.tsx)
- Transform `TabsList` into a frosted glass pill container and `TabsTrigger` into a glossy active pill with subtle light reflection.

#### [MODIFY] [table.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/table.tsx) & [input.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/input.tsx)
- Give table rows gentle liquid sheen hover states (`hover:bg-white/35 dark:hover:bg-white/5`).
- Upgrade input fields with frosted translucency (`bg-background/50 dark:bg-slate-900/50 backdrop-blur-md`).

---

### Layer 3: Application Shell & Layout

#### [MODIFY] [authenticated-layout.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/layout/authenticated-layout.tsx)
- Embed the ambient caustics/mesh glow beneath the app shell so that all content layers float over a harmonious optical field.

#### [MODIFY] [header.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/layout/header.tsx)
- Convert the top header into a floating frosted glass navbar (`sticky top-0 z-50 bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl border-b border-white/20 dark:border-white/10`).

#### [MODIFY] [sidebar.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/sidebar.tsx) & [app-sidebar.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/layout/app-sidebar.tsx)
- Style the sidebar and inset main canvas with frosted translucent glass textures, border specular highlights, and seamless blur transitions.

---

## Verification Plan

### Automated Tests
- Run full project linting:
  ```bash
  pnpm --filter @acc/web lint
  ```
- Run TypeScript type checking and production bundle build:
  ```bash
  pnpm --filter @acc/web build
  ```

### Manual Verification
- Test light and dark theme switching using `ThemeSwitch` to verify specular highlights and contrast compliance in both modes.
- Verify that modals, popovers, and sticky headers blur underlying background elements without text clipping or legibility issues.
