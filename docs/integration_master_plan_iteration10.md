# Master Plan: Dual-Mode Live E2E Pipeline, Client Dataset Parity & Cross-Client Alignment (Iteration 10)

## 1. Goal Description & Executive Context
Iteration 8 and 9 established the **Backend Unified Sandbox Platform** (`acc-sandbox`), zero-database persona JWT minting, chunked JDBC CMS scaffolding (1,000+ Articles, 50 Categories, 200 Media Assets), root monorepo scripts, and the authoritative 360° documentation guide.

**Iteration 10** establishes the complete convergence across the entire monorepo ecosystem:
1. **Pillar 1: End-to-End Live Verification Pipeline (`pnpm test:e2e:live`)**:
   - Harden Playwright Mode 2 (`E2E_MODE=live`) so that Vite runs with `--no-sandbox` (`import.meta.env.VITE_ENABLE_SANDBOX=false`), proxying genuine HTTP calls directly to `acc-ms-aio` on port 8000.
   - Verify that all 15 Golden Journeys (Auth personas, schema studio, composite records, OCC audit ledger, DAG workflows, DLQ, billing) succeed when executing against real Spring Boot controllers and embedded PostgreSQL with Row-Level Security (RLS).
2. **Pillar 2: High-Volume CMS Data Parity across Console Offline Mocks**:
   - Synchronize `packages/sandbox` and `apps/console/src/features/metadata/data/mock-catalog-data.ts` so that offline Mode 1 also exposes the Headless CMS & Digital Publishing schema (`ent_cms_article`, `ent_cms_category`, `ent_cms_media_asset`) and 1,000+ realistic articles.
   - Guarantee 100% visual and structural parity whether running offline or connected to the live backend sandbox.
3. **Pillar 3: Cross-Client Sandbox Alignment (`tekgo-ui` & `mobile-ui`)**:
   - Ensure `@acc/sandbox` contracts are imported and consumed across `apps/tekgo-ui` (Next.js 15 / React 19) and `apps/mobile-ui` (Expo SDK 57 / React Native 0.86).
   - Wire standard persona bypass and VietQR billing simulator integration in both client applications.

---

## 2. System Architecture & Dual-Mode Flow

```
                                  ┌──────────────────────────────┐
                                  │      Playwright Runner       │
                                  │  `pnpm test:e2e` (Mode 1)    │
                                  │  `pnpm test:e2e:live` (Mode 2│
                                  └──────────────┬───────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        ▼                                                 ▼
            [Mode 1: Autonomous Mock]                         [Mode 2: Live Backend Sandbox]
       Vite: `VITE_ENABLE_SANDBOX=true`                     Vite: `VITE_ENABLE_SANDBOX=false`
    ─────────────────────────────────────────            ─────────────────────────────────────────
    • Handlers: `@acc/sandbox` In-Browser            • Proxy: Reverse proxy `/api` -> 8000
    • Storage: Client In-Memory (Zustand)                • Backend: `acc-ms-aio` (Port 8000)
    • Seed: `mock-catalog-data.ts` (1,000 CMS items)     • Database: Embedded PGlite (`tmp/db/pglite-sandbox`)
    • External APIs: Simulated In-Memory                 • RLS: Authentic PostgreSQL `SET LOCAL app.current_tenant_id`
    • Persona: Pure Client JWT Generation                • Persona: Spring `SandboxTokenAspect` AOP JWT Minting
```

---

## 3. Four-Phase Execution Breakdown

### Phase 1: Console Client Offline Data Parity (CMS Schema & Records)
1. **Unified Sandbox Integration & Blueprint Seeding**:
   - Register CMS schema pre-seeding into `packages/sandbox` and `apps/console/src/core/sandbox/handlers/metadata-sandbox-adapter.ts`.
   - Ensure `mockMetadataStore` in `mock-metadata.ts` registers a `reset()` callback with `sandboxResetRegistry` in `packages/sandbox/src/reset-registry.ts` so resetting from `SandboxDock` reinstantiates both CRM and CMS datasets.
   - Pre-warm `bp_cms_publishing_v1` by default for `tenant-acme` alongside B2B CRM.
