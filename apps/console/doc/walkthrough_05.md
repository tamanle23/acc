# Walkthrough - Full Wiring of All 3 Liquid Glass CSS Variables

Addressed the architectural gap where only `--glass-blur` was actively referenced, by fully integrating and binding **`--glass-intensity`** and **`--glass-specular-alpha`** into the component layer, theme design tokens, and utility classes.

---

## 1. What Each Variable Now Actively Controls

| CSS Variable | Primary Function | Active Bindings |
| :--- | :--- | :--- |
| **`--glass-blur`** | Optical diffusion / frosted blur filter | `backdrop-blur-[var(--glass-blur,20px)]` on `Card`, `Header`, `Sidebar`, `liquid-glass`, `liquid-glass-card` |
| **`--glass-intensity`** | Physical glass body translucency & border opacity | Background tint `rgba(255,255,255, calc(0.25 + var(--glass-intensity)*0.3))`, `--glass-bg`, `--glass-border` |
| **`--glass-specular-alpha`** | Specular edge light refraction & surface reflection | Inset edge highlight `shadow-[...rgba(255,255,255,var(--glass-specular-alpha))]`, `--glass-specular`, glossy reflection gradient |

---

## 2. Changes Made

### A. Theme Provider Calculation
- **File**: [theme-provider.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/context/theme-provider.tsx)
  - Normalized `--glass-intensity` to numeric string ratio `(glassIntensity / 100).toFixed(2)` ($0.00$ to $1.00$).
  - Calibrated `--glass-specular-alpha` smoothly from $0.15$ up to $0.95$:
    ```ts
    const specularAlpha = Math.max(0.15, Number((0.2 + (glassIntensity / 100) * 0.75).toFixed(2)))
    ```

### B. Theme Token Binding
- **File**: [theme.css](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/styles/theme.css)
  - Bound `--glass-bg` to `--glass-intensity`:
    `--glass-bg: oklch(1 0 0 / calc(0.2 + var(--glass-intensity, 0.2) * 0.35));`
  - Bound `--glass-border` to `--glass-intensity`:
    `--glass-border: rgba(255, 255, 255, calc(0.2 + var(--glass-intensity, 0.2) * 0.35));`
  - Bound `--glass-specular` to `--glass-specular-alpha`:
    `--glass-specular: rgba(255, 255, 255, var(--glass-specular-alpha, 0.85));`
  - Applied equivalent dynamic scaling for dark mode.

### C. Card Component Integration
- **File**: [card.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/card.tsx)
  - Body fill dynamically adjusts translucency with `--glass-intensity`.
  - Border edge dynamically adjusts light transmission with `--glass-intensity`.
  - Top specular highlight dynamically intensifies with `--glass-specular-alpha`.
  - Surface reflection gradient scales with `--glass-specular-alpha`.
  - Diffusion scales with `--glass-blur`.

---

## 3. Verification

- **Node Bundle Inspection**:
  ```bash
  node -e "...js.includes('glass-blur') && js.includes('glass-intensity') && js.includes('glass-specular-alpha')..."
  ```
  *Result*: Confirmed all 3 variables are compiled and actively present in `card.js` bundle.
- **Linter & Build**:
  - `pnpm --filter @acc/web lint`: Passed (0 errors).
  - `pnpm --filter @acc/web build`: Passed (0 errors).

---

## 4. Artifact History Tracking
- Local App History: [walkthrough_05.md](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/doc/walkthrough_05.md)
