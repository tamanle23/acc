# History Entry 142: Sibling Client Sandbox Alignment (tekgo-ui & mobile-ui)

## Problem Statement
Iteration 10 Phase 3 called for aligning sibling clients (`apps/tekgo-ui` Next.js 15 blog and `apps/mobile-ui` Expo SDK 57 React Native app) with the Unified Sandbox Platform and live Spring Boot backend.
Specifically:
1. `tekgo-ui` needed to align its CMS client defaults with the live backend sandbox port 8000 and the pre-warmed `tenant-acme` dataset while maintaining client-side sandbox fallback.
2. Next.js 15 SSR build failures caused by missing `'use client'` directives in interactive `@acc/ui` widgets needed resolution.
3. `mobile-ui` required persona switching and active tenant visualization in its Liquid Glass settings interface wired to `@acc/sandbox`.

## Implementation Details

### 1. Next.js 15 SSR Client Component Directives in `@acc/ui`
- Added `'use client';` directive to the top of:
  - `packages/ui/src/widgets/barcode-scanner-widget.tsx`
  - `packages/ui/src/widgets/geo-location-widget.tsx`
  - `packages/ui/src/widgets/signature-pad-widget.tsx`
- Resolved React hook SSR compilation errors during Next.js production builds.

### 2. `tekgo-ui` CMS Client Alignment
- In `apps/tekgo-ui/lib/cms/acc-cms-client.ts`, updated `DEFAULT_CONFIG`:
  - Default `baseUrl`: changed from `http://localhost:8080` to `http://localhost:8000` (live Spring Boot sandbox server).
  - Default `tenantId`: changed from `default-tenant` to `tenant-acme` (matching the pre-warmed 1,000 CMS articles dataset).
- Maintained hybrid fallback through `sandboxRegistry.findHandler(...)`.

### 3. `mobile-ui` Unified Sandbox & Tenancy Controls
- In `apps/mobile-ui/src/screens/ProfileScreen.tsx`:
  - Connected `useMobileContextStore` to render a dedicated **Unified Sandbox & Tenancy** `GlassCard`.
  - Added persona selector buttons (`👑 SYSTEM`, `ADMIN`, `CREATOR`, `USER`) updating both local store and `@acc/sandbox` active tenant context.
  - Displayed the active tenant badge (`tenant-acme`, `tenant-us-east-1`).

## Verification & Results
1. **`tekgo-ui` Next.js Build**:
   - `pnpm --filter tekgo-ui build` completed with exit code 0.
   - 95/95 static pages generated successfully, RSS feed and search index compiled.
2. **`mobile-ui` Vitest Suite**:
   - `pnpm --filter mobile-ui test` completed with exit code 0: 4 test files passed, 23/23 tests green in 803ms.
3. **Monorepo Boundary Integrity**:
   - Clean packages linking via `workspace:*`.
   - WCAG 2.2 AA compliant contrast on Liquid Glass persona badges.
