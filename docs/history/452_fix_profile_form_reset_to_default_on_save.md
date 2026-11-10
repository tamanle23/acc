# History Log 452: Fix Profile Form Values Reset to Default on Save

## Problem
In **Settings -> Profile**, when a user submitted and saved the profile form, the form fields immediately wiped their input and reset to default values (e.g., `firstName: ''`, `lastName: 'User'`, `email: 'admin@acc.io'`, `language: 'en'`, `bio: ''`).

### Root Cause
1. **Spring Boot `ResponseWrapper` Payload Encapsulation**: The Spring Boot backend (`UserProfileController.java`) returns responses wrapped in `ResponseWrapper<ContextHeader, UserProfileDto>`:
   ```json
   {
     "status": "success",
     "body": {
       "userId": "1",
       "username": "admin",
       "firstName": "Alice",
       "lastName": "Smith",
       "email": "alice@acc.io",
       "preferences": { "language": "vi", "bio": "..." }
     }
   }
   ```
2. **Missing Response Unwrapping in Query/Mutation Hooks**: In `use-user-profile.ts`, `useUserProfileQuery` and `useUpdateUserProfileMutation` directly returned Axios `res.data` without unwrapping `data.body`. Consequently, the React Query cache stored the wrapper object.
3. **Form Re-Hydration with Undefined Properties**:
   In `ProfileForm.tsx`, when `updateProfileMutation.mutateAsync` completed, `onSuccess` called `queryClient.setQueryData(USER_PROFILE_QUERY_KEY, updatedProfile)`. Because `updatedProfile` was the wrapped object `{ status: 'success', body: { ... } }`:
   - `profileData.firstName` evaluated to `undefined` (it was at `profileData.body.firstName`).
   - `profileData.lastName` evaluated to `undefined`.
   - `profileData.preferences` evaluated to `undefined`.
   The `useEffect([profileData, ...])` triggered on the new cache reference and fell back to empty/default values (`firstName: ''`, `lastName: 'User'`, `email: 'admin@acc.io'`), resetting the form.
4. **Sandbox Handler Discrepancy**: In `packages/sandbox/src/handlers/auth-sandbox-handler.ts`, `GET /user/profile` included `body: profileRes` but `PUT /user/profile` did not, causing behavioral divergence between offline sandbox mode and production backend.

## Plan
1. **Add `unwrapUserProfile` Helper**: Create `unwrapUserProfile(data: unknown): UserProfileDto` in `apps/console/src/features/settings/profile/api/use-user-profile.ts` to cleanly extract `data.body` if wrapped in Spring Boot's `ResponseWrapper`.
2. **Update Query and Mutation**:
   - `useUserProfileQuery`: Unwraps response before returning.
   - `useUpdateUserProfileMutation`: Unwraps mutation response before returning and updating React Query cache.
3. **Defensive Form Hydration**:
   - In `profile-form.tsx`, ensure `profileData = unwrapUserProfile(rawProfileData)`.
   - Synchronize `authUser` in `useSpringAuthStore` on successful profile update.
4. **Synchronize Sandbox Handler**:
   - In `packages/sandbox/src/handlers/auth-sandbox-handler.ts`, update `PUT /user/profile` to return both unwrapped and `body: updatedProfile` matching `GET`.
5. **Testing**:
   - Add unit tests in `use-user-profile.test.tsx` verifying `ResponseWrapper` unwrapping.
   - Add unit tests in `profile-form.test.tsx` verifying form values are preserved when receiving wrapped Spring responses.

## Changes
- **API Hook (`apps/console/src/features/settings/profile/api/use-user-profile.ts`):**
  - Exported `unwrapUserProfile(data: unknown): UserProfileDto`.
  - Applied `unwrapUserProfile` in `useUserProfileQuery` and `useUpdateUserProfileMutation`.
- **Component (`apps/console/src/features/settings/profile/profile-form.tsx`):**
  - Unwrapped `rawProfileData` defensively with `unwrapUserProfile`.
  - Updated `onSubmit` to synchronize `useSpringAuthStore` user email and form reset baseline.
  - Updated `handleReset` to cleanly revert to saved unwrapped values.
- **Sandbox Handler (`packages/sandbox/src/handlers/auth-sandbox-handler.ts`):**
  - Updated `PUT /user/profile` to include `body: updatedProfile` alongside top-level properties.
  - Preserved saved custom email in `GET /user/profile`.
- **Tests:**
  - `apps/console/src/features/settings/profile/__tests__/use-user-profile.test.tsx`: Added test for Spring Boot `ResponseWrapper` handling.
  - `apps/console/src/features/settings/profile/__tests__/profile-form.test.tsx`: Added test verifying that receiving wrapped Spring responses does not reset form inputs to defaults.

## Verification
1. `pnpm --filter @acc/console test "profile-form.test.tsx"`: 7/7 passed.
2. `pnpm --filter @acc/console test "use-user-profile.test.tsx"`: 3/3 passed.
3. `pnpm --filter @acc/console exec tsc --noEmit`: 0 TypeScript errors.

## Walkthrough
- When users edit their first name, last name, email, phone number, language, bio, or URLs in **Settings -> Profile** and click "Save changes", the response payload is cleanly unwrapped from Spring Boot's `ResponseWrapper`.
- The form's baseline state updates to the newly saved values without resetting to defaults.
- The session authentication state in `useSpringAuthStore` updates immediately, keeping user initials, avatar, and navigation headers in sync.

## Tasks
- [x] Identify root cause of form values resetting on save
- [x] Implement `unwrapUserProfile` in `use-user-profile.ts`
- [x] Update `ProfileForm` with defensive unwrapping and auth store sync
- [x] Align `auth-sandbox-handler.ts` with Spring Boot response wrapper structure
- [x] Add automated unit tests in `profile-form.test.tsx` and `use-user-profile.test.tsx`
- [x] Verify type safety and tests pass
- [x] Record history log and update `README.md`
