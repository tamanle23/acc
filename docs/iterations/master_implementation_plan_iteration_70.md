# Master Implementation Plan - Iteration 70
## Migration of `tekgo-ui`: Next.js 15 to Astro 5 (Hybrid/SSR) + Preact + Tailwind CSS v4

---

### 1. Executive Summary

This master plan details the architectural migration of `tekgo-ui` (the technical publication and blog hub of the `acc` monorepo) from Next.js 15 / React 19 to **Astro 5 (Hybrid/SSR) + Preact + Tailwind CSS v4**.

Through interactive architectural alignment, the following foundational decisions have been established:
1. **Canonical URLs:** Keep `/blog` and `/blog/[...slug]` as the canonical route hierarchy, matching existing SEO, internal linking, and `ROUTE.md` specifications.
2. **Content Architecture:** Use the Service Layer pattern (`contentProvider` + Zod entity schemas) to enable immediate SSR dynamic cache invalidation on CMS publish webhooks.
3. **Search Engine Island:** Native lightweight Preact Command Palette island (`SearchModal.tsx`) with `Cmd+K` keyboard shortcut and Liquid Glass styling, eliminating legacy `pliny/kbar`.
4. **Content Renderer:** Server-only Preact component for `PortableTextRenderer.tsx`, executing at SSR/build-time and emitting **0 KB** client JavaScript for article prose.
5. **Cutover Strategy:** Immediate clean cutover in Phase 1, removing `app/`, `next.config.js`, and Next.js artifacts.

---

### 2. Trade-off Matrices

| Dimension | Next.js 15 (Current) | Astro 5 + Preact (Target) | Trade-Off & Rationale |
| :--- | :--- | :--- | :--- |
| **Client JS Footprint** | ~140KB baseline React runtime + layout hydration bundles | **0 KB baseline** for static content; ~4KB Preact runtime on pages with islands | Sub-millisecond FCP and zero JavaScript execution for editorial reading. |
| **Component Model** | React Server Components (RSC) + `'use client'` | `.astro` server templates + Preact `.tsx` islands (`client:*`) | Clear boundary separation: markup renders directly to HTML without virtual DOM overhead. |
| **State Management** | React Context (`ThemeProvider`, custom contexts) | **Nano Stores** (`atom`, `map`) via `@nanostores/preact` | Decoupled cross-island reactive state without shared React tree or provider overhead. |
| **Content Engine** | Custom `lib/content.ts` reading JSON / portableText | **Service Layer (`contentProvider`) + Zod Contracts** | Retains dual-mode CMS support (Iteration 04) with instant SSR dynamic updates. |
| **Styling Pipeline** | PostCSS + Tailwind CSS v4 | **Vite Native** (`@tailwindcss/vite`) in `astro.config.mjs` | Faster compile times, removes PostCSS wrapper layer, native `@theme` support. |
| **API Endpoints** | Next Route Handlers (`app/api/**/route.ts`) | **Astro API Endpoints** (`src/pages/api/**.ts`) with WHATWG Web API | Full WinterTC conformance (`Request`, `Response`, `crypto.subtle`). |

---

### 3. System Topology & Island Architecture

```mermaid
graph TD
    subgraph Client ["Client Browser (Hydration Islands)"]
        TS[ThemeSwitch.tsx\nclient:load]
        MN[MobileNav.tsx\nclient:idle]
        SM[SearchModal.tsx\nclient:idle]
        STC[ScrollTopAndComment.tsx\nclient:visible]
        COM[Comments.tsx\nclient:visible]
        BFL[BlogFilterList.tsx\nclient:idle]
        NS[(Nano Stores\nthemeStore, navStore, searchStore)]
        TS <--> NS
        MN <--> NS
        SM <--> NS
    end

    subgraph AstroLayout ["Astro Base Shell (0 KB Client JS)"]
        BL[BaseLayout.astro]
        HDR[Header.astro]
        FTR[Footer.astro]
        CRD[Card.astro]
        SEC[SectionContainer.astro]
        PTR[PortableTextRenderer.tsx\nSSR Only - 0 KB JS]
        BL --> HDR
        BL --> FTR
        HDR --> TS
        HDR --> MN
        HDR --> SM
    end

    subgraph Pages ["Astro App Routes (Hybrid / SSR)"]
        P_Home[pages/index.astro]
        P_Blog[pages/blog/index.astro]
        P_Post[pages/blog/[...slug].astro]
        P_Tags[pages/tags/index.astro]
        P_Tag[pages/tags/[tag]/index.astro]
        P_Proj[pages/projects/index.astro]
        P_About[pages/about/index.astro]
        P_ApiNews[pages/api/newsletter.ts]
        P_ApiReval[pages/api/revalidate.ts]
    end

    subgraph ContentLayer ["Content Service Layer"]
        CP[ContentProvider]
        ZOD[Zod Entity Schemas]
        DUAL[Dual-Mode Loader: Local JSON + CMS Gateway]
        CP --> ZOD
        CP --> DUAL
    end

    Pages --> BL
    Pages --> ContentLayer
    P_Post --> PTR
```

---

### 4. Mathematical & Algorithmic Specifications

#### 4.1 Replay Protection & HMAC-SHA256 Timing Safe Verification (WinterTC)
The revalidation endpoint verifies HMAC signatures without Node.js `crypto.createHmac`, conforming strictly to WinterTC / Web Crypto API:
$$\text{ExpectedSig} = \text{HMAC-SHA256}_{K}(\text{timestamp} \mathbin{\Vert} \text{"."} \mathbin{\Vert} \text{rawBody})$$
$$\Delta t = |t_{\text{current}} - t_{\text{timestamp}}| \le 300\text{ seconds}$$