2. **Schema & Model Definitions in `mock-catalog-data.ts` & `mock-metadata.ts`**:
   - Add EntityTypes `ent_cms_article` (id: `cms-article`), `ent_cms_category` (id: `cms-category`), and `ent_cms_media_asset` (id: `cms-media`) with full attribute definitions (title, slug, summary, body_content, status, featured_flag, published_at, category_name, color_code, file_name, storage_url, mime_type, file_size_bytes).
   - Add RelationshipTypes `rel_article_to_category` (MANY_TO_ONE) and `rel_article_featured_media` (MANY_TO_ONE).
3. **High-Volume Procedural Generation (1,000 Articles, 50 Categories, 200 Media Assets)**:
   - Generate realistic articles with Markdown bodies, publication timestamps, and diverse editorial statuses (`PUBLISHED`, `DRAFT`, `IN_REVIEW`, `SCHEDULED`, `ARCHIVED`).
   - Create 2,000 relational graph edges in `initialMockRelationships` linking articles to categories and media assets.
4. **Verification & Hard-Gating**:
   - Run `pnpm --filter @acc/console test:coverage` to ensure all tests pass and coverage satisfies the $\ge 90\%$ threshold.

---

### Phase 2: Live Backend E2E Pipeline Hardening (`test:e2e:live`)
1. **Automated Backend Pre-Flight in `playwright.config.ts`**:
   - Enhance `global-setup.ts` to support optional auto-spawn of `@acc/backend` via `dev:sandbox` when offline, or provide crystal-clear diagnostic instructions if port 8000 is not reachable within 5 seconds.
2. **Controller & Endpoint Alignment for Live E2E**:
   - Verify `/api/auth/token`, `/api/v1/metadata/entity-types`, `/api/v1/metadata/entity-types/{id}/records`, `/api/v1/billing/checkout`, and `/system/tenants` behave identically under Mode 2 as in Mode 1.
   - Ensure CORS and proxy routing (`/api` -> `http://localhost:8000`) in `apps/console/vite.config.ts` pass all authentication and tenant headers (`X-Tenant-Id`, `Authorization`, `clientType`).
3. **Execute Mode 2 Golden Journey Suite**:
   - Run `pnpm test:e2e:live` across all 15 test specs and verify 100% pass rate with zero WCAG 2.2 AA accessibility violations.

---

### Phase 3: Sibling Client Sandbox Alignment (`apps/tekgo-ui` & `apps/mobile-ui`)
1. **`tekgo-ui` (Next.js 15) Sandbox Hookup**:
   - Wire `@acc/sandbox` route interceptors in Next.js development server middleware.
   - Consume pre-warmed CMS editorial articles (`ent_cms_article`) directly from the backend sandbox via `@acc/client`.
2. **`mobile-ui` (Expo SDK 57) Sandbox Hookup**:
   - Connect `@acc/sandbox` persona switching dropdown in the mobile navigation drawer.
   - Ensure mobile VietQR payment modal connects to simulated PayOS confirmation flow.
3. **Lint & Typecheck Verification**:
   - `pnpm --filter tekgo-ui check-types`
   - `pnpm --filter mobile-ui test`

---

### Phase 4: CI/CD Pipeline & Monorepo Hard-Gating
1. **GitHub Actions Workflow Integration**:
   - Add `e2e-live` job to `.github/workflows/` utilizing the new root script `pnpm test:e2e:live`.
2. **Comprehensive Verification & Documentation**:
   - Create history log `docs/history/140_*.md` and update `docs/history/README.md`.
   - Commit cleanly via Conventional Commits.

---

## 4. Verification Plan

### Automated Commands
```powershell
# 1. Verify Console Offline Mocks & CMS Data Parity
pnpm --filter @acc/console test

# 2. Verify Backend Sandbox Suite
pnpm --filter @acc/backend test:sandbox

# 3. Verify Spring Modulith Architecture
pnpm --filter @acc/backend test:modulith

# 4. Verify Mode 1 Playwright E2E Tests (Autonomous Mocks)
pnpm test:e2e

# 5. Verify Mode 2 Playwright Live E2E Tests (Real Backend + PostgreSQL RLS)
# In terminal 1:
pnpm dev:backend:sandbox
# In terminal 2:
pnpm test:e2e:live
```
