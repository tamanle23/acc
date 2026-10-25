# Implementation Plan: TikTok OAuth Flow & Token Exchange

## 1. Goal Description
Implement the TikTok OAuth 2.0 flow within the App Integrations (`/apps`) module of the `apps/console` workspace. This will allow users to securely acquire an Authorization Code and exchange it for an Access Token and Refresh Token, similar to the YouTube integration.

## 2. Proposed Changes

### Configuration & Typings
- **MODIFY** `apps/console/.env.example`
  - Add `VITE_TIKTOK_CLIENT_KEY` and `VITE_TIKTOK_CLIENT_SECRET`.
- **MODIFY** `apps/console/src/vite-env.d.ts`
  - Add type definitions for `VITE_TIKTOK_CLIENT_KEY` and `VITE_TIKTOK_CLIENT_SECRET`.

### Brand Icon & App Card
- **MODIFY** `apps/console/src/assets/brand-icons/index.ts`
  - Export the existing `IconTiktok` component.
- **MODIFY** `apps/console/src/features/apps/data/apps.tsx`
  - Fix the existing "Tiktok" entry (which currently incorrectly shows Telegram details) to use `IconTiktok` and describe TikTok video publishing features.

### TikTok API & OAuth Service
- **NEW** `apps/console/src/features/apps/services/tiktok-service.ts`
  - Implement `buildTikTokOAuthUrl` using TikTok Login Kit v2 endpoints (`https://www.tiktok.com/v2/auth/authorize/`).
  - Implement `exchangeAuthCodeForTokens` targeting `https://open.tiktokapis.com/v2/oauth/token/`.
  - Implement `refreshAccessToken` targeting `https://open.tiktokapis.com/v2/oauth/token/` with `grant_type=refresh_token`.
  - Implement `fetchTikTokProfile` targeting `https://open.tiktokapis.com/v2/user/info/`.
  - Provide `simulateDemoTikTokAuthCode` and `simulateDemoTokenExchange` for zero-friction Sandbox Demo Mode.

### State Management
- **NEW** `apps/console/src/features/apps/stores/tiktok-store.ts`
  - Implement Zustand persistent store (`tiktok_app_integration`).
  - Track `isConnected`, `authCode`, `accessToken`, `refreshToken`, `expiresAt`, `connectedProfile`, `clientKey`, `clientSecret`, and `isDemoMode`.

### UI Integration (Liquid Glass)
- **NEW** `apps/console/src/features/apps/components/tiktok-connect-modal.tsx`
  - Implement a 3-stage Liquid Glass modal (Authorization Code $\rightarrow$ Token Exchange $\rightarrow$ Connected Dashboard & Token Vault).
- **MODIFY** `apps/console/src/features/apps/index.tsx`
  - Import and render `TikTokConnectModal`.
  - Map dynamic state from `useTikTokStore` to update the TikTok app card to reflect active connections and display the connected profile username.
  - Wire up the `Connect` and `Manage` buttons to open the modal.

## 3. Verification Plan
- **Automated Tests**: Run `pnpm --filter @acc/console build:web` and `pnpm --filter @acc/console lint`.
- **Manual Verification**: Run the Sandbox Demo flow in the UI to ensure states transition properly, mock tokens are dispensed, and the connected dashboard is displayed.
