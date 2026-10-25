# Walkthrough 23: YouTube OAuth Flow, Refresh Token Exchange & Integration

## 1. Executive Summary

Implemented the complete **YouTube OAuth 2.0 Flow** within the App Integrations (`/apps`) module of `apps/console`.
This delivers:
1. An official YouTube brand SVG icon replacing the generic placeholder.
2. An OAuth 2.0 authorization code acquisition flow (`response_type=code`, `access_type=offline`, `prompt=consent`) to guarantee issuance of a permanent **Refresh Token**.
3. A token exchange mechanism (`grant_type=authorization_code`) converting the authorization code into a short-lived **Access Token** and a permanent **Refresh Token**.
4. An on-demand token refresh engine (`grant_type=refresh_token`) allowing renewal of the access token anytime.
5. YouTube Data API v3 channel metadata querying (`/v3/channels?part=snippet,statistics&mine=true`) displaying channel branding, subscriber count, video count, and total views.
6. A zero-friction **Sandbox Demo Mode** allowing instant testing and demonstration without needing immediate Google Cloud Console OAuth setup.
7. Liquid Glass design compliance with frosted backdrop blur, specular borders, and interactive card feedback.

---

## 2. Key Changes & File Manifest

### Brand Icon & App Card
- [NEW] [`apps/console/src/assets/brand-icons/icon-youtube.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/assets/brand-icons/icon-youtube.tsx): Crisp SVG component featuring the official YouTube play button logo.
- [MODIFY] [`apps/console/src/assets/brand-icons/index.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/assets/brand-icons/index.ts): Exported `IconYoutube`.
- [MODIFY] [`apps/console/src/features/apps/data/apps.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/data/apps.tsx): Wired `IconYoutube` with YouTube brand red accents (`text-red-600`) and updated description detailing OAuth2 code flow and refresh tokens.

### Configuration & Typings
- [MODIFY] [`apps/console/.env.example`](file:///c:/Users/Admin/workspace/git/acc/apps/console/.env.example): Added `VITE_YOUTUBE_CLIENT_ID` and `VITE_YOUTUBE_CLIENT_SECRET`.
- [MODIFY] [`apps/console/src/vite-env.d.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/vite-env.d.ts): Added strong typings for YouTube environment variables in `ImportMetaEnv`.

### YouTube API & OAuth Service
- [NEW] [`apps/console/src/features/apps/services/youtube-service.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/services/youtube-service.ts):
  - `buildGoogleOAuthUrl`: Generates Google OAuth consent screen URL with scopes `youtube.readonly`, `youtube.upload`, `youtube.force-ssl`, `access_type=offline`, and `prompt=consent`.
  - `exchangeAuthCodeForTokens`: Posts to `https://oauth2.googleapis.com/token` with `grant_type=authorization_code`.
  - `refreshAccessToken`: Posts to `https://oauth2.googleapis.com/token` with `grant_type=refresh_token`.
  - `fetchYouTubeChannel`: Queries YouTube Data API v3 for channel title, statistics, and thumbnail.
  - `simulateDemoYouTubeAuthCode` & `simulateDemoTokenExchange`: Full mock simulator for instant sandbox verification.

### State Management
- [NEW] [`apps/console/src/features/apps/stores/youtube-store.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/stores/youtube-store.ts):
  - Zustand persistent store (`youtube_app_integration` in `localStorage`).
  - Tracks `isConnected`, `authCode`, `accessToken`, `refreshToken`, `expiresAt`, `connectedChannel`, `clientId`, `clientSecret`, and `isDemoMode`.
  - Actions for connecting, disconnecting, saving custom credentials, and token refreshing.

### Liquid Glass Modal & UI Integration
- [NEW] [`apps/console/src/features/apps/components/youtube-connect-modal.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/components/youtube-connect-modal.tsx):
  - Step 1: Authorization Code acquisition (Launch Google Login popup or One-Click Sandbox Demo).
  - Step 2: Code verification & Token exchange trigger.
  - Step 3: Active connection dashboard showing channel stats (Subscribers, Videos, Total Views) and Token Vault with copy/reveal toggles for Access Token and Refresh Token, plus on-demand token refresh button.
- [MODIFY] [`apps/console/src/features/apps/index.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/index.tsx):
  - Hooked `useYouTubeStore` to dynamically update card status to `Connected` with channel title subtitle.
  - Bound `onClick` handlers for `Manage` and `Connect` buttons to open `YouTubeConnectModal`.

---

## 3. Verification & Validation

### Automated Checks
```powershell
# 1. Type check & Web build
pnpm --filter @acc/console build:web
# Exit Code: 0 (Built cleanly in 654ms)

# 2. Linter
pnpm --filter @acc/console lint
# Exit Code: 0 (0 errors, 0 warnings)
```

### Manual Verification Flow
1. Navigate to `/apps`.
2. Locate the "Youtube" card:
   - Official red YouTube logo is rendered.
   - Action shows "Connect".
3. Click "Connect":
   - The Liquid Glass modal opens.
   - Shows Stage 1: Google OAuth configuration info and two action paths:
     - Real Google OAuth (launches Google OAuth dialog).
     - "Try Sandbox Demo Flow" for instant evaluation.
4. Click "Try Sandbox Demo Flow":
   - Acquires simulated Authorization Code.
   - Moves to Stage 2: Code inspection and "Exchange for Access & Refresh Tokens" button.
5. Click "Exchange for Access & Refresh Tokens":
   - Securely acquires Tokens and fetches channel metadata (`Unipost Studio`).
   - Moves to Stage 3: Connected channel dashboard with subscriber/video metrics and Token Vault showing Access Token, Refresh Token (permanent), and expiry.
6. Return to gallery:
   - Card updates to `[Manage]` on the left and `[✓ Connected]` on the right.
   - Subtitle displays: `Connected to Channel: "Unipost Studio" (Has Refresh Token)`.
