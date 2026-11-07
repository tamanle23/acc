# Route & Screen Architecture: Tekgo UI (`tekgo-ui`)
> **Routing Engine:** Astro 5 Hybrid/SSR Router (`src/pages/`)  
> **Layout Shell:** Base Layout with Liquid Glass Header (`src/layouts/BaseLayout.astro`)  
> **Islands Engine:** Preact (`@astrojs/preact` with `compat: true`)  
> **Status:** Living Document & Foundation Specification

---

## 1. Routing Engine & Directory Architecture

### 1.1 Overview
`tekgo-ui` is built on **Astro 5** using file-system routing under `src/pages/`. All views share a base layout (`src/layouts/BaseLayout.astro`) featuring a sticky frosted glass navigation bar, responsive content container, and footer. Minimal client JavaScript is hydrated via isolated Preact islands (`client:*`).

### 1.2 Route Tree Hierarchy

```
tekgo-ui/src/pages/
├── 404.astro                                   # 404 Glass Error View
├── index.astro                                 # Route: "/" (Home / Featured Feed)
├── search.json.ts                              # API Route: "/search.json" (Search index)
├── about/
│   └── index.astro                             # Route: "/about" (Author profile & bio)
├── blog/
│   ├── index.astro                             # Route: "/blog" (Blog index page 1)
│   ├── page/[page].astro                       # Route: "/blog/page/:page" (Paginated archives)
│   └── [...slug].astro                         # Route: "/blog/*" (Article reader & nested posts)
├── tags/
│   ├── index.astro                             # Route: "/tags" (Taxonomy catalog)
│   └── [tag]/
│       ├── index.astro                         # Route: "/tags/:tag" (Tag-filtered articles)
│       └── page/[page].astro                   # Route: "/tags/:tag/page/:page" (Paginated tag articles)
├── projects/
│   └── index.astro                             # Route: "/projects" (Showcase card grid)
└── api/
    ├── newsletter.ts                           # API Endpoint: "/api/newsletter" (Subscription handler)
    └── revalidate.ts                           # API Endpoint: "/api/revalidate" (HMAC edge invalidation)
```

---

## 2. Screen & Route Registry Matrix

| Route Path | File Location | Render Type | Layout Shell | Primary User Action / Feature |
| :--- | :--- | :--- | :--- | :--- |
| `/` | `src/pages/index.astro` | SSR | `BaseLayout.astro` | View hero greeting, read latest articles, subscribe to newsletter |
| `/blog` | `src/pages/blog/index.astro` | SSR | `BaseLayout.astro` | Search articles by keyword (`BlogFilterList` island), browse posts |
| `/blog/page/[page]` | `src/pages/blog/page/[page].astro` | SSR | `BaseLayout.astro` | Browse historical article archives by page number |
| `/blog/[...slug]` | `src/pages/blog/[...slug].astro` | SSR | `PostLayout.astro` | Read long-form article (0 KB client JS prose), comments island |
| `/tags` | `src/pages/tags/index.astro` | SSR | `BaseLayout.astro` | Browse topic tags with post frequency counters |
| `/tags/[tag]` | `src/pages/tags/[tag]/index.astro` | SSR | `BaseLayout.astro` | View all posts associated with a specific topic tag |
| `/projects` | `src/pages/projects/index.astro` | SSR | `BaseLayout.astro` | Browse portfolio cards with live demo and GitHub repository links |
| `/about` | `src/pages/about/index.astro` | SSR | `AuthorLayout.astro` | View author biography, credentials, and social links |
| `/search.json` | `src/pages/search.json.ts` | Endpoint | None | Provides JSON search index for `SearchModal.tsx` |
| `/api/newsletter` | `src/pages/api/newsletter.ts` | Endpoint | None | Handle email newsletter subscription submissions |
| `/api/revalidate` | `src/pages/api/revalidate.ts` | Endpoint | None | Handle HMAC-SHA256 cache invalidation webhooks |

---

## 3. Hydration Islands & Interactive Boundaries

| Component | Location | Directive | State / Store | Role |
| :--- | :--- | :--- | :--- | :--- |
| `ThemeSwitch` | `src/components/ThemeSwitch.tsx` | `client:load` | `themeStore` | System/Dark/Light theme switcher with anti-FOUC |
| `MobileNav` | `src/components/MobileNav.tsx` | `client:idle` | `isNavOpenStore` | Hamburger button & frosted mobile drawer |
| `SearchButton` | `src/components/SearchButton.tsx` | `client:idle` | `isSearchOpenStore` | Header search trigger |
| `SearchModal` | `src/components/SearchModal.tsx` | `client:idle` | `isSearchOpenStore` | Cmd+K Command palette search dialog |
| `BlogFilterList` | `src/components/BlogFilterList.tsx` | `client:idle` | Preact `useState` | Real-time title/tag filtering on `/blog` |
| `ScrollTopAndComment`| `src/components/ScrollTopAndComment.tsx` | `client:visible` | Preact `useState` | Floating smooth scroll & comment jump buttons |
| `Comments` | `src/components/Comments.tsx` | `client:visible` | Preact `useState` | On-demand Giscus comments loader |
