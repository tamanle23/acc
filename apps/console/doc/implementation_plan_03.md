# Library Verification & UI Performance Optimization Plan

The user reported that the UI still feels slow and requested a comprehensive verification of all libraries used in `apps/acc-console` (`@acc/web`).

---

## 1. Executive Summary of Library Audit Findings

Through dependency inspection, bundle chunk analysis, and runtime tracing, we identified **6 distinct architectural and library-level bottlenecks** causing noticeable sluggishness:

| Library / Module | Status & Issue | Impact | Proposed Optimization |
| :--- | :--- | :--- | :--- |
| **`@faker-js/faker`** | **Critical:** Imported in runtime mock files (`users.ts`, `tasks.ts`) | **465.8 kB minified chunk** bundled into the web app. Generates 500 synthetic users and 100 tasks on module evaluation, executing heavy regex and string generators synchronously on the main UI thread. | Pre-generate static mock data into pure JSON/TS constants. Completely decouple `@faker-js/faker` from the client bundle. |
| **`@tanstack/react-router-devtools` & `@tanstack/react-query-devtools`** | **High:** Statically imported and mounted in `__root.tsx` in `development` mode | Devtools deeply traverse and serialize router history, match states, and query cache on **every single state change / render**, causing major frame drops during interactions. | Lazy-load devtools dynamically on demand so they do not execute during normal development UI interactions. |
| **`@tanstack/react-router` Preload Config** | **Medium:** `defaultPreload: 'intent'`, `defaultPreloadStaleTime: 0` in `main.tsx` | Route preloading fires on every mouse hover/sweep over navigation links. Because stale time is `0ms`, it continuously triggers route matching and preload microtasks repeatedly. | Adjust `defaultPreloadStaleTime` to `30_000ms` (30 seconds) to cache preloaded intents and eliminate event queue flooding. |
| **`recharts`** | **Medium:** Eagerly imported into initial Dashboard bundle (`338.5 kB`) | Eagerly loaded for all users visiting `/`, even for tabs not currently active (e.g. `Analytics` tab). | Lazy-load `Overview` and `AnalyticsChart` with `React.lazy` and lightweight skeleton fallbacks. |
| **`@radix-ui/react-icons` vs `lucide-react`** | **Low-Medium:** Duplicate icon libraries bundled simultaneously | `@radix-ui/react-icons` is only used in 5 data-table and settings files, while `lucide-react` is used throughout the rest of the application. | Migrate the 5 files to `lucide-react` and remove `@radix-ui/react-icons` from the bundle. |
| **CSS Compositor & Transitions** | **Medium:** `will-change-transform` on all cards + `transition: all` | Browser creates excessive GPU compositor layers with heavy `backdrop-filter: blur()`, causing GPU raster thrashing on hover and scroll. | Restrict transitions to explicit properties (`box-shadow`, `transform`, `border-color`) and remove unconditional `will-change` on static cards. |

---

## 2. Proposed Changes

### Component 1: Mock Data De-bloat (`@faker-js/faker`)

#### [MODIFY] [users.ts](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/features/users/data/users.ts)
- Replace live runtime Faker generator with pre-generated static data.
- Eliminate the 465 kB `@faker-js/faker` bundle completely from the client runtime.

#### [MODIFY] [tasks.ts](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/features/tasks/data/tasks.ts)
- Replace live runtime Faker generator with pre-generated static data.

---

### Component 2: Devtools Dynamic Lazy Loading

#### [MODIFY] [__root.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/routes/__root.tsx)
- Replace eager imports of `ReactQueryDevtools` and `TanStackRouterDevtools` with dynamic `React.lazy` imports wrapped in `Suspense`.
- Devtools will only be downloaded and mounted asynchronously in development, stopping main thread blocking during page loads and interactions.

---

### Component 3: TanStack Router Preload Throttling

#### [MODIFY] [main.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/main.tsx)
- Update `defaultPreloadStaleTime: 30_000` (30s) so pointer movements over links don't continuously fire redundant route preloads.

---

### Component 4: Chart Lazy Loading (`recharts`)

#### [MODIFY] [index.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/features/dashboard/index.tsx)
- Lazy-load `Overview` and `Analytics` components using `React.lazy` and `Suspense`.
- The initial `/` route will load instantly without waiting for the 338 kB `recharts` chunk.

---

### Component 5: Icon Consolidation

#### [MODIFY] Files using `@radix-ui/react-icons`:
- [view-options.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/data-table/view-options.tsx)
- [toolbar.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/data-table/toolbar.tsx)
- [pagination.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/data-table/pagination.tsx)
- [faceted-filter.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/data-table/faceted-filter.tsx)
- [column-header.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/data-table/column-header.tsx)
- [account-form.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/features/settings/account/account-form.tsx)
- [appearance-form.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/features/settings/appearance/appearance-form.tsx)
- [data-table-row-actions.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/features/tasks/components/data-table-row-actions.tsx)
- Replace `@radix-ui/react-icons` with `lucide-react` equivalents.

---

### Component 6: CSS & GPU Compositing Cleanup

#### [MODIFY] [card.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/card.tsx)
- Remove `will-change-transform` which creates unnecessary compositor layers for every card.
- Keep hardware acceleration only on active hover states.

#### [MODIFY] [index.css](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/styles/index.css)
- Change `.liquid-glass-card` transition from `all 0.25s` to `transition-property: transform, box-shadow; transition-duration: 0.2s`.

---

## 3. Verification Plan

### Automated Verification
1. Run `pnpm --filter @acc/web build:web` to verify chunk sizes:
   - Verify that the `477 kB` faker chunk is eliminated.
   - Verify that the initial dashboard bundle is reduced.
2. Run `pnpm --filter @acc/web lint` to verify zero ESLint errors.

### Manual / Dev Verification
1. Start `pnpm --filter @acc/web dev` and test:
   - Fast responsiveness when switching tabs, navigating routes, and dragging appearance sliders.
   - No frame drops or hover lagging.
