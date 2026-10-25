# Implementation Plan - Facebook Environment Variable Configuration

Add environment variable support (`VITE_FACEBOOK_APP_ID` and `VITE_FACEBOOK_APP_SECRET`) to `apps/console` so developers and operators do not need to manually enter Facebook credentials in the App Integrations modal.

## Proposed Changes

### 1. Environment Template & Declarations

#### [NEW] [apps/console/.env.example](file:///c:/Users/Admin/workspace/git/acc/apps/console/.env.example)
- Provide template containing:
  ```env
  VITE_CLERK_PUBLISHABLE_KEY=
  # Facebook App Credentials for App Integrations
  VITE_FACEBOOK_APP_ID=
  VITE_FACEBOOK_APP_SECRET=
  ```

#### [MODIFY] [apps/console/.env.local](file:///c:/Users/Admin/workspace/git/acc/apps/console/.env.local)
- Add entries for `VITE_FACEBOOK_APP_ID` and `VITE_FACEBOOK_APP_SECRET`.

#### [MODIFY] [apps/console/src/vite-env.d.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/vite-env.d.ts)
- Add TypeScript interface declarations for `ImportMetaEnv` (`VITE_FACEBOOK_APP_ID`, `VITE_FACEBOOK_APP_SECRET`).

---

### 2. Store & Modal Integration

#### [MODIFY] [apps/console/src/features/apps/stores/facebook-store.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/stores/facebook-store.ts)
- Enhance store initialization to properly prioritize non-empty saved values or fall back to `import.meta.env.VITE_FACEBOOK_APP_ID` and `import.meta.env.VITE_FACEBOOK_APP_SECRET`.
- Export a helper or state flags: `hasEnvAppId` and `hasEnvAppSecret`.

#### [MODIFY] [apps/console/src/features/apps/components/facebook-connect-modal.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/components/facebook-connect-modal.tsx)
- Pre-populate input fields automatically from environment variables when store or env has values.
- Add an indicator badge (`"Configured via .env"`) next to the fields when loaded from environment variables so users immediately know their `.env` file was detected.
- Keep manual editing enabled so users can override or provide different test credentials if needed.

---

## Verification Plan

### Automated Verification
1. Run TypeScript check & build:
   ```bash
   pnpm --filter @acc/console build:web
   ```
2. Run ESLint:
   ```bash
   pnpm --filter @acc/console lint
   ```

### Manual Verification
1. Test with values set in `.env.local`:
   - Confirm App ID & Secret auto-populate.
   - Confirm `"Configured via .env"` badge appears.
2. Test fallback when `.env.local` is empty:
   - Confirm fields remain editable and Sandbox Demo mode still functions without errors.
