# Walkthrough - Liquid Glass Ambient Wallpaper & Background System

Generated high-definition ambient background wallpapers (fluid chromatic caustics for dark mode and iridescent pastel caustics for light mode) and integrated them across the entire `apps/acc-console` webapp so you can visually test and experience the Liquid Glass UI effect.

---

## 1. Generated Background Wallpapers

Two high-resolution ambient wallpapers with fluid chromatic caustic ribbons were generated and deployed to `public/images/`:

- **Dark Mode Wallpaper** (`/images/liquid-glass-bg.jpg`): Deep indigo, neon cyan, electric coral, and emerald refractive caustic waves.
- **Light Mode Wallpaper** (`/images/liquid-glass-bg-light.jpg`): Ethereal pastel iridescent ripples, lavender, soft rose, mint, and luminous specular highlights.

---

## 2. Changes Made

### A. Body Ambient Background Styles
- **File**: [index.css](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/styles/index.css)
  - Configured `body` with `background-size: cover; background-position: center; background-attachment: fixed; background-repeat: no-repeat;`.
  - Layered multi-stop radial caustics with translucent scrims over the wallpapers:
    - **Light Mode**: 4 soft ambient radial gradients + `rgba(255, 255, 255, 0.58)` scrim to guarantee WCAG AA text contrast while allowing the refractive caustic folds to shine through translucent cards.
    - **Dark Mode**: 4 vibrant radial caustics + `rgba(11, 15, 25, 0.60)` deep scrim for rich contrast.
  - Added support for alternative modes:
    - `[data-wallpaper='mesh']`: Pure CSS glowing mesh.
    - `[data-wallpaper='none']`: Minimalist clean background.

### B. Theme & Wallpaper State Management
- **File**: [theme-provider.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/context/theme-provider.tsx)
  - Added `WallpaperStyle = 'liquid' | 'mesh' | 'none'`.
  - Added `wallpaper` state and `setWallpaper` action, defaulting to `'liquid'`.
  - Cookie persistence via `vite-ui-wallpaper`.
  - `useEffect` automatically updates `document.documentElement.setAttribute('data-wallpaper', wallpaper)`.

### C. Appearance Settings Wallpaper Switcher
- **File**: [appearance-form.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/features/settings/appearance/appearance-form.tsx)
  - Added `wallpaper` field with visual preview cards in **Settings -> Appearance**:
    1. **Liquid Caustic (Dynamic)**: Live image thumbnail preview matching current light/dark theme.
    2. **Ambient Mesh**: Gradient mesh preview.
    3. **Minimalist**: Clean preview.
  - Real-time reactivity: clicking any card immediately shifts the entire webapp background.

---

## 3. How to Test the Liquid Glass Effect

1. **Observe Inset & Sidebar Glass Canvas**:
   - The desktop sidebar (`bg-sidebar/70 backdrop-blur-2xl`) and inset main content canvas (`bg-background/50 backdrop-blur-xs`) float directly over the liquid caustic waves.
2. **Observe Elevated Cards & Controls**:
   - Headers, cards, dropdowns, and dialogs feature `backdrop-blur-xl`, `border-white/40 dark:border-white/10`, and top specular edge highlights.
3. **Adjust Glass Intensity in Real Time**:
   - Go to **Settings -> Appearance**.
   - Drag the **Liquid Glass Intensity** slider between `0%` (sharp optical glass) and `100%` (heavily frosted milk glass).
   - Watch the fluid caustics beneath the glass dynamically blur and refract in real-time.

---

## 4. Verification

- **Lint**:
  ```bash
  pnpm --filter @acc/web lint
  ```
  *Result*: Exited with code 0 (clean).
- **Build**:
  ```bash
  pnpm --filter @acc/web build
  ```
  *Result*: Exited with code 0 (all TypeScript and Vite bundles generated successfully).

---

## 5. Artifact History Tracking
- Local App History: [walkthrough_03.md](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/doc/walkthrough_03.md)
