# Implementation Plan 15 - Streamline Ultimate Light & Duotone Variants for Tab Navigation

Adjust the tab bar icons to use the **Streamline Ultimate Light** variant (ultra-clean, fine 1.2px outline) when unfocused and the **Streamline Ultimate Duotone** variant (primary accent contour + soft 20% alpha wash fill) when focused.

## User Review Required

> [!NOTE]
> - **Unfocused ("Ultimate Light")**: Refined minimalist line art with a delicate 1.2px stroke width, rounded joins, and neutral tone (`#8E8E93`), designed to look lightweight and unobtrusive.
> - **Focused ("Ultimate Duotone")**: True Streamline Duotone styling with a two-tone hierarchy:
>   - **Primary layer**: Vibrant theme tint color (`#007AFF` / `#0A84FF`) for bold structural lines and focal strokes (1.8px).
>   - **Secondary duotone wash**: Soft 18–22% opacity fill under the volume of the icon, giving it depth and warmth over the frosted Liquid Glass bar without being cluttered.

## Proposed Changes

### Icon Component
#### [MODIFY] [src/components/icons/StreamlineColorIcon.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/components/icons/StreamlineColorIcon.tsx)
- Implement **Streamline Ultimate Light** for unfocused states:
  - `home`: Fine 1.2px stroke house silhouette with roof, chimney, and doorway.
  - `create`: Fine 1.2px stroke circle with centered plus cross.
  - `profile`: Fine 1.2px stroke avatar with circular head and curved shoulders.
- Implement **Streamline Ultimate Duotone** for focused states:
  - `home`: Duotone house with a soft 20% tinted facade fill + primary tinted roof, doorway, and chimney lines.
  - `create`: Duotone plus-circle with a soft 20% tinted disc fill + primary tinted circle border and bold plus cross.
  - `profile`: Duotone user with a soft 20% tinted torso & head fill + primary tinted contour lines, neck arc, and head perimeter.
- Props: `activeColor?: string`, `inactiveColor?: string`.

### Navigation Bar
#### [MODIFY] [src/navigation/RootNavigator.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/navigation/RootNavigator.tsx)
- Pass `activeColor={themeColors.tint}` and `inactiveColor={themeColors.textSecondary}` to `<StreamlineColorIcon />`.

## Verification Plan

### Automated
- Run `pnpm tsc --noEmit` to verify type safety and SVG elements.

### Manual Verification
- Test in Expo Go:
  - Inspect unfocused tabs: verify the ultra-clean, elegant **Ultimate Light** fine line style.
  - Tap each tab: verify the smooth switch to **Ultimate Duotone** with primary vibrant stroke and secondary tinted volume fill.
