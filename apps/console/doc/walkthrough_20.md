# Walkthrough: Rebrand App Name from "Shadcn Admin" to "Acc"

We have updated all occurrences of the application name from **"Shadcn Admin"** to **"Acc"** across `apps/console`.

---

## Changes Made

### 1. Sidebar Default Profile / Team
- **apps/console/src/components/layout/data/sidebar-data.ts**:
  - Renamed the primary default profile from `'Shadcn Admin'` to `'Acc'`.

### 2. Authentication & Sign-In Pages
- **apps/console/src/features/auth/sign-in/sign-in-2.tsx**:
  - Updated header brand title to `Acc`.
- **apps/console/src/features/auth/auth-layout.tsx**:
  - Updated header brand title to `Acc`.
- **apps/console/src/routes/clerk/(auth)/route.tsx**:
  - Updated brand link title to `Acc`.

### 3. Application Metadata & Documentation
- **apps/console/index.html**:
  - Updated `<title>Acc</title>`, `<meta name="title" content="Acc" />`, `og:title`, and `twitter:title`.
- **apps/console/README.md**:
  - Updated header to `# Acc Console`.

---

## Verification Results

### Automated Verification
- **Web Build**:
  ```bash
  pnpm --filter @acc/console build:web
  ```
  Result: **Exit code 0** (completed in 533ms).
- **ESLint**:
  ```bash
  pnpm --filter @acc/console lint
  ```
  Result: **Exit code 0** (0 errors, 0 warnings).
