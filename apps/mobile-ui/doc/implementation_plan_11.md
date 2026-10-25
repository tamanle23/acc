# Implementation Plan 11 - Liquid Glass Intensity Slider

Add a slider control to the Settings screen (within Profile) that appears when the "Liquid Glass Effect" toggle is enabled, allowing users to interactively customize the glass blur and intensity.

## User Review Required

> [!NOTE]
> When "Liquid Glass Effect" is enabled in settings, a slider will appear right below it, allowing the user to tune the intensity (e.g. from subtle glass at 10% to heavy frost at 100%). The slider value will update `glassIntensity` in `useSettingsStore` and immediately reflect across the app's `LiquidGlassView` components.

## Proposed Changes

### Dependencies
- Add `@react-native-community/slider` to provide a native slider component.

### State & Settings
#### [MODIFY] [src/types/index.ts](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/types/index.ts)
- Add `glassIntensity: number` to the `Settings` interface.

#### [MODIFY] [src/store/useSettingsStore.ts](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/store/useSettingsStore.ts)
- Add `glassIntensity` (default: 60) and `setGlassIntensity(val: number)` to `useSettingsStore`.

### UI & Components
#### [MODIFY] [src/components/LiquidGlassView.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/components/LiquidGlassView.tsx)
- Use the user-configured `glassIntensity` from `useSettingsStore` (as base or multiplier) if `intensity` is not specifically overridden.

#### [MODIFY] [src/screens/ProfileScreen.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/screens/ProfileScreen.tsx)
- Under the "Liquid Glass Effect" switch, conditionally render a slider with a percentage indicator (e.g., 10% - 100%) and description when the effect is enabled.

## Verification Plan

### Automated
- Run `pnpm tsc --noEmit` to ensure type-checking passes cleanly.

### Manual Verification
- Launch the app in Expo Go.
- Navigate to the **Profile** screen.
- Verify the "Liquid Glass Effect" toggle.
- When toggled ON, verify the slider appears.
- Drag the slider and observe real-time changes to the glass intensity on the cards and navigation bars.
- When toggled OFF, verify the slider hides and the UI turns to solid fallback.
