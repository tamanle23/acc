# Walkthrough: Facebook Login & Long-Lived Page Access Token Flow

We have implemented the Facebook Login flow for the Facebook integration card in **Console App Integrations** (`/apps`). This allows users to authenticate with Facebook, discover their managed Facebook Pages, acquire a short-lived Page Access Token, and exchange it for a **Long-Lived (never-expiring) Page Access Token** using the Facebook Graph API v21.0.

---

## Changes Made

### 1. Facebook Service (`facebook-service.ts`)
`apps/console/src/features/apps/services/facebook-service.ts`
- **SDK Loader**: `loadFacebookSdk(appId)` dynamically injects and initializes the official Facebook JavaScript SDK (`https://connect.facebook.net/en_US/sdk.js`) if not already present on `window.FB`.
- **OAuth Login**: `loginWithFacebook(appId)` triggers standard Facebook Login requesting `public_profile`, `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts` permissions.
- **Pages Retrieval**: `fetchFacebookPages(userAccessToken)` calls Facebook Graph API `/me/accounts` to retrieve all Facebook Pages managed by the user along with their respective Page Access Tokens and category/task information.
- **Long-Lived Token Exchange**: `exchangeForLongLivedPageToken(appId, appSecret, shortLivedUserToken, targetPageId)`:
  1. Calls Graph API oauth exchange endpoint:
     `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id={appId}&client_secret={appSecret}&fb_exchange_token={shortLivedUserToken}`
  2. Acquires a 60-day Long-Lived User Access Token.
  3. Queries `/me/accounts` with the long-lived user token to generate a **permanent / never-expiring Page Access Token** for the selected page.
- **Sandbox Demo Mode**: Includes `simulateDemoFacebookLogin()` and `simulateDemoLongLivedExchange()` enabling complete end-to-end testing and demo verification immediately without requiring an active registered Meta App on localhost.

### 2. Facebook Store (`facebook-store.ts`)
`apps/console/src/features/apps/stores/facebook-store.ts`
- Zustand persistent store with `localStorage` key `facebook_app_integration`.
- Tracks:
  - `isConnected`: boolean connection status.
  - `connectedPage`: active Facebook Page data (`id`, `name`, `category`, `accessToken`, `isLongLived`, `tokenExpiresAt`).
  - `availablePages`: list of available Facebook Pages for switching.
  - `appId` & `appSecret`: saved credentials.
  - `isDemoMode`: whether currently running in sandbox mode.
- Actions: `setCredentials`, `setConnectedPage`, `setAvailablePages`, `updatePageToken`, `disconnect`, `setDemoMode`.

### 3. Facebook Connect Modal (`facebook-connect-modal.tsx`)
`apps/console/src/features/apps/components/facebook-connect-modal.tsx`
- Designed following **Liquid Glass** standards:
  - Frosted glass dialog surface with specular borders and ambient highlights.
  - Step 1: Meta App ID & Secret credentials input + "Login with Facebook" or "Test with Sandbox Demo".
  - Step 2: Page selection dropdown displaying page name and category.
  - Step 3: Page connection overview, token status badge (`Short-Lived (1-2 Hours)` vs `Long-Lived (Never Expires)`), token mask/unmask viewer, copy-to-clipboard button, and **"Exchange for Long-Lived Token"** action button.
  - Disconnect / Switch Page controls with confirmation handling.

### 4. App Integrations Screen (`apps/index.tsx`)
`apps/console/src/features/apps/index.tsx`
- Dynamic Facebook card status:
  - When disconnected: Displays "Connect" button; clicking opens the connect modal.
  - When connected: Displays "Manage" button with active badge styling; card description dynamically reflects the connected page name and token longevity (`Permanent Long-Lived Token` vs `Short-Lived Token`).
- Renders `<FacebookConnectModal />`.

---

## Verification Results

### Automated Builds & Linting
- **TypeScript & Vite Build**:
  ```bash
  pnpm --filter @acc/console build:web
  ```
  Result: **Exit code 0**. `tsc -b` and client bundling completed with no errors.
- **ESLint**:
  ```bash
  pnpm --filter @acc/console lint
  ```
  Result: **Exit code 0**. All checks passed cleanly with 0 errors and 0 warnings.
