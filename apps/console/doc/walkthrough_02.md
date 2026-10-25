# Walkthrough - Liquid Glass Intensity Slider in Settings -> Appearance

Added an interactive Liquid Glass intensity slider control to **Settings -> Appearance** in `apps/acc-console`, enabling dynamic real-time adjustment of backdrop blur, translucency scrim, and specular highlights across the entire console UI, with a **default intensity of 20%**.

---

## Changes Summary

### 1. Radix UI Slider Component
- **Package Added**: Installed `@radix-ui/react-slider` in `apps/acc-console`.
- **Component**: Created [slider.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/slider.tsx) adhering to Liquid Glass design standards:
  - Frosted translucent track (`bg-white/20 dark:bg-white/10 backdrop-blur-md border border-white/20`).
  - Luminous active range indicator (`bg-gradient-to-r from-primary/80 to-primary`).
  - Glossy draggable thumb (`border-white/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-md`).

### 2. Theme Provider & State Management
- **File**: [theme-provider.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/context/theme-provider.tsx)
  - Added `DEFAULT_GLASS_INTENSITY = 20`.
  - Added `glassIntensity: number` and `setGlassIntensity: (intensity: number) => void` to `ThemeProviderState` and `useTheme()`.
  - Added persistence via browser cookie (`vite-ui-glass-intensity`).
  - Injected dynamic CSS root variables via `useEffect`:
    - `--glass-intensity`: normalized scalar (`0` to `1`).
    - `--glass-blur`: calculated blur pixel value (`0px` to `40px`, default `8px` at 20%).
    - `--glass-specular-alpha`: dynamic specular highlight opacity (`0` to `0.4`, default `0.08` at 20%).

### 3. Utility Styles
- **File**: [index.css](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/styles/index.css)
  - Updated `@utility liquid-glass` and `@utility liquid-glass-card` to consume `var(--glass-blur, 20px)`.

### 4. Settings -> Appearance Form
- **File**: [appearance-form.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/features/settings/appearance/appearance-form.tsx)
  - Added `glassIntensity: z.number().min(0).max(100)` to `appearanceFormSchema`.
  - Set default value to `glassIntensity ?? 20`.
  - Rendered a Slider `FormField` with live percentage badge indicator (`{field.value ?? 20}%`).
  - Added immediate state update on slider slide (`setGlassIntensity(val)`) so the user can preview the glass intensity change in real-time.

---

## Verification Results

### Automated Checks
- **Linter**:
  ```bash
  pnpm --filter @acc/web lint
  ```
  *Result*: Passed with 0 errors / 0 warnings.
- **TypeScript & Build**:
  ```bash
  pnpm --filter @acc/web build
  ```
  *Result*: Passed (`tsc -b`, Vite Web, Vite Electron all succeeded).

---

## Dual-Persistence Documentation
- **Plan**: [implementation_plan_02.md](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/doc/implementation_plan_02.md)
- **Walkthrough**: [walkthrough_02.md](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/doc/walkthrough_02.md)
