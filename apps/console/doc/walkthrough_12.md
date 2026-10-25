# Walkthrough: Application-Level Profile Context & ProfileSwitcher Refactoring

Refactored [`ProfileSwitcher`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/profile-switcher.tsx) from isolated local component state (`useState`) to a global, application-level context and state store (`ProfileProvider` / `useProfile` / `useProfileStore`).

Now, whenever a user switches a profile/workspace in the sidebar, the active profile state updates globally across the entire application and persists across page reloads.

## Changes Made

### Console Application (`apps/console`)

#### 1. Created Profile Store ([`profile-store.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/stores/profile-store.ts))
- Built a Zustand store managing:
  - `currentProfile`: active workspace profile.
  - `profiles`: collection of available profiles (defaults to `sidebarData.teams`).
  - `setCurrentProfile(profile)`: updates the state and persists the selected profile in cookie (`console_active_profile`) with 1-year expiration.
  - `setProfiles(profiles)`: updates the list of available profiles.
- Enables non-React code (e.g. API clients, router loaders, utility functions) to access `useProfileStore.getState().currentProfile`.

#### 2. Created Profile Context Provider ([`profile-provider.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/context/profile-provider.tsx))
- Implemented `ProfileProvider` and custom hook `useProfile()` following the architectural pattern of `layout-provider.tsx` and `theme-provider.tsx`.
- Provides type-safe access to `{ currentProfile, setCurrentProfile, profiles, setProfiles }`.

#### 3. Wrapped Provider at Application Root ([`main.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/main.tsx))
- Nested `<ProfileProvider>` in the root provider tree around `<RouterProvider router={router} />` alongside `ThemeProvider`, `FontProvider`, and `DirectionProvider`, making profile state available across all routes and screens.

#### 4. Refactored Profile Switcher ([`profile-switcher.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/profile-switcher.tsx))
- Replaced local `useState` with `const { currentProfile, setCurrentProfile, profiles } = useProfile()`.
- Updated selection handler to call `setCurrentProfile(profile)`.
- Added visual checkmark (`<Check />`) indicator for the actively selected profile item.
- Applied Liquid Glass styling with frosted glass dropdown (`bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-xl shadow-black/10`).

#### 5. Connected Screen-Level Consumer ([`dashboard/index.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/dashboard/index.tsx))
- Added `useProfile()` to the Dashboard heading to dynamically display the active workspace name and plan:
  ```tsx
  const { currentProfile } = useProfile()
  ...
  <p className='text-xs text-muted-foreground'>
    Active Workspace: <span className='font-medium text-foreground'>{currentProfile.name}</span>
    {currentProfile.plan ? ` (${currentProfile.plan})` : ''}
  </p>
  ```

## Verification Results

### 1. TypeScript & Production Build
Command:
```bash
pnpm --filter @acc/console build:web
```
Result: **Passed** (exit code 0, 0 type errors).

### 2. ESLint Code Quality
Command:
```bash
pnpm --filter @acc/console lint
```
Result: **Passed** (exit code 0, 0 warnings, 0 errors).
