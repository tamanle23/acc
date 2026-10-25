# Walkthrough: Removal of 'Upgrade to Pro' and 'Billing' from User Profile Dropdowns

Removed the **"Upgrade to Pro"** promotional entry and the **"Billing"** menu items from the user profile dropdown menus in `apps/console`.

## Changes Made

### Console Application (`apps/console`)

#### 1. Sidebar User Profile Dropdown ([`nav-user.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/nav-user.tsx))
- Removed the promotional "Upgrade to Pro" section and item.
- Removed the "Billing" link from the account settings dropdown group.
- Cleaned up unused `Sparkles` and `CreditCard` icon imports.
- Retained clean navigation options: `Account`, `Notifications`, and `Sign out`.

#### 2. Header User Profile Dropdown ([`profile-dropdown.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/profile-dropdown.tsx))
- Removed the "Billing" link and shortcut item.
- Retained `Profile`, `Settings`, `New Team`, and `Sign out`.

## Verification Results

### 1. TypeScript & Production Build
Command:
```bash
pnpm --filter @acc/console build:web
```
Result: **Passed** (exit code 0, 0 type errors).

### 2. ESLint Code Quality
Command:
```bash
pnpm --filter @acc/console lint
```
Result: **Passed** (exit code 0, 0 warnings, 0 errors).
