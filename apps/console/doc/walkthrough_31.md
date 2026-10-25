# Walkthrough 31: Configurable Router History Modes for Web and Desktop

Added flexible TanStack Router history configuration support to `apps/console`, switching from a static memory history to dynamic URL-based routing for Web and Desktop environments.

## Changes Made

### `apps/console`

#### [vite-env.d.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/vite-env.d.ts)
- Added type declarations for `VITE_ROUTER_MODE` (`'browser' | 'hash' | 'memory' | 'auto'`) and `VITE_DESKTOP_ROUTER_MODE` (`'browser' | 'hash' | 'memory'`).

#### [router-history.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/lib/router-history.ts)
- Created `getRouterHistory()` helper to detect environment and return appropriate history instance:
  - **Web (Browser)**: Defaults to URL-based `createBrowserHistory()`.
  - **Desktop (Electron)**: Defaults to URL-based `createHashHistory()`.
  - **Overrides**: Fully configurable via `VITE_ROUTER_MODE` and `VITE_DESKTOP_ROUTER_MODE`.

#### [main.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/main.tsx)
- Updated TanStack Router initialization to use `history: getRouterHistory()`.

#### [.env.example](file:///c:/Users/Admin/workspace/git/acc/apps/console/.env.example)
- Documented environment flag options for router modes.

---

## Verification Results

### Automated Verification
- Ran `pnpm --filter @acc/console build` — build succeeded with exit code 0.
