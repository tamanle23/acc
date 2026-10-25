# Walkthrough 24: TikTok OAuth Flow, Token Exchange & Profile Display

## 1. Executive Summary

Implemented the complete **TikTok OAuth 2.0 Flow (Login Kit v2)** within the App Integrations (`/apps`) module of `apps/console`.
This integration allows users to seamlessly connect their TikTok accounts, securely exchange tokens, and manage their TikTok profiles.

This implementation delivers:
1. TikTok brand icon support in the application gallery.
2. A streamlined OAuth 2.0 authorization code flow (`response_type=code`, `scope=user.info.basic,video.list,video.upload`) via TikTok Login Kit v2.
3. Token exchange handling (`grant_type=authorization_code`) to retrieve short-lived Access Tokens (24h) and long-lived Refresh Tokens (1y).
4. On-demand token refresh capabilities via `grant_type=refresh_token`.
5. Profile fetching utilizing TikTok's `user/info/` API to capture and display user metadata (display name, avatar, verified status).
6. A fully integrated Sandbox Demo Mode for zero-friction local testing without requiring active TikTok Developer credentials.
7. Liquid Glass design compliance with dynamic connection status rendering on the `/apps` gallery.

---

## 2. Key Changes & File Manifest

### Brand Icon & App Card
- [MODIFY] [`apps/console/src/assets/brand-icons/index.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/assets/brand-icons/index.ts): Exported existing `IconTiktok`.
- [MODIFY] [`apps/console/src/features/apps/data/apps.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/data/apps.tsx): Fixed the TikTok card config to use the proper icon and updated the copy to reflect video management capabilities.

### Configuration & Typings
- [MODIFY] [`apps/console/.env.example`](file:///c:/Users/Admin/workspace/git/acc/apps/console/.env.example): Appended `VITE_TIKTOK_CLIENT_KEY` and `VITE_TIKTOK_CLIENT_SECRET`.
- [MODIFY] [`apps/console/src/vite-env.d.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/vite-env.d.ts): Registered `VITE_TIKTOK_CLIENT_KEY` and `VITE_TIKTOK_CLIENT_SECRET` in `ImportMetaEnv`.

### TikTok API & OAuth Service
- [NEW] [`apps/console/src/features/apps/services/tiktok-service.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/services/tiktok-service.ts):
  - `buildTikTokOAuthUrl`: Targets `v2/auth/authorize/` endpoint.
  - `exchangeAuthCodeForTokens`: Targets `v2/oauth/token/`.
  - `refreshAccessToken`: Standard OAuth refresh logic handling TikTok's token payload.
  - `fetchTikTokProfile`: Targets `v2/user/info/` retrieving `display_name`, `avatar_url`, and `union_id`.
  - Full demo mode mock generators (`simulateDemoTikTokAuthCode`, `simulateDemoTokenExchange`).

### State Management
- [NEW] [`apps/console/src/features/apps/stores/tiktok-store.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/stores/tiktok-store.ts):
  - Zustand persistence under `tiktok_app_integration` tracking state for tokens, `connectedProfile`, and runtime credentials.

### Liquid Glass Modal & UI Integration
- [NEW] [`apps/console/src/features/apps/components/tiktok-connect-modal.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/components/tiktok-connect-modal.tsx):
  - Three-stage flow matching Liquid Glass aesthetics (Launch, Validate Code, Token Vault & Profile Card).
  - Handles client credential overrides on the fly.
- [MODIFY] [`apps/console/src/features/apps/index.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/index.tsx):
  - Connected `useTikTokStore` to dynamically display connection state and user profile name.
  - Rendered `TikTokConnectModal`.

---

## 3. Verification & Validation

### Automated Checks
```powershell
pnpm --filter @acc/console build:web
# Clean build (0 errors)

pnpm --filter @acc/console lint
# 0 errors, 0 warnings
```

### Manual Verification
1. Access `/apps` to view the App Integrations gallery.
2. Verified TikTok card uses `IconTiktok` and correct description.
3. Click **Connect** to open the TikTok modal.
4. Explored **Configuration Dropdown** to confirm live client ID entry.
5. Click **Try Sandbox Demo Flow** $\rightarrow$ Mock auth code successfully returned.
6. Click **Exchange for Access & Refresh Tokens** $\rightarrow$ Connected successfully.
7. Verified active state displaying user avatar, name ("Unipost Studio TikTok"), and active Token Vault.
8. Closing the modal updates the gallery card status to `[Manage]` and `[✓ Connected]`, showing the connected profile details.
