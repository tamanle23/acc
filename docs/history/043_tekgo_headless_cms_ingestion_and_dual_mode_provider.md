# 043: tekgo-ui Headless CMS Ingestion & Dual-Mode Provider (Phase 8)

## Problem
`tekgo-ui` was decoupled from the backend metadata CMS engine and loaded static JSON files directly from the filesystem. To enable live public consumption of published content created in Console and Mobile without compromising build stability or offline local development, a dual-mode content architecture was required.

## Plan
1. Add `@acc/client` and `@acc/sandbox` workspace dependencies to `apps/tekgo-ui/package.json`.
2. Implement `UnipostCmsClient` in `apps/tekgo-ui/lib/cms/acc-cms-client.ts` with publishable key authentication and Next.js 15 ISR tag revalidation (`next: { tags: ['articles'], revalidate: 60 }`).
3. Build `ContentProvider` in `apps/tekgo-ui/lib/cms/content-provider.ts` to map dynamic `EntityRecord` models to `Blog` instances with dual-mode support (`DATA_SOURCE=cms | local`) and resilient fallbacks.
4. Refactor `tekgo-ui` routes (`app/page.tsx`, `app/blog/**`, `app/tags/**`) to asynchronously query `contentProvider`.
5. Verify via Next.js production build (`pnpm --filter tekgo-ui build`).

## Changes
- `apps/tekgo-ui/package.json`: Added workspace dependencies `@acc/client` and `@acc/sandbox`.
- `apps/tekgo-ui/lib/cms/acc-cms-client.ts`: Headless CMS client with publishable key authentication and sandbox fallback.
- `apps/tekgo-ui/lib/cms/content-provider.ts`: Dual-mode provider with `mapRecordToBlog`, `getAllBlogs`, `getBlogBySlug`, and `getTagData`.
- `apps/tekgo-ui/app/page.tsx`: Updated to query `contentProvider.getAllBlogs()`.
- `apps/tekgo-ui/app/blog/page.tsx`: Updated to query `contentProvider.getAllBlogs()`.
- `apps/tekgo-ui/app/blog/[...slug]/page.tsx`: Updated `generateMetadata`, `generateStaticParams`, and default export to use `contentProvider`.
- `apps/tekgo-ui/app/blog/page/[page]/page.tsx`: Updated pagination params and post slices using `contentProvider`.
- `apps/tekgo-ui/app/tags/page.tsx`: Updated tag summary with `contentProvider.getTagData()`.
- `apps/tekgo-ui/app/tags/[tag]/page.tsx`: Updated tag details and static params with `contentProvider`.
- `apps/tekgo-ui/app/tags/[tag]/page/[page]/page.tsx`: Updated paginated tag routes with `contentProvider`.

## Verification
- `pnpm --filter tekgo-ui build`: Success (94 static pages compiled with Next.js 15.5.12).
- `pnpm --filter @acc/client test`: 6/6 passed.
- `pnpm --filter @acc/sandbox test`: 5/5 passed.

## Tasks
- [x] Link `@acc/client` and `@acc/sandbox` to `tekgo-ui`
- [x] Create `UnipostCmsClient` with Next.js 15 cache tags and publishable key protocol
- [x] Create `ContentProvider` with `DATA_SOURCE=cms|local` dual-mode support
- [x] Refactor all blog and tag routes in `tekgo-ui`
- [x] Verify Next.js production build

## Enhancement
Phase 9 will implement HMAC-signed webhooks in `acc-ms-worker` and an edge revalidation endpoint (`/api/revalidate`) in `tekgo-ui` for sub-second cache invalidation upon article publication.
