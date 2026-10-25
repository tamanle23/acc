# Implementation Plan - Add Liquid Glass Intensity Slider in Appearance Settings

This plan details adding a customizable **Liquid Glass Intensity** slider to **Settings $\rightarrow$ Appearance** in [`apps/acc-console`](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console), enabling users to dynamically control the frosted glass blur, translucency, and specular refraction across the entire interface.

## User Review Required

> [!IMPORTANT]
> The intensity slider will range from **0%** (minimal blur/translucency) to **100%** (ultra-frosted, high-refraction glass), with a default of **20%**. Moving the slider adjusts the UI in real-time by updating CSS custom properties (`--glass-blur`, `--glass-intensity`, `--glass-specular-opacity`) on the root element and persisting the selection via cookies.

## Proposed Changes

---

### Component Primitives

#### [NEW] [slider.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/slider.tsx)
- Implement a Liquid Glass styled `Slider` component wrapping `@radix-ui/react-slider`:
  - Frosted translucent track with glass border (`bg-white/20 dark:bg-white/10 border border-white/20`).
  - Glossy range fill (`bg-primary`).
  - Glowing glass thumb with specular border and smooth active scale (`scale-110 active:scale-95`).

---

### State & Theme Management

#### [MODIFY] [theme-provider.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/context/theme-provider.tsx)
- Extend `ThemeProviderState` to support:
  - `glassIntensity: number` (0 to 100, default **20**).
  - `setGlassIntensity: (intensity: number) => void`.
- Persist value to cookie `vite-ui-glass-intensity`.
- Dynamically apply CSS variables to `document.documentElement`:
  - `--glass-blur`: `${(intensity / 100) * 24}px`
  - `--glass-intensity`: `${intensity / 100}`

---

### CSS Variable Binding

#### [MODIFY] [index.css](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/styles/index.css) & [theme.css](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/styles/theme.css)
- Bind `@utility liquid-glass` and `@utility liquid-glass-card` to `var(--glass-blur, 20px)` and dynamic specular opacities.

---

### Appearance Settings Form

#### [MODIFY] [appearance-form.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/features/settings/appearance/appearance-form.tsx)
- Update `appearanceFormSchema` to include `glassIntensity: z.number().min(0).max(100)`.
- Connect `useTheme` to read `glassIntensity` and `setGlassIntensity`.
- Add a new `FormField` for **Liquid Glass Intensity**:
  - Default value set to **20%**.
  - Displays a percentage badge reflecting the current value (e.g., `20%`).
  - Smooth slider (step 5) triggering real-time UI updates on drag and saving on form submit.

---

## Verification Plan

### Automated Tests
- Run project linting:
  ```bash
  pnpm --filter @acc/web lint
  ```
- Run production build:
  ```bash
  pnpm --filter @acc/web build
  ```

### Manual Verification
- Navigate to `/settings/appearance`.
- Confirm default intensity is initialized to 20%.
- Drag the slider from 0% to 100% and observe real-time frosted blur adjustments on cards, sidebar, and headers.
- Submit the form, refresh the browser, and confirm the custom intensity value persists.