Constant-time equality is implemented via:
$$\text{verifyToken}(A, B) = \sum_{i=0}^{N-1} (A[i] \oplus B[i]) == 0$$

#### 4.2 Content Sorting & Pagination Algorithm
Posts are sorted in strict descending chronological order:
$$\text{SortedPosts} = [p_1, p_2, \dots, p_n] \quad \text{where} \quad \text{date}(p_i) \ge \text{date}(p_{i+1})$$
For page $k \in \{1, \dots, \lceil n / S \rceil\}$ with page size $S = 5$:
$$\text{Slice}(k) = [p_{(k-1)S}, \dots, p_{\min(kS - 1, n - 1)}]$$

---

### 5. Concrete File & Class Signatures

#### 5.1 `astro.config.mjs`
```javascript
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    preact({ compat: true }),
  ],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
  },
});
```

#### 5.2 Nano Stores: `src/stores/theme.ts` & `src/stores/search.ts`
```typescript
import { atom } from 'nanostores';

export type Theme = 'light' | 'dark' | 'system';
export const themeStore = atom<Theme>('system');

export function setTheme(theme: Theme) {
  themeStore.set(theme);
  if (typeof window !== 'undefined') {
    localStorage.setItem('theme', theme);
    const resolvedDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', resolvedDark);
  }
}

export const isSearchOpenStore = atom<boolean>(false);
```

---

### 6. Phased Roadmap

#### Phase 1: Environment & Project Scaffolding (Immediate Cutover)
- Clean cutover: remove legacy Next.js files (`app/`, `next.config.js`, `next-env.d.ts`).
- Update `apps/tekgo-ui/package.json` dependencies:
  - Add `astro`, `@astrojs/preact`, `@astrojs/node`, `preact`, `@nanostores/preact`, `nanostores`, `@tailwindcss/vite`, `tailwindcss` (v4).
  - Update scripts: `"dev": "astro dev --host"`, `"build": "astro build"`, `"serve": "node dist/server/entry.mjs"`, `"check": "astro check"`.
- Create `astro.config.mjs` with Node standalone adapter, Preact compat integration, and Tailwind Vite plugin.
- Create `src/styles/global.css` retaining all design tokens, OKLCH scales, and Liquid Glass utility classes.
- Update `tsconfig.json` with `"jsx": "react-jsx"` and `"jsxImportSource": "preact"`.

#### Phase 2: Layouts, Fonts & Assets
- Create `src/layouts/BaseLayout.astro`.
- Implement SEO head meta tags, OpenGraph attributes, favicon, and viewport.
- Retain Google fonts (`Space Grotesk`) and static asset references (`public/`).
- Embed inline theme script in `<head>` to prevent flash-of-unstyled-theme (FOUC).

#### Phase 3: Content Layer & Route Implementation
- Port `lib/content.ts` and `lib/cms/` to `src/lib/` with Zod validation contracts.
- Implement `src/pages/index.astro` (Home).
- Implement `src/pages/blog/index.astro`, `src/pages/blog/[...slug].astro`, and pagination routes `src/pages/blog/page/[page].astro`.
- Implement `src/pages/tags/index.astro`, `src/pages/tags/[tag]/index.astro`.
- Implement `src/pages/projects/index.astro` and `src/pages/about/index.astro`.

#### Phase 4: Component Conversion & Islands Boundary
- Static components (`Header.astro`, `Footer.astro`, `Card.astro`, `Tag.astro`, `SectionContainer.astro`, `TableWrapper.astro`) migrated to `.astro`.
- Interactive components migrated to Preact islands:
  - `ThemeSwitch.tsx` (`client:load`) wired to `themeStore`.
  - `MobileNav.tsx` (`client:idle`) wired to `navStore`.
  - `SearchModal.tsx` (`client:idle`) wired to `isSearchOpenStore` with `Cmd+K`.
  - `Comments.tsx` (`client:visible`).
  - `ScrollTopAndComment.tsx` (`client:visible`).
  - `BlogFilterList.tsx` (`client:idle`) client-side search filtering.
- Port `PortableTextRenderer.tsx` as server-only Preact component (Zero Client JS).

#### Phase 5: API Routes & SSR Endpoints
- Migrate newsletter endpoint to `src/pages/api/newsletter.ts` with WHATWG `Request`/`Response`.
- Migrate revalidation endpoint to `src/pages/api/revalidate.ts` with WinterTC Web Crypto HMAC-SHA256.

---

### 7. Formal Verification Matrix (`/autogenerated-tests/`)

| Test Suite / Command | Target Layer | Expected Result |
| :--- | :--- | :--- |
| `pnpm --filter tekgo-ui check` | Astro Compiler & TypeScript | 0 diagnostic errors |
| `pnpm --filter tekgo-ui build` | Production Build & Static Generation | Outputs `dist/client` and `dist/server` |
| `bun test autogenerated-tests/tekgo-ui-migration.test.ts` | Routing, Content Layer & API Endpoints | 100% pass rate |

---

### 8. Risk & Rollback Mitigations

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Preact React Compatibility** | Syntax or hook incompatibilities with external packages | `preact({ compat: true })` aliases `react` and `react-dom` seamlessly. |
| **Theme Flicker on Load** | Unpleasant visual flash before hydration | Execute inline zero-dependency IIFE in `<head>` before body render. |
| **Monorepo Build Pipeline Failure** | Turborepo pipeline blockage | Verify `outputs: ["dist/**"]` in `turbo.json` maps cleanly to Astro's build output. |
