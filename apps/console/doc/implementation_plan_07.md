# Implementation Plan - Facebook Login & Page Access Token Integration

Implement the **Facebook Login flow** for the Facebook card in **App Integrations** (`apps/console/src/features/apps/`), allowing users to authenticate with Facebook, select and acquire a **Facebook Page Access Token**, and subsequently **exchange it for a Long-Lived (never-expiring) Page Access Token** via the Facebook Graph API.

## User Review Required

> [!IMPORTANT]
> The Facebook Graph API requires a Facebook App ID (`client_id`) and App Secret (`client_secret`) to exchange short-lived tokens for long-lived tokens via `grant_type=fb_exchange_token`.
> We provide automatic detection from environment variables (`VITE_FACEBOOK_APP_ID`, `VITE_FACEBOOK_APP_SECRET`) as well as in-dialog credential configuration with secure local persistence.
> We also include an interactive simulation/sandbox mode so the entire flow (login $\rightarrow$ page discovery $\rightarrow$ token acquisition $\rightarrow$ long-lived exchange $\rightarrow$ disconnect) can be tested and demonstrated immediately without needing a live Meta Developer account.

## Proposed Changes

### Console Application (`apps/console`)

#### [NEW] [facebook-service.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/services/facebook-service.ts)
- Wrapper for Facebook JavaScript SDK and Graph API v21.0:
  - `initFacebookSdk(appId)`: dynamically injects and initializes `connect.facebook.net/en_US/sdk.js`.
  - `loginWithFacebook(appId)`: triggers `FB.login` with scopes: `public_profile`, `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.
  - `fetchUserPages(userAccessToken)`: calls `GET https://graph.facebook.com/v21.0/me/accounts` to retrieve all Facebook Pages with their short-lived Page Access Tokens.
  - `exchangeForLongLivedToken({ userAccessToken, appId, appSecret })`: exchanges short-lived user token for 60-day token, then retrieves the permanent Page Access Token.

#### [NEW] [facebook-store.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/stores/facebook-store.ts)
- Zustand store with `localStorage` persistence managing:
  - `isConnected`: connection status.
  - `appId`, `appSecret`: Facebook app credentials.
  - `connectedPage`: active Facebook Page (`id`, `name`, `category`, `accessToken`, `isLongLived`, `expiresAt`).
  - `availablePages`: list of managed Pages.
  - `userToken`: acquired Facebook user access token.
  - Actions: `setCredentials`, `setConnectedPage`, `disconnect`, `setAvailablePages`.

#### [NEW] [facebook-connect-modal.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/components/facebook-connect-modal.tsx)
- Liquid Glass modal dialog providing a clear multi-step flow:
  1. **Authentication Step**: Enter/verify Facebook App ID, click "Login with Facebook" (or demo connect).
  2. **Page Selection Step**: Displays user's Facebook Pages with Page names, categories, and IDs. User selects which Page to manage.
  3. **Token Management & Exchange Step**:
     - Displays the acquired Page Access Token with copy-to-clipboard button.
     - Indicates status: `Short-Lived Token` (~1-2 hours) vs `Long-Lived Token` (Never expires).
     - Provides action **"Exchange for Long-Lived Token"** using App Secret and Graph API exchange endpoint.
  4. **Connected State**: Allows viewing token details, switching pages, or disconnecting.

#### [MODIFY] [apps/index.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/index.tsx)
- Connect the Facebook card in the app grid to `facebook-store.ts`.
- When connected, display active Page name, green status badge, and "Manage" button.
- When clicking "Connect" or "Manage", open `FacebookConnectModal`.

---

### App Documentation & Artifact History

#### [NEW] [apps/console/doc/implementation_plan_07.md](file:///c:/Users/Admin/workspace/git/acc/apps/console/doc/implementation_plan_07.md)
- Mirror of this implementation plan per monorepo artifact history rules.

## Verification Plan

### Automated Tests
1. `pnpm --filter @acc/console build:web` — verify type correctness and bundling.
2. `pnpm --filter @acc/console lint` — verify ESLint compliance with 0 errors.

### Manual / User Verification
1. Navigate to **App Integrations** (`/apps`).
2. Click **Connect** on the Facebook card $\rightarrow$ modal opens.
3. Authenticate and select a Facebook Page $\rightarrow$ short-lived Page Access Token is acquired.
4. Click **Exchange for Long-Lived Token** $\rightarrow$ token upgrades to long-lived/permanent status.
5. Close modal $\rightarrow$ Facebook card shows "Connected" with Page details.
6. Refresh browser $\rightarrow$ integration state remains connected.
