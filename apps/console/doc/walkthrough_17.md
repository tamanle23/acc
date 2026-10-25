# Walkthrough: Facebook App Credentials via Environment Variables

We have implemented environment variable support for Meta/Facebook App credentials (`VITE_FACEBOOK_APP_ID` and `VITE_FACEBOOK_APP_SECRET`) in `apps/console`, eliminating the need to manually enter credentials into the UI modal during development and testing.

---

## Key Changes

### 1. Environment Template & Definitions
- **apps/console/.env.example**:
  Created an environment template documenting:
  - `VITE_FACEBOOK_APP_ID`: Meta App ID (safe for frontend client use).
  - `VITE_FACEBOOK_APP_SECRET`: Meta App Secret (for local/testing token exchanges).
- **apps/console/.env.local**:
  Updated local environment configuration with placeholder keys.
- **apps/console/src/vite-env.d.ts**:
  Added typed declarations for `ImportMetaEnv` (`VITE_FACEBOOK_APP_ID`, `VITE_FACEBOOK_APP_SECRET`).

### 2. Store Integration
- **apps/console/src/features/apps/stores/facebook-store.ts**:
  - Exported `FACEBOOK_ENV_CONFIG` indicating whether environment variables are defined.
  - Prioritizes saved credentials or gracefully falls back to `import.meta.env.VITE_FACEBOOK_APP_ID` and `import.meta.env.VITE_FACEBOOK_APP_SECRET`.

### 3. Connect Modal UI Enhancements
- **apps/console/src/features/apps/components/facebook-connect-modal.tsx**:
  - Pre-populates App ID and App Secret from environment variables or persistent store.
  - Automatically displays an emerald `.env loaded` badge next to the input label whenever the input value matches the environment variable.
  - Synchronizes values cleanly on modal open without effect cascading renders (`handleOpenChange`).
  - Allows manual overrides at any time for ad-hoc testing.

---

## Verification Results

### Automated Tests & Linting
- **TypeScript & Web Build**:
  ```bash
  pnpm --filter @acc/console build:web
  ```
  Result: **Exit code 0**. `tsc -b` and client bundling completed cleanly in 549ms.
- **ESLint**:
  ```bash
  pnpm --filter @acc/console lint
  ```
  Result: **Exit code 0**. Clean code pass with 0 errors and 0 warnings.
