# Implementation Plan 14 - Migrate @expo/vector-icons to @react-native-vector-icons

Migrate the project's vector icons from `@expo/vector-icons` to `@react-native-vector-icons` packages (such as `@react-native-vector-icons/feather`), and remove `@expo/vector-icons` from `package.json`.

## User Review Required

> [!NOTE]
> Currently, the bottom navigation bar uses custom vector `StreamlineColorIcon` (`react-native-svg`), while `DashboardScreen.tsx` uses `Feather` icons for post engagement actions (like, comment, share, bookmark, more).
>
> We will migrate `DashboardScreen.tsx` to use `@react-native-vector-icons/feather` (or custom SVG stream icons if preferred), install the necessary `@react-native-vector-icons` packages, and remove `@expo/vector-icons` from `package.json`.

## Proposed Changes

### Dependencies
- Add `@react-native-vector-icons/feather`.
- Remove `@expo/vector-icons`.

### Screens & Components
#### [MODIFY] [src/screens/DashboardScreen.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/src/screens/DashboardScreen.tsx)
- Replace `import { Feather } from '@expo/vector-icons'` with `import Feather from '@react-native-vector-icons/feather'`.

#### [MODIFY] [package.json](file:///c:/Users/Admin/workspace/git/acc/apps/mobile-ui/package.json)
- Remove `@expo/vector-icons` dependency.

## Verification Plan

### Automated
- Run `pnpm tsc --noEmit` to ensure type-checking passes.

### Manual Verification
- In Expo Go:
  - Navigate to the Dashboard.
  - Verify that post interaction icons (like, comment, share, bookmark, and more) render accurately and crisply.
