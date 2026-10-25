# Scaffold React Native Project

We will scaffold a production-ready, cross-platform React Native project using Expo SDK (Managed Workflow), React Navigation, Zustand for state management, and a custom Liquid Glass design system optimized for performance.

## User Review Required
Please review the proposed tech stack and file structure. Let me know if you would like any adjustments before I proceed with generating the code files.

## Proposed File Structure

```text
c:\Users\Admin\workspace\git\acc\apps\mobile-ui
├── package.json
├── tsconfig.json
├── app.json
├── babel.config.js
├── App.tsx
└── src/
    ├── types/
    │   └── index.ts (Shared TypeScript models for Post, User, RootTabParamList)
    ├── store/
    │   ├── usePostStore.ts (Zustand store with AsyncStorage persistence)
    │   └── useSettingsStore.ts (Settings and preferences store)
    ├── navigation/
    │   └── RootNavigator.tsx (Bottom Tabs with custom glass pill bar)
    ├── components/
    │   ├── LiquidGlassView.tsx (Platform-aware blur / translucency wrapper)
    │   ├── GlassCard.tsx (Base card component)
    │   └── GlassButton.tsx (Action button component)
    ├── screens/
    │   ├── DashboardScreen.tsx (Feed / History)
    │   ├── CreatePostScreen.tsx (Action Tab)
    │   └── ProfileScreen.tsx (User Info & Settings)
    └── theme/
        └── colors.ts (Constants for light/dark mode and fallback colors)
```

## Proposed Changes

### Configuration Files
- **package.json**: Set up with Expo SDK 52, `@react-navigation/native`, `@react-navigation/bottom-tabs`, `zustand`, `@react-native-async-storage/async-storage`, `expo-blur`, and `@expo/vector-icons`.
- **tsconfig.json**: Strict TypeScript configuration.
- **app.json**: Expo configuration for iOS/Android builds.
- **babel.config.js**: Standard Expo babel setup.

### Core Application
- **App.tsx**: Entry point that wraps the application in navigation and initializes any necessary providers.
- **src/types/index.ts**: Defines `Post`, `User`, `Settings`, and `RootTabParamList` types.

### State Management (Zustand)
- **src/store/usePostStore.ts**: Zustand store to manage posts. Uses `persist` middleware with AsyncStorage for offline availability.
- **src/store/useSettingsStore.ts**: Manages theme preferences and performance settings (e.g., reduce transparency).

### Design System & Components
- **src/components/LiquidGlassView.tsx**: The core UI primitive. Uses `expo-blur` (`BlurView`) if supported and allowed by user settings, falling back to lightweight solid translucency (e.g., `rgba(255,255,255,0.7)`) on older devices or if "Reduce Transparency" is on.
- **src/components/GlassCard.tsx**: A layout primitive for posts and settings items, built on top of `LiquidGlassView`.
- **src/components/GlassButton.tsx**: Interactive button with pressed states and glass aesthetics.

### Navigation
- **src/navigation/RootNavigator.tsx**: Bottom tab navigator. The tab bar itself will be a custom component implementing the "Floating Bottom Navigation Bar" requirement, utilizing `LiquidGlassView`.

### Screens
- **src/screens/DashboardScreen.tsx**: `FlatList` of posts from `usePostStore`. Implements pull-to-refresh and uses `GlassCard` to display items.
- **src/screens/CreatePostScreen.tsx**: Text input with auto-expand, tags, and a "Publish" `GlassButton`. Validates and dispatches to the store.
- **src/screens/ProfileScreen.tsx**: Displays user info and settings toggles (Theme, Reduce Transparency) connected to `useSettingsStore`.

## Verification Plan
Once approved, I will create these files directly in the `mobile-ui` directory. The project will be ready to install dependencies and run via `npx expo start`.
