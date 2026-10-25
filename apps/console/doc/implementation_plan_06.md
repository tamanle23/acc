# Implementation Plan - Application-Level Profile Context & ProfileSwitcher Refactoring

Refactor [`profile-switcher.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/profile-switcher.tsx) from isolated local component state (`useState`) to a global application-level context and state store (`ProfileProvider` / `useProfile`). This enables any screen, component, or layout across the console application to reference the active profile state and reactively reload/filter data when the profile changes.

## User Review Required

> [!NOTE]
> Currently, [`profile-switcher.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/profile-switcher.tsx) holds `activeProfile` in local `React.useState`.
> We will introduce a global `ProfileProvider` (persisted via cookie/localStorage for tab and refresh persistence) and a `useProfile()` hook. The active profile will be accessible throughout the component tree.
> We will also wire an active profile badge/indicator into the [`Dashboard`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/dashboard/index.tsx) to verify and demonstrate screen-level reactivity.

## Proposed Changes

### Console Application (`apps/console`)

#### [NEW] [profile-provider.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/context/profile-provider.tsx)
- Create `ProfileContext` and `ProfileProvider` following the pattern of `layout-provider.tsx` and `theme-provider.tsx`.
- Define type `Profile` (`id`, `name`, `logo`, `plan`, extensible metadata).
- Provide state:
  - `currentProfile`: the currently active profile.
  - `setCurrentProfile(profile)`: updates the active profile globally and persists selection to cookies/storage (`console_active_profile`).
  - `profiles`: list of available profiles, initialized from `sidebarData.teams` or configurable props.
  - `setProfiles(profiles)`: allows dynamic profile updates.
- Export `useProfile()` hook with type-safety and context verification.

#### [NEW] [profile-store.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/stores/profile-store.ts)
- Expose a companion Zustand store `useProfileStore` synchronized with `ProfileProvider` for non-React access (interceptor, utility, or router context access if required).

#### [MODIFY] [profile-switcher.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/profile-switcher.tsx)
- Refactor `ProfileSwitcher` to consume `useProfile()`.
- Use `currentProfile` and `setCurrentProfile` from context instead of local `useState`.
- Retain optional `profiles` prop as an override or fallback to context `profiles`.
- Maintain Liquid Glass styling on dropdown trigger and popover items.

#### [MODIFY] [main.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/main.tsx)
- Wrap `<ProfileProvider>` around `<RouterProvider>` in the root application provider tree alongside `ThemeProvider`, `FontProvider`, and `DirectionProvider`.

#### [MODIFY] [dashboard/index.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/dashboard/index.tsx)
- Connect `useProfile()` to display the active profile name and plan in the dashboard heading, verifying that switching profiles updates the screen view reactively.

---

### App Documentation & Artifact History

#### [NEW] [apps/console/doc/implementation_plan_06.md](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/implementation_plan_06.md)
- Mirror of this implementation plan per monorepo artifact history rules.

## Verification Plan

### Automated Tests
1. **TypeScript Typecheck**:
   - Run `pnpm --filter @acc/console build:web` or `tsc -b` to verify types across all consumers.
2. **ESLint Validation**:
   - Run `pnpm --filter @acc/console lint` to ensure no linting regressions.

### Manual / Visual Verification
1. Open the console application.
2. Switch between profiles (*Shadcn Admin*, *Acme Inc*, *Acme Corp.*) using `ProfileSwitcher` in the sidebar.
3. Verify that the active profile updates in `ProfileSwitcher` and simultaneously reflects in the `Dashboard` screen.
4. Refresh the page to verify that the selected profile persists across page reloads.
