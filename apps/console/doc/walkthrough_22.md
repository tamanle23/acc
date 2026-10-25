# Walkthrough: Add Default Connected "Internal Blog" App to App Integrations

We have added a default, always-connected application card named **"Internal Blog"** to the App Integrations screen (`/apps`), representing the built-in blog website provided natively by the system.

---

## Changes Made

### 1. Apps Registry
- **apps/console/src/features/apps/data/apps.tsx**:
  - Added **`Internal Blog`** at the top of the apps registry:
    - **Logo**: `Newspaper` icon.
    - **Status**: `connected: true` (always connected by default).
    - **Description**: *"Default built-in blog website provided natively by the system for direct content publishing."*

### 2. Card Rendering & Action Handling
- **apps/console/src/features/apps/index.tsx**:
  - Rendered a distinctive **`System Default`** badge beside the `Internal Blog` title.
  - Configured the **`[Manage]`** button to provide immediate status feedback when clicked.
  - Displays the active **`[✓ Connected]`** badge on the card header.

---

## Verification Results

### Automated Verification
- **Web Build**:
  ```bash
  pnpm --filter @acc/console build:web
  ```
  Result: **Exit code 0** (completed cleanly in 553ms).
- **ESLint**:
  ```bash
  pnpm --filter @acc/console lint
  ```
  Result: **Exit code 0** (0 errors, 0 warnings).
