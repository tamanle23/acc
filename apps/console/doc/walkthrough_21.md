# Walkthrough: Environment Variable Precedence & Hot-Reload Fix

We have updated the Facebook integration store and connect modal so that **`VITE_FACEBOOK_APP_ID` (and `VITE_FACEBOOK_APP_SECRET`) in `.env.local` will always immediately take priority** over any stale credentials previously cached in browser `localStorage`.

---

## Key Changes

### 1. Store Precedence Fix
- **apps/console/src/features/apps/stores/facebook-store.ts**:
  - Updated store initialization priority:
    ```ts
    appId: envAppId || (initialSaved.appId && initialSaved.appId.trim()) || '',
    appSecret: envAppSecret || (initialSaved.appSecret && initialSaved.appSecret.trim()) || '',
    ```
  - Previously, if an empty or old string existed in `localStorage`, it took precedence over `.env.local`. Now, whenever `VITE_FACEBOOK_APP_ID` is defined in `.env.local`, it takes top priority immediately.

### 2. Modal Synchronization
- **apps/console/src/features/apps/components/facebook-connect-modal.tsx**:
  - In `handleOpenChange`, fall back to `FACEBOOK_ENV_CONFIG.envAppId` to ensure the modal inputs immediately mirror `.env.local`.

---

## Note on Vite Environment Variables
- Vite embeds `import.meta.env.*` into client code at server startup.
- Whenever you edit `apps/console/.env.local`, **restart the Vite dev server** (`Ctrl + C`, then `pnpm dev`) so Vite loads the new values into `import.meta.env`.

---

## Verification Results

### Automated Verification
- **Web Build**:
  ```bash
  pnpm --filter @acc/console build:web
  ```
  Result: **Exit code 0** (completed in 544ms).
- **ESLint**:
  ```bash
  pnpm --filter @acc/console lint
  ```
  Result: **Exit code 0** (0 errors, 0 warnings).
