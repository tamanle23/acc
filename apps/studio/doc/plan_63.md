# Studio Plan 63: Studio Grade UI/UX, 20-Preset Theme System & Responsive Layout

## Objective
Elevate the ACC Studio NLE from its previous basic theme and desktop-only layout to a studio-grade responsive interface with a 20-preset theme engine integrated with Tailwind CSS v4 and decoupled optical glass physics.

## Core Phases
1. **Theme Engine Architecture**: Create `themePresets.ts` with 20 iconic presets. Decouple palette from glass style and blur intensity. Support preset-governed mode synchronization.
2. **Titlebar Quick Switcher**: Implement `ThemeQuickSwitcher.tsx` with search, category filtering, and 1-click theme activation. Add responsive button collapsing.
3. **Settings Modal Theme Gallery**: Provide a visual gallery grid of the 20 presets with 4-color preview swatches.
4. **Canvas Quick Playback HUD**: Implement and mount `ViewportQuickTransport.tsx` floating over the canvas preview.
5. **Timeline Toolbar Responsiveness**: Progressive zoom slider collapse and timecode badge prioritization.
6. **Workspace Adaptive Auto-Collapse & Zen Mode**: Auto-collapse left sidebar on screen < 1200px, preserve previous state, and enable `\` Zen mode.
7. **Verification**: 100% test pass rate across theme and module resolution suites, 0 schema drift, and clean Vite production build.
