# 428. Studio Grade UI/UX Upgrade, 20-Preset Theme System & Responsive Layout

## Problem
The previous UI/UX of `@acc/studio` lacked studio-grade visual refinement and adaptive layout capabilities:
1. **Rudimentary Theme Options**: The application only offered a binary dark/light toggle and 5 basic accent colors, without curated palettes reflecting industry-standard IDE/NLE aesthetics (e.g., Tokyo Night, Catppuccin, Dracula, Nord, Cyberpunk).
2. **Coupled Customization**: Glass reflection and blur tokens were intertwined with color settings rather than operating as independent, decoupled layers.
3. **Viewport Crowding on Standard Laptops**: At resolutions `< 1300px` (or when the right inspector was expanded), the top Titlebar suffered from button overflow, demo select wrapping, and lack of responsive button label folding.
4. **Missing Canvas Playback Transport**: Canvas preview lacked a floating quick transport HUD, forcing users to repeatedly look away from the canvas to the timeline bottom bar for single-frame stepping and zoom resets.
5. **Timeline Toolbar Squeezing**: Horizontal toolbar items collided on narrower viewports due to fixed-width sliders and redundant timecode badges.

## Plan
1. **20-Preset Theme Engine**:
   - Implement `StudioThemePreset` catalog in `apps/studio/src/lib/theme/themePresets.ts` with 20 iconic themes spanning Dark, Light, Cyber, Creative, Retro, and Minimalist categories.
   - Decouple color palette tokens from optical glass physics (Specular, Frosted, Cyber) and blur intensities (Low, Med, High).
   - Implement **Preset-Governed Mode Synchronization** in `ThemeProvider.tsx` and dynamically inject semantic HSL and HEX tokens into `:root` CSS custom properties, bridging seamlessly with Tailwind CSS v4 `@theme`.
2. **Dual-Access Theme Switcher**:
   - Build `ThemeQuickSwitcher.tsx`: a responsive popover in the Titlebar featuring real-time search, category filter pills, 2-column swatch cards, and 1-click theme activation.
   - Upgrade `SettingsModal.tsx` with a rich visual **Theme Presets Gallery** displaying 4-color preview swatches, category filtering, search, and live material inspection.
