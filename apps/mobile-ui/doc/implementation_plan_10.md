# Implementation Plan 10 - Fix "Reduce Transparency" Setting to Disable Liquid Glass

Fix the "Reduce Transparency" setting so that enabling the toggle strictly disables all liquid glass effects (blur, transparency, shine, and noise), replacing them with solid, opaque backgrounds and crisp borders for high contrast and accessibility.

## User Review Required

> [!NOTE]
> When **Reduce Transparency** is turned ON:
> - `LiquidGlassView` will strip all transparencies, gradients, and noise, falling back to fully opaque `solidFallback`/`solidCardFallback`.
> - When turned OFF (default): the full frosted liquid glass effect (blur + gradient shine + noise texture + translucency) is active.

## Proposed Changes

### Theme & Colors
#### [MODIFY] [src/theme/colors.ts](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/theme/colors.ts)
- Ensure `solidFallback`, `solidCardFallback`, and `solidBorder` are 100% opaque colors for both light and dark themes (e.g. `#FFFFFF` and `#1C1C1E`).

### State & Models
#### [MODIFY] [src/types/index.ts](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/types/index.ts)
- Standardize on `reduceTransparency: boolean` in `Settings`.

#### [MODIFY] [src/store/useSettingsStore.ts](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/store/useSettingsStore.ts)
- Use `reduceTransparency: false` by default.
- Provide `toggleReduceTransparency` method.

### Components
#### [MODIFY] [src/components/LiquidGlassView.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/components/LiquidGlassView.tsx)
- Use `reduceTransparency` from store.
- When `useFallback` is true, ensure `backgroundColor` from `innerStyle` is overridden by `fallbackColor` so no transparency leaks through.
- Remove gradient and noise overlays when `useFallback` is true.

#### [MODIFY] [src/components/GlassCard.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/components/GlassCard.tsx)
- Pass `solidCardFallback` and conditional border color based on `reduceTransparency`.

#### [MODIFY] [src/navigation/RootNavigator.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/navigation/RootNavigator.tsx)
- Apply solid borders/backgrounds when `reduceTransparency` is enabled.

#### [MODIFY] [src/screens/ProfileScreen.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/screens/ProfileScreen.tsx)
- Revert setting name to "Reduce Transparency" with clear descriptive subtitle: "Turn off blur and transparency for high contrast".

## Verification Plan

### Automated
- Run `pnpm tsc --noEmit` to verify type safety.

### Manual Verification
- Test in Expo Go:
  - Default (Switch OFF): Full glass effect, translucent navigation and cards.
  - Switch ON: Cards and navigation become completely solid opaque with distinct borders and no blur/transparency.
