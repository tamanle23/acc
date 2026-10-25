# Implementation Plan 16 - Screen Header Liquid Glass View

Ensure the screen header background renders with the full **Liquid Glass** effect (blur, subtle glass background tint, specular highlight, and border) across all screens in the navigation stack.

## Problem Analysis
In `LiquidGlassView`, when `StyleSheet.absoluteFill` is passed (as in `headerBackground`), the outer container receives `position: 'absolute'`, but because `width` and `height` are not explicitly defined in `StyleSheet.absoluteFill`, the inner `BlurView` was not expanding to fill the header space (collapsing when it has no children). In addition, `headerBackground` was missing the `glassBackground` tint needed for physical glass refraction.

## Proposed Changes

### Component Fix
#### [MODIFY] [src/components/LiquidGlassView.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/components/LiquidGlassView.tsx)
- Automatically expand inner `BlurView` and fallback `<View>` to `width: '100%'` and `height: '100%'` whenever `position === 'absolute'` (or when `top`/`bottom` bounds are present).

### Navigation Header Configuration
#### [MODIFY] [src/navigation/RootNavigator.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/navigation/RootNavigator.tsx)
- Apply `backgroundColor: liquidGlass ? themeColors.glassBackground : themeColors.solidFallback` to the header's `LiquidGlassView`.
- Ensure the header blur intensity and border match the bottom tab bar aesthetic.

## Verification Plan

### Automated
- Run `pnpm tsc --noEmit` to verify type safety.

### Manual Verification
- In Expo Go:
  - Scroll the Dashboard feed up and down.
  - Observe the posts and colorful ambient background orbs blurring smoothly behind the top navigation header.
  - Verify that the header title remains crisp and legible over the frosted glass.
