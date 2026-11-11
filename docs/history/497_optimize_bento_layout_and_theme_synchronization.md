# History Entry 497: Optimize Bento Playground Layout and System Theme Synchronization

## Problem
Following the initial Bento Grid implementation for the IR Modifier Playground, usability feedback revealed two major UX and visual defects:
1. **Excessive Vertical Page Scrolling**:
   - The original Bento grid was organized into three stacked tiers (`HeroViewport` 480px, `Inspector`/`Curves`/`Catalog` 420px, `StoryboardFilmstrip` 170px), accumulating over 1130px in total content height.
   - Inside an overlay modal (`h-[92vh]`), this required artists to repeatedly scroll down to adjust inspector sliders or view the storyboard strip, separating cause (controls) from effect (canvas preview) and violating core Fitts's Law and Hick's Law principles.
2. **Hardcoded Style Colors (Theme Disconnect)**:
   - Several Bento cards used hardcoded Tailwind slate/indigo/purple classes (`bg-slate-900/60`, `bg-slate-950/80`, `border-white/10`, `text-slate-400`, `bg-black/30`, `text-indigo-400`).
   - When users switched themes in the Studio Theme Manager (e.g. to Light modes like "Polaris Frost" or "Nordic Crisp", or saturated themes like "Cyberpunk Neon" or "Crimson Flow"), the playground remained hardcoded dark slate with low-contrast borders and mismatched accent colors.

## Plan
1. **Ergonomic Viewport-Fitted Spatial Architecture**:
   - Eliminate outer page scrolling by restructuring `PlaygroundBentoLayout.tsx` into a responsive, 2-column look-dev stage fitting 100% of the modal viewport height (`h-full overflow-hidden`).
   - **Left Stage (~62% width)**:
     - Top: Maximized `BentoHeroViewport` with interactive A/B split slider, HUD telemetry, and full-width transport bar (`flex-1 min-h-0`).
     - Bottom: Integrated Dual Tooling Row (`h-[156px]`) pairing `BentoStoryboardFilmstrip` (5 keyframe canvases) with `BentoCurveVisualizer` (motion bezier graph) side-by-side directly beneath the canvas.
   - **Right Control Workbench (~38% width)**:
     - Top Dock Card (`h-[215px]`): Segmented switcher toggling between `Modifier Stack` (pipeline layers, bypass, reorder) and `Curated Presets` (1-click visual cards).
     - Bottom Dock Card (`flex-1 min-h-0`): Segmented switcher toggling between `Precision Inspector` (parameter sliders with dedicated internal smooth scroll), `Plugins Catalog` (search 50+ plugins), and `VideoIR JSON` (live Shiki code & commit).
2. **Comprehensive System Theme Synchronization**:
   - Replace all hardcoded slate, indigo, and black/white hex values with Studio Liquid Glass semantic tokens:
     - `glass-panel`, `glass-card`, `bg-glass-surface/50`, `border-glass-border`, `border-t-glass-border-highlight`, `shadow-glass`.
     - `text-foreground`, `text-muted-foreground`, `bg-background/50`.
     - `bg-accent-theme/20`, `text-accent-theme`, `border-accent-theme/30`, `shadow-accent-glow`.
   - Update canvas drawing routines in `usePlaygroundEngine.ts` (split divider line, draggable handle pill, watermark labels) and `BentoCurveVisualizer.tsx` (grid lines, hairline, glowing curve stroke, rolling playhead ball) to dynamically sample `--accent-primary`, `--foreground`, and `--glass-border` from `document.documentElement`.

## Changes
### Components Modified
- `apps/studio/src/components/debugger/playground/PlaygroundBentoLayout.tsx`:
  - Re-architected into a zero-scroll 2-column layout (`h-full overflow-hidden`).
  - Left stage houses Hero Viewport and side-by-side Storyboard Filmstrip + Curve Visualizer.
  - Right stage houses top dock (`Stack` | `Presets`) and bottom dock (`Inspector` | `Catalog` | `VideoIR JSON`).
  - Switched all backgrounds and borders to semantic theme tokens (`bg-background/50`, `border-glass-border`).
- `apps/studio/src/components/debugger/playground/usePlaygroundEngine.ts`:
  - Enhanced `drawSplitDivider` to dynamically extract `--accent-primary` and theme dark/light mode state, rendering an adaptive specular divider with high-contrast glass pill and watermark labels.
- `apps/studio/src/components/debugger/playground/bento/BentoHeroViewport.tsx`:
  - Replaced hardcoded `bg-slate-950/40`, `border-white/10`, and `bg-black/20` with `bg-background/50`, `border-glass-border`, and `bg-glass-surface/70`.
- `apps/studio/src/components/debugger/playground/bento/BentoStoryboardFilmstrip.tsx`:
  - Fully migrated from hardcoded slate/indigo to `glass-panel`, `bg-glass-surface/50`, `border-glass-border`, `text-foreground`, and `text-accent-theme`.
- `apps/studio/src/components/debugger/playground/bento/BentoCurveVisualizer.tsx`:
  - Replaced hardcoded purple/indigo canvas gradients with dynamic CSS variable extraction (`--accent-primary`, `--foreground`, `--glass-border`).
  - Converted pills, badges, and containers to semantic theme tokens.
- `apps/studio/src/components/debugger/playground/bento/BentoCatalogAndJson.tsx`:
  - Replaced hardcoded emerald/indigo tabs and cards with semantic `text-accent-theme`, `bg-accent-theme/20`, `border-glass-border`, and `bg-background/50`.
- `apps/studio/src/components/debugger/playground/PlaygroundInspector.tsx`:
  - Replaced residual `bg-black/20 border-white/5` subgroup containers with `bg-background/40 border-glass-border`.

## Verification
1. **Automated Unit Tests**:
   - `bun test autogenerated-tests/ir_playground_bento_features.test.ts autogenerated-tests/ir_plugin_playground_modal.test.ts`:
     - 20/20 tests passed cleanly across both suites (392 expect assertions).
2. **Production Bundle Build**:
   - `pnpm --filter @acc/studio build`: 3069 modules transformed, successfully built with zero errors in 22.46s.
3. **Ergonomic & Theme Check**:
   - Confirmed outer modal scrolling is completely eliminated on desktop viewports.
   - Canvas, inspector sliders, storyboard thumbnails, and curves are simultaneously visible without page scroll.
   - Verified adaptive styling against Studio Theme Manager light and dark modes.

## Tasks
- [x] Analyze vertical scrolling bottleneck and audit hardcoded color tokens.
- [x] Re-architect `PlaygroundBentoLayout.tsx` into a viewport-fitted 2-column stage with segmented workbench docks.
- [x] Modernize `BentoHeroViewport`, `BentoStoryboardFilmstrip`, `BentoCurveVisualizer`, and `BentoCatalogAndJson` to strictly consume semantic theme tokens.
- [x] Make canvas split divider and curve graph drawing dynamically responsive to `--accent-primary` and dark/light modes.
- [x] Run automated test suites and production build.
- [x] Register history entry in `docs/history/README.md`.
