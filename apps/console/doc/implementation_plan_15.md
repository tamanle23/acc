# Implementation Plan 15: Configurable Web & Desktop URL-Based Router Modes

Configure router history modes in `apps/console` using environment flags and environment auto-detection, transitioning from static `createMemoryHistory` to dynamic URL-based routing for Web and Desktop (with full flexibility to switch via environment variables).

## User Review Required

> [!IMPORTANT]
> **Default Behavior Changes:**
> - **Web (Browser)**: Defaults to **URL-based Browser History** (`createBrowserHistory()`). Navigation changes will update the browser address bar, support deep-linking, and persist across page refreshes.
> - **Desktop (Electron/Embedded)**: Defaults to **URL-based Hash History** (`createHashHistory()`) or Browser History (`createBrowserHistory()`), preventing page refresh resets while supporting desktop local file protocols (`file://` or custom schemes).
> - **Override Flag**: Can be explicitly controlled anywhere using `VITE_ROUTER_MODE` (`'browser' | 'hash' | 'memory'`).

## Proposed Changes

---

### `apps/console`

#### [MODIFY] [vite-env.d.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/vite-env.d.ts)
- Add `VITE_ROUTER_MODE?: 'browser' | 'hash' | 'memory' | 'auto'` and `VITE_DESKTOP_ROUTER_MODE?: 'browser' | 'hash' | 'memory'` to `ImportMetaEnv`.

#### [NEW] [router-history.ts](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/lib/router-history.ts)
- Implement `getRouterHistory()` helper function:
  - Parses `import.meta.env.VITE_ROUTER_MODE`.
  - Detects Desktop environment (`import.meta.env.ELECTRON`, `window.electron`, `window.location.protocol === 'file:'`).
  - Configures appropriate TanStack Router history instance (`createBrowserHistory()`, `createHashHistory()`, or `createMemoryHistory()`).

#### [MODIFY] [main.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/main.tsx)
- Replace static `createMemoryHistory` initialization with `getRouterHistory()`.

#### [MODIFY] [.env.example](file:///c:/Users/Admin/workspace/git/acc/apps/console/.env.example)
- Document `VITE_ROUTER_MODE` and `VITE_DESKTOP_ROUTER_MODE` options for developers.

---

## Verification Plan

### Automated Verification
- Run TypeScript lint / build check: `pnpm --filter @acc/console build`

### Manual Verification
- Launch standard web dev server: `pnpm --filter @acc/console dev` and verify address bar URL updates when navigating routes.
- Verify fallback / flag overrides when setting `VITE_ROUTER_MODE=hash` or `VITE_ROUTER_MODE=browser`.
