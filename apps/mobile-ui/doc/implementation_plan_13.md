# Implementation Plan 13 - Streamline Ultimate Colors for Navigation Bar

Implement Streamline Ultimate Colors icons for the bottom navigation bar using `react-native-svg`. Inactive tabs render in a refined minimalist outline style, while active/focused tabs render in rich, multi-tone Streamline Ultimate Colors that look vivid and tactile over the frosted Liquid Glass bar.

## Proposed Changes

### Icon Components
#### [NEW] [src/components/icons/StreamlineColorIcon.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/components/icons/StreamlineColorIcon.tsx)
- Create a high-fidelity SVG icon component rendering Streamline Ultimate style vector graphics:
  - **Home (Dashboard)**:
    - Inactive: Streamline outline house.
    - Active: Multi-tone house with Cobalt roof (`#2563EB`), soft ice-blue facade (`#DBEAFE`), Sapphire doorway (`#1D4ED8`), and glowing amber window (`#F59E0B`).
  - **Create Post**:
    - Inactive: Streamline outline plus circle.
    - Active: Multi-tone badge with vibrant Emerald gradient disc (`#10B981` / `#059669`), crisp white cross, and mint accent depth (`#6EE7B7`).
  - **Profile**:
    - Inactive: Streamline outline user silhouette.
    - Active: Multi-tone character with deep Indigo hair/contour (`#4338CA`), peach tone accent (`#FDE68A`), and vibrant Coral/Violet clothing (`#8B5CF6` / `#EC4899`).
- Props: `name: 'home' | 'create' | 'profile'`, `focused: boolean`, `size?: number`.

### Navigation Bar
#### [MODIFY] [src/navigation/RootNavigator.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/navigation/RootNavigator.tsx)
- Replace `Feather` with `<StreamlineColorIcon />`.
- Pass `focused={isFocused}` and `name`.

## Verification Plan

### Automated
- Run `pnpm tsc --noEmit` to verify type safety.

### Manual Verification
- Test in Expo Go:
  - Tap through Dashboard, Create Post, and Profile.
  - Verify that unfocused tabs display crisp line icons.
  - Verify that the active tab displays the vivid, multi-colored Streamline Ultimate icon.
