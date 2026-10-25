# Implementation Plan - Clean Up Facebook Modal & Add "Manage" / "Connected" Card Actions

Redesign the Facebook Page Integration modal to eliminate visual clutter for end-users, and update the Facebook integration card in App Integrations so that once connected, it displays a **"Manage"** button on the left alongside a **"Connected"** status label on the right.

## Proposed Changes

### 1. App Integrations Card Header Actions

#### [MODIFY] [apps/console/src/features/apps/index.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/index.tsx)
- In the App card action section:
  - When `app.connected` is **false**: Render the single `"Connect"` button.
  - When `app.connected` is **true**: Render:
    1. **"Manage"** button on the left (interactive, opens `<FacebookConnectModal />`).
    2. **"Connected"** status button/badge on the right (with subtle green frosted styling and checkmark icon).

---

### 2. Facebook Connect Modal Redesign

#### [MODIFY] [apps/console/src/features/apps/components/facebook-connect-modal.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/apps/components/facebook-connect-modal.tsx)
- **Primary 1-Click User Flow (`!isConnected`)**:
  - Remove the prominent credentials box from the default view.
  - Display a clean Liquid Glass card with Facebook icon, explanation of features (posts, insights, inbox sync), and requested permissions badges.
  - Full-width primary **"Continue with Facebook"** button (uses `VITE_FACEBOOK_APP_ID` from `.env`).
  - Secondary **"Sandbox Demo Mode"** button for instant testing without Facebook setup.
- **Collapsible "Advanced Developer Settings"**:
  - Add an accordion toggle: `⚙️ Advanced: Custom App ID & Secret` (collapsed by default).
  - Contains the manual input fields for App ID & App Secret with `.env loaded` badges.
  - If a user clicks "Continue with Facebook" and no App ID exists in `.env`, automatically expand the advanced section and highlight the field.
- **Connected State View (`isConnected`)**:
  - Clean page switcher, token status (`Permanent Long-Lived Token` vs `Short-Lived Token`), token viewer/copy, and "Exchange for Long-Lived Token" button.

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
1. Inspect Facebook Card in `/apps`:
   - When not connected: Card shows single `"Connect"` button.
   - Click "Connect" $\rightarrow$ opens modal $\rightarrow$ click "Sandbox Demo Mode".
   - When connected: Card header displays **`[Manage]`** button on the left and **`[Connected]`** badge/label on the right.
   - Clicking `"Manage"` re-opens the modal to manage or disconnect the page.
