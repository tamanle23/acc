# Implementation Plan 12 - Docked & Taller Bottom Navigation Bar

Modify the bottom navigation bar so that it is positioned directly at the bottom edge of the screen (docked, full-width) rather than floating, and increase its height with proper safe area insets for a more ergonomic touch target and modern look.

## User Review Required

> [!NOTE]
> The bottom tab bar will now anchor directly to the bottom of the device screen (`bottom: 0`, `left: 0`, `right: 0`), spanning the full width of the screen. We will add bottom padding equal to `insets.bottom` to comfortably avoid the iPhone Home indicator, with a taller content area (height ~70px + home indicator area).
>
> You can choose whether you prefer square edges or softly rounded top corners (e.g., top-left and top-right radius of 20px). We will default to a sleek, modern look with top-only subtle border and top rounded corners.

## Proposed Changes

### Navigation Component
#### [MODIFY] [src/navigation/RootNavigator.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/navigation/RootNavigator.tsx)
- Remove floating styling (`left: 20`, `right: 20`, floating `bottom`).
- Position docked to bottom (`bottom: 0`, `left: 0`, `right: 0`, `width: '100%'`).
- Increase total height and include safe area bottom inset (`paddingBottom: insets.bottom`, base height ~70px).
- Update shadow to cast upwards (`shadowOffset: { width: 0, height: -4 }`).
- Adjust border styling: top border highlight, flat bottom.

### Screens Content Padding
#### [MODIFY] [src/screens/DashboardScreen.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/screens/DashboardScreen.tsx)
- Adjust `paddingBottom` to `insets.bottom + 95` so the last list items aren't covered by the taller bottom bar.

#### [MODIFY] [src/screens/CreatePostScreen.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/screens/CreatePostScreen.tsx)
- Adjust scroll content `paddingBottom` to `insets.bottom + 95`.

#### [MODIFY] [src/screens/ProfileScreen.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/screens/ProfileScreen.tsx)
- Adjust scroll content `paddingBottom` to `insets.bottom + 95`.

## Verification Plan

### Automated
- Run `pnpm tsc --noEmit` to confirm no type errors.

### Manual Verification
- Test in Expo Go on iOS / Android device:
  - Check that the bottom bar sits directly at the bottom of the screen with proper spacing from the home indicator.
  - Test scrolling on Dashboard to ensure content scrolls smoothly under the frosted glass bar.
  - Verify tab pressability and hit targets.
