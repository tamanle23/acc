# Implementation Plan - YouTube OAuth 2.0 Authorization Code & Token Exchange Flow

Implement the complete YouTube OAuth 2.0 integration for the YouTube card in Console App Integrations (`/apps`). This flow enables acquiring an **Authorization Code** with offline access, exchanging it for both a short-lived **Access Token** and a permanent **Refresh Token**, discovering the user's YouTube Channel details, and updating the card branding with the official YouTube icon.

## Proposed Changes

### 1. Brand Icon & App Card Data

#### [NEW] [apps/console/src/assets/brand-icons/icon-youtube.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/assets/brand-icons/icon-youtube.tsx)
- Create official YouTube brand icon SVG component matching existing brand icons.

#### [MODIFY] [apps/console/src/assets/brand-icons/index.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/assets/brand-icons/index.ts)
- Export `IconYoutube`.

#### [MODIFY] [apps/console/src/features/apps/data/apps.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/data/apps.tsx)
- Replace `IconNotion` on YouTube card with `IconYoutube` (styled in classic YouTube red `#FF0000`).
- Update YouTube card default `connected: false` and description to: *"Connect with YouTube channel to manage videos, playlists, and community posts."*

---

### 2. YouTube OAuth Service & Persistent Store

#### [NEW] [apps/console/src/features/apps/services/youtube-service.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/services/youtube-service.ts)
- **Google OAuth Authorization Code URL Builder**:
  Constructs Google OAuth 2.0 authorization URL targeting:
  - Scopes: `https://www.googleapis.com/auth/youtube.readonly`, `https://www.googleapis.com/auth/youtube.upload`, `https://www.googleapis.com/auth/youtube.force-ssl`
  - Parameters: `response_type=code`, `access_type=offline`, `prompt=consent` (guaranteeing a refresh token).
- **Popup Code Receiver**: Launches OAuth popup and listens for the returned redirect authorization `code`.
- **Token Exchange**: Calls `https://oauth2.googleapis.com/token` (`grant_type=authorization_code`) to exchange authorization code for `access_token` and `refresh_token`.
- **Token Refresh**: Calls `https://oauth2.googleapis.com/token` (`grant_type=refresh_token`) to acquire a fresh access token using the stored refresh token.
- **Channel Discovery**: Queries `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true` to retrieve channel title, custom URL, subscriber count, and avatar.
- **Sandbox Demo Simulator**: Complete mock simulator for zero-friction local testing without Google Cloud setup.

#### [NEW] [apps/console/src/features/apps/stores/youtube-store.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/stores/youtube-store.ts)
- Zustand persistent store with `localStorage` key `youtube_app_integration`.
- Tracks: `isConnected`, `authCode`, `accessToken`, `refreshToken`, `tokenExpiresAt`, `connectedChannel`, `clientId`, `clientSecret`, `isDemoMode`.
- Fallbacks to `import.meta.env.VITE_YOUTUBE_CLIENT_ID` and `VITE_YOUTUBE_CLIENT_SECRET`.

---

### 3. YouTube Connect Modal & App Integrations Screen

#### [NEW] [apps/console/src/features/apps/components/youtube-connect-modal.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/components/youtube-connect-modal.tsx)
- Liquid Glass dialog design:
  - **Step 1 (Pre-auth)**: Clean 1-click connect card with YouTube branding, capability highlights (Video Uploads, Comment Moderation, Analytics), requested Google scopes, primary "Continue with YouTube / Google" button, Sandbox Demo mode, and collapsible Advanced Developer Settings for custom Client ID & Secret.
  - **Step 2 (Code Acquired & Exchange)**: Shows acquired Authorization Code with copy/view option and prominent **"Exchange for Access & Refresh Tokens"** button.
  - **Step 3 (Connected Channel & Token Management)**: Displays channel details (avatar, subscribers, handle), masked access token with validity timer, masked refresh token badge, "Refresh Access Token" action, and Disconnect options.

#### [MODIFY] [apps/console/src/features/apps/index.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/index.tsx)
- Connect dynamic state for YouTube from `useYouTubeStore()`.
- When connected: shows **`[Manage]`** button on the left (opens YouTube modal) and **`[✓ Connected]`** on the right; card subtitle dynamically reflects active channel and refresh token status.
- Render `<YouTubeConnectModal />`.

---

### 4. Environment Variables & Types

#### [MODIFY] [apps/console/.env.example](file:///c:/Users/Admin/workspace/git/acc/apps/console/.env.example) & [.env.local](file:///c:/Users/Admin/workspace/git/acc/apps/console/.env.local)
- Add `VITE_YOUTUBE_CLIENT_ID` and `VITE_YOUTUBE_CLIENT_SECRET`.

#### [MODIFY] [apps/console/src/vite-env.d.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/vite-env.d.ts)
- Add type definitions for `VITE_YOUTUBE_CLIENT_ID` and `VITE_YOUTUBE_CLIENT_SECRET`.

---

## Verification Plan

### Automated Verification
1. Web Build:
   ```bash
   pnpm --filter @acc/console build:web
   ```
2. Lint check:
   ```bash
   pnpm --filter @acc/console lint
   ```

### Manual Verification
1. Open `/apps`:
   - Verify YouTube card displays official YouTube red icon.
   - Click "Connect" on YouTube card $\rightarrow$ opens YouTube Connect modal.
   - Click "Sandbox Demo Mode" $\rightarrow$ verifies Authorization Code acquisition, automatic or manual token exchange for access + refresh tokens, and channel display.
   - Verify card updates to `[Manage]` on the left and `[Connected]` on the right with channel name subtitle.
