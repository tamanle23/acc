# Implementation Plan 09 - Invert and Rename 'Reduce Transparency' to 'Liquid Glass'

Update the setting in `ProfileScreen` so that the switch explicitly controls whether the **Liquid Glass Effect** is ON or OFF, eliminating the inverted mental model of "Reduce Transparency". Also fix the fallback background styling so turning off Liquid Glass properly applies the opaque fallback color.

## Proposed Changes

### State & Types

#### [MODIFY] [src/types/index.ts](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/types/index.ts)
- Rename `reduceTransparency: boolean` to `liquidGlass: boolean` in `Settings`.

#### [MODIFY] [src/store/useSettingsStore.ts](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/store/useSettingsStore.ts)
- Update initial state: `liquidGlass: true`.
- Rename `toggleReduceTransparency` to `toggleLiquidGlass`.

---

### UI Components

#### [MODIFY] [src/components/LiquidGlassView.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/components/LiquidGlassView.tsx)
- Check `liquidGlass` from `useSettingsStore`.
- If `!liquidGlass` (or unsupported Android version), activate fallback view.
- Ensure `fallbackColor` overrides any translucent background passed in `style`.

#### [MODIFY] [src/screens/ProfileScreen.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/screens/ProfileScreen.tsx)
- Change setting item label to "Liquid Glass Effect" with an explanatory subtitle or clean label.
- Bind the switch value directly to `liquidGlass` and `toggleLiquidGlass`.

## Verification Plan

### Automated Verification
- Run `pnpm tsc --noEmit` to ensure type consistency and that no references to `reduceTransparency` are broken.

### Manual Verification
- Test toggling "Liquid Glass Effect" in the Profile tab:
  - When **ON**: Glass effect with blur, specular highlight, and noise texture is visible.
  - When **OFF**: Clean, opaque fallback cards and nav bar are rendered.
