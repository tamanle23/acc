# Enhance Liquid Glass Effect

This plan proposes visual enhancements to the `LiquidGlassView` primitive to make the frosted glass effect look significantly more realistic, mimicking Apple's high-end materials.

## Background
Currently, our `LiquidGlassView` uses `expo-blur` with a solid background overlay color. While functional, it lacks the physical characteristics of real glass:
1.  **Refraction/Grain**: Real frosted glass has a micro-texture (noise) that diffuses light.
2.  **Specular Highlights**: The edges of the glass catch light, requiring subtle gradient borders or diagonal washes to simulate an inner reflection.

## User Review Required

> [!IMPORTANT]
> The addition of noise textures and gradient overlays might marginally increase rendering complexity. Since this uses native primitives and tiny base64 tiles, it remains highly performant, but let me know if you prefer to keep it strictly minimalist without noise.

## Proposed Changes

### Dependencies
- Install `expo-linear-gradient` to support realistic diagonal shine and inner border reflections.

---

### UI Components

#### [MODIFY] [package.json](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/package.json)
- Add `expo-linear-gradient`.

#### [MODIFY] [LiquidGlassView.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/components/LiquidGlassView.tsx)
- Add an `Image` overlay using a tiny base64 noise tile with `resizeMode="repeat"` and low opacity (e.g., ~3-5%). This breaks up the perfect smoothness of the digital blur.
- Add an absolute `LinearGradient` border/highlight layer over the `BlurView` to give the glass a 3D bevel and specular shine (diagonal from top-left to bottom-right).
- Combine the standard `glassBackground` and `glassBorder` with these new visual layers.

#### [MODIFY] [colors.ts](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/theme/colors.ts)
- Introduce a `glassShine` gradient configuration to standardise the highlight across the app.

## Verification Plan

### Automated Tests
- Run `pnpm tsc --noEmit` to verify type safety.
- Verify `expo start` parses the new `expo-linear-gradient` dependency successfully.

### Manual Verification
- Render the app in Expo Go.
- Visually inspect the `GlassTabBar` and `GlassCard` (on Dashboard). The glass should now exhibit a subtle frosted texture and a diagonal light reflection.