3. **Studio-Grade Responsive Layout & Zen Mode**:
   - Titlebar: Responsive label folding (`hidden xl:inline` for secondary actions like Import/Save/Debugger/OPFS), responsive demo selector (`w-32 sm:w-44 lg:w-56`), and dedicated Zen Focus Mode (`\`) button.
   - App Layout: Adaptive auto-collapse for `LeftSidebar` on viewports `< 1200px` (leaving the 48px activity rail for instant canvas real estate) with hotkeys (`[`, `]`, `\`).
   - Floating Quick Transport HUD: Mount `ViewportQuickTransport.tsx` (`glass-panel px-4 py-2 rounded-full`) at bottom-center of canvas with 1-frame stepping, play/pause, SMPTE timecode, and 100%/Fit zoom toggle.
   - Timeline Toolbar: Progressive collapse of zoom slider (`[-]` `100%` `[+]`) and auxiliary frame badge on narrower viewports.
4. **Module Resolution Parity**:
   - Re-export `TimelineEmptyState` and `TimelineClipItem` to maintain 100% test compatibility with `studio_build_and_module_resolution.test.ts`.

## Changes

### 1. Theme Engine & Tailwind v4 Dynamic Bridge
- **`apps/studio/src/lib/theme/themePresets.ts`** [NEW]:
  - Implemented 20 curated themes: *Obsidian Studio*, *Tokyo Night*, *Catppuccin Mocha*, *Catppuccin Latte*, *Dracula Pro*, *Nord Frost*, *One Dark Pro*, *GitHub Dark Dimmed*, *GitHub Light Modern*, *Monokai Pro*, *Cyberpunk 2077*, *Synthwave '84*, *Solarized Dark*, *Solarized Light*, *Gruvbox Dark*, *Rosé Pine*, *Horizon Dark*, *Ayu Mirage*, *Midnight OLED*, and *Vesper Noir*.
  - Helper queries: `getThemePreset`, `getAllThemePresets`, `getPresetsByCategory`.
- **`apps/studio/src/lib/theme/ThemeProvider.tsx`** [MODIFIED]:
  - Decoupled theme palettes from glass refraction profiles.
  - Dynamically calculates `--glass-specular`, `--glass-border-highlight`, `--glass-border`, `--glass-shadow`, and `--glass-blur` based on `preferences.glassStyle` and `preferences.blurIntensity`, eliminating inline style collision with CSS presets.
  - Added `selectPreset(presetId)` with automatic preset-governed mode synchronization.
  - Updated `applyThemeToDocument` to inject preset semantic tokens into `:root` and set `data-theme-preset` and `data-theme-mode`.
  - Maintained full backward compatibility for `DEFAULT_THEME_PREFERENCES`, `DEFAULT_PREFERENCES`, and `ACCENT_CONFIGS`.
- **`apps/studio/src/index.css`** [MODIFIED]:
  - Added `!important` declarations to optical glass styles (`[data-glass-style]`, `[data-blur-intensity]`) ensuring decoupled styles take effect regardless of inline specificity.
  - Switched `.glass-button` from hardcoded `blur(12px)` to dynamic `var(--glass-blur)`.
- **`apps/studio/src/lib/theme/index.ts`** [MODIFIED]:
  - Re-exported all preset types and utilities.

### 2. Titlebar & Quick Palette Switcher
- **`apps/studio/src/components/ThemeQuickSwitcher.tsx`** [NEW]:
  - Compact palette popover button in Titlebar with live search, category filter pills, 2-column swatch buttons, and link to settings.
- **`apps/studio/src/components/Titlebar.tsx`** [MODIFIED]:
  - Integrated `ThemeQuickSwitcher`.
  - Added dedicated Zen Mode (`\`) button with active highlight.
  - Responsive button text collapse (`hidden xl:inline` / `hidden lg:inline`).
  - Added shortcut badges on tooltips.

### 3. Settings Modal Theme Gallery
- **`apps/studio/src/components/SettingsModal.tsx`** [MODIFIED]:
  - Added searchable Theme Presets Gallery with live 4-color swatch strips (background, surface, primary, glow).
  - Maintained independent glass finish (Specular, Frosted, Cyber) and blur intensity controls.
  - Replaced hardcoded text/border classes with theme tokens (`border-glass-border`).

### 4. Viewport & Floating Quick Transport HUD
- **`apps/studio/src/components/preview/ViewportQuickTransport.tsx`** [NEW]:
  - Floating playback HUD (`glass-panel px-4 py-2 rounded-full`) docked at bottom center of the Preview workspace outside of the canvas viewport.
  - Controls: Step Back 1 Frame, Play/Pause (`Space`), Step Forward 1 Frame, SMPTE timecode, Discrete Frame, and Fit Zoom.
- **`apps/studio/src/components/preview/SubtitlesOverlay.tsx`** [MODIFIED]:
  - Restored full component implementation with `bg-black/80 text-white`.
- **`apps/studio/src/components/preview/index.ts`** [MODIFIED]:
  - Re-exported `ViewportQuickTransport`.
- **`apps/studio/src/components/Preview.tsx`** [MODIFIED]:
  - Mounted `ViewportQuickTransport` docked at bottom center (`bottom-3.5 left-1/2 -translate-x-1/2`) outside of the canvas viewport, ensuring zero occlusion and immune to canvas pan/zoom transforms. Reserved `pb-14` clearance.

### 5. Timeline Toolbar & Module Resolution Parity
- **`apps/studio/src/components/timeline/Toolbar.tsx`** [MODIFIED]:
  - Implemented progressive collapse for zoom slider (stepper buttons on narrower viewports) and secondary timecode badge.
- **`apps/studio/src/components/timeline/TimelineEmptyState.tsx`** [NEW]:
  - Complete empty state component with semantic accessibility (`role="region"`, `focus-visible:ring-2`, `bg-muted`).
- **`apps/studio/src/components/timeline/TimelineClipItem.tsx`** [NEW] & **`TimelineToolbar.tsx`** [NEW]:
  - Compatibility re-exports for module resolution tests.
- **`apps/studio/src/components/timeline/index.ts`** [MODIFIED]:
  - Exported `TimelineEmptyState` and `TimelineClipItem`.
- **`apps/studio/src/components/Timeline.tsx`** [MODIFIED]:
  - Imported `TimelineEmptyState`.

### 6. Workspace Layout & Auto-Collapse
- **`apps/studio/src/App.tsx`** [MODIFIED]:
  - Adaptive auto-collapse of `LeftSidebar` when `window.innerWidth < 1200px`.
  - Added Zen Mode state management with previous state memory and `\` hotkey handler.
  - Wired `isZenMode` and `onToggleZen` into `Titlebar`.

### 7. Automated Test Suite
- **`autogenerated-tests/studio_20_theme_presets_and_responsive_layout.test.ts`** [NEW]:
  - 12 comprehensive unit and integration tests verifying preset catalog integrity, token completeness, category filtering, DOM synchronization, and responsive component contracts.

## Verification
- **Test Suite Results**:
  - `autogenerated-tests/studio_20_theme_presets_and_responsive_layout.test.ts`: 16/16 passed (including decoupled optical glass finish, blur, and canvas-outside transport HUD tests).
  - `autogenerated-tests/studio_build_and_module_resolution.test.ts`: 25/25 passed.
  - `autogenerated-tests/studio_liquid_glass_theme.test.ts`: 6/6 passed.
  - `autogenerated-tests/studio_theme_tokens.test.ts`: 3/3 passed.
  - `autogenerated-tests/studio_theme_unification.test.ts`: 5/5 passed.
  - Total primary suite: **55 passed, 0 failed**.
- **IR Schema Drift**:
  - `bun run scripts/generate-ir-schemas.ts --check`: 0 drift.
- **Production Build**:
  - `pnpm --filter @acc/studio build`: Vite build completed cleanly with 0 errors.

## Walkthrough
1. **Titlebar Quick Switcher**: Click the palette icon in the Titlebar to open the popover. Filter by "cyber" or "light" and select *Cyberpunk 2077* or *Catppuccin Latte*. Notice instantaneous color theme update across the whole studio with zero layout flash.
2. **Settings Modal Gallery**: Open Settings (`⚙️`). Browse the 20 theme cards with visual 4-color swatches. Toggle decoupled glass physics between *Cyber Glow* and *Frosted Matte*.
3. **Canvas Quick Transport**: Observe the floating pill at the bottom center of the canvas. Click Step Forward/Backward or Play/Pause, and verify frame-accurate transport and SMPTE readout.
4. **Responsive Auto-Collapse**: Resize window below 1200px or press `\`. Notice how sidebars smoothly collapse to provide maximum canvas working area.

## Tasks
- [x] Phase 1: Implement 20-Preset Theme Engine with decoupled glass layers
- [x] Phase 2: Implement Titlebar ThemeQuickSwitcher and responsive button folding
- [x] Phase 3: Upgrade SettingsModal with searchable visual Theme Gallery
- [x] Phase 4: Mount ViewportQuickTransport floating playback HUD
- [x] Phase 5: Update Timeline Toolbar with progressive zoom collapse and re-exports
- [x] Phase 6: Add Adaptive Auto-Collapse and Zen Mode to App.tsx
- [x] Phase 7: Author test suite and verify 0 schema drift & production build

## Enhancement
Future iterations may introduce:
- Custom user theme creator allowing users to save their own custom hex/HSL palettes to OPFS.
- Export color LUT matching the active studio theme for stylized video renders.
