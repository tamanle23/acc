# Walkthrough 63: Phase 2 Public Landing Page & Self-Service Onboarding Funnel

## Executive Summary
This document records the full-stack implementation of **Phase 2 of the Domain Blueprints Ecosystem**:
1. **Public Root Route (`/`) & Auth Bypass**:
   - Implemented `src/routes/index.tsx` using TanStack Router.
   - Enforced authentication bypass: authenticated users are automatically redirected to `/_authenticated/metadata/`.
   - Updated `ROUTE.md` route registry matrix.
2. **Liquid Glass Marketing Header & Navbar**:
   - `LandingNavbar`: sticky frosted header (`backdrop-blur-2xl bg-white/70 dark:bg-slate-900/75`), brand logo, anchor links, theme switch, and dual action buttons.
3. **Hero Section (`LandingHero`)**:
   - Prominent headline *"Nền Tảng Quản Trị Dữ Liệu Động & Metadata Đa Khách Hàng"*.
   - Architectural metric cards: Zero Downtime, Pattern C Graph, Postgres RLS, and Sub-250ms Seeding.
4. **Interactive Studio Preview (`LandingShowcase`)**:
   - Live 3-column studio preview simulating dynamic schema definitions, auto-generated reactive forms, and Pattern C graph edges for Articles, Vehicles, and Invoices.
5. **Architectural Bento Grid (`LandingBentoGrid`)**:
   - 6 high-affordance cards highlighting runtime dynamic schemas, graph adjacency list relations, hard multi-tenant RLS, domain blueprints catalog, GDPR Article 17 erasure with SHA-256 receipts, and Noisy Neighbor defense.
6. **Transparent Subscription & Pricing Section (`LandingPricing`)**:
   - Monthly vs. Yearly cadence toggle (-20% 2 months free badge on annual).
   - 3 transparent tiers:
     - **🆓 Basic (Cơ bản)**: Free | 1 User | Unlimited Records.
     - **⚡ Pro (Chuyên nghiệp)**: 199,000 VND / month (1,990,000 VND / year) | Up to 5 Users | Unlimited Records | Schema Studio & Pattern C Graph.
     - **👑 Pro Max (Doanh nghiệp)**: 499,000 VND / month (4,990,000 VND / year) | Unlimited Users | AI Agent MCP Server.
7. **Landing Domain Blueprints Showcase (`LandingBlueprintsSection`)**:
   - Directly displays the catalog of pre-modeled templates with preview triggers opening the `TemplatePreviewModal`.
8. **2-Step Onboarding Funnel Modal (`OnboardingFunnelModal`)**:
   - Step 1: Administrator name, corporate email, organization / workspace name (auto-generating tenant slug).
   - Step 2: Interactive Blueprint Carousel selector.
   - On submit: provisions the selected blueprint in $< 250\text{ ms}$, issues authenticated JWT tokens, sets active tenant context in store, and seamlessly transitions user directly into `/_authenticated/metadata/`.

---

## Verification & Quality Assurance
1. **Frontend Typecheck**:
   - `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
2. **Frontend Vitest Unit Tests**:
   - `pnpm --filter @acc/console test`: 14 test suites, 79 unit tests passed cleanly.
