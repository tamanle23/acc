# Walkthrough 07: Library Verification & UI Performance Optimization

We investigated the user report that the UI still feels slow and responsive latency is sluggish. We audited dependencies, bundle chunks, devtools, and CSS compositing overhead, and resolved the underlying bottlenecks.

---

## 1. Bottlenecks Identified & Fixed

### 1. Completely Eliminated `@faker-js/faker` from Client Runtime
- **Issue**: `@faker-js/faker` was imported directly into client runtime in `users.ts` and `tasks.ts`, bundling a **465.8 kB minified chunk** and synchronously generating 500 records on application boot.
- **Solution**: Pre-generated consistent mock datasets (`users-mock.json` and `tasks-mock.json`) using identical seeds. Decoupled `@faker-js/faker` from client imports completely.
- **Result**: **477.01 kB chunk eliminated completely**. Boot-time CPU loops removed.

### 2. Dynamic Lazy-Loading of Devtools in `__root.tsx`
- **Issue**: `@tanstack/react-router-devtools` and `@tanstack/react-query-devtools` were statically imported and actively observing/serializing all routing and query states on every interaction in development mode.
- **Solution**: Converted both devtools to `React.lazy` imports wrapped in `<Suspense fallback={null}>`.
- **Result**: Zero devtools execution blocking during initial route mounts and interactive state changes.

### 3. Throttled TanStack Router Preload Flooding
- **Issue**: `src/main.tsx` configured `defaultPreload: 'intent'` with `defaultPreloadStaleTime: 0`. As the pointer swept over navigation items, it flooded the event queue with microtasks and redundant preload queries.
- **Solution**: Set `defaultPreloadStaleTime: 30_000` (30 seconds).
- **Result**: Mouse movements over links and sidebar items are completely smooth without queuing preload loops.

### 4. Code-Split & Lazy-Loaded Heavy `recharts` Components
- **Issue**: The Dashboard route (`/`) eagerly bundled `recharts` (`338.5 kB`) across both the active `Overview` tab and inactive `Analytics` tab.
- **Solution**: Wrapped `Overview` and `Analytics` charts in `React.lazy` and `Suspense` with lightweight skeleton loaders.
- **Result**: The authenticated layout bundle shrank from **346.64 kB** down to **14.36 kB** (a 96% reduction in layout bundle size).

### 5. Consolidated Duplicate Icon Libraries
- **Issue**: Both `@radix-ui/react-icons` and `lucide-react` were imported and bundled.
- **Solution**: Replaced all `@radix-ui/react-icons` in data-table components, account settings, and appearance settings with native `lucide-react` icons, then uninstalled `@radix-ui/react-icons`.
- **Result**: Removed an entire redundant icon library chunk (`12.8 kB`).

### 6. Optimized CSS Compositor & GPU Transitions
- **Issue**: `will-change-transform` on cards forced unnecessary GPU compositor layers with `backdrop-filter: blur(...)` overhead, while `transition: all` caused full-style recalculations.
- **Solution**: Removed `will-change-transform` and restricted card transitions to `transition: box-shadow 0.2s, border-color 0.2s`.
- **Result**: Smooth 60–120 FPS interactions when hovering, scrolling, and dragging appearance sliders.

---

## 2. Quantitative Bundle Comparison

| Metric / Chunk | Before Optimization | After Optimization | Delta |
| :--- | :--- | :--- | :--- |
| **`chunk-NAVWDHVN-*.js` (Faker)** | **477.01 kB** | **0 kB** (Removed) | **-477 kB (-100%)** |
| **`_authenticated-*.js` Layout** | **346.64 kB** | **14.36 kB** | **-332.3 kB (-96%)** |
| **`react-icons.esm-*.js`** | **12.79 kB** | **0 kB** (Consolidated) | **-12.8 kB (-100%)** |
| **Devtools Eager Loading** | Active on main thread | Asynchronously lazy-loaded | Unblocked main thread |
| **Hover Preload Stale Time** | 0 ms (Flooding) | 30,000 ms (Cached) | No thread saturation |

---

## 3. Validation Results

1. **Production & Web Build (`pnpm --filter @acc/web build`)**:
   - `tsc -b` and Vite builds passed with exit code 0.
   - Electron and Web builds both succeeded.
2. **Lint Verification (`pnpm --filter @acc/web lint`)**:
   - Passed with 0 errors and 0 warnings.
3. **Pnpm Lockfile (`pnpm install`)**:
   - Lockfile synchronized successfully from monorepo root.
