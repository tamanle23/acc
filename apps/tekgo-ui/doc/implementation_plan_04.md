# Implementation Plan - tekgo-ui Headless CMS Ingestion & Dual-Mode Provider (Phase 8)

## Problem Statement
`tekgo-ui` (Next.js 15) previously relied strictly on static filesystem JSON files for blog posts, preventing it from consuming live articles authored dynamically in `@acc/console` or `mobile-ui` via the Backend Public Ingestion Gateway.

## Architecture & Implementation Overview
1. **Unipost CMS Client (`apps/tekgo-ui/lib/cms/acc-cms-client.ts`)**:
   - Integrates `@acc/client` (`UnipostClient`) with Next.js 15 ISR revalidation tags (`next: { tags: ['articles'], revalidate: 60 }`).
   - Authenticates using scoped publishable key via header `X-Publishable-Key: pk_live_{tenantId}_{token}`.
   - Intercepts requests in development through `@acc/sandbox` (`sandboxRegistry`) for offline/simulation workflows.
2. **Dual-Mode Content Provider (`apps/tekgo-ui/lib/cms/content-provider.ts`)**:
   - Supports `DATA_SOURCE=cms | local` toggle.
   - `mapRecordToBlog`: Maps dynamic `EntityRecord` attributes (title, summary, tags, portableTextBody, slug, updatedDate) into the Next.js `Blog` interface.
   - Provides `getAllBlogs()`, `getBlogBySlug()`, and `getTagData()` with seamless fallback to local files if the live gateway is unreachable.
3. **Route Integration**:
   - Refactored `apps/tekgo-ui/app/page.tsx`, `apps/tekgo-ui/app/blog/page.tsx`, `apps/tekgo-ui/app/blog/[...slug]/page.tsx`, `apps/tekgo-ui/app/blog/page/[page]/page.tsx`, `apps/tekgo-ui/app/tags/page.tsx`, `apps/tekgo-ui/app/tags/[tag]/page.tsx`, and `apps/tekgo-ui/app/tags/[tag]/page/[page]/page.tsx` to asynchronously consume `contentProvider`.
   - Updated `generateStaticParams` and metadata generators for Next.js 15 Server Components and SSG.

## Verification
- `pnpm --filter tekgo-ui build`: Next.js 15 SSG production build succeeded with 94 static pages generated and zero type errors.
- Package tests (`@acc/client`, `@acc/sandbox`) and backend tests remain green.
