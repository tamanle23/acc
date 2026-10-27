# 013: Domain Blueprints Full-Stack Phase 2 - Public Landing Page & Onboarding Funnel

## 1. Problem Statement
Previously, navigating to the root URL (`/`) immediately assumed an authenticated context or forced raw sign-in screens. Unauthenticated visitors had no interface to:
- Discover Acc's dynamic metadata engine value propositions.
- Inspect transparent subscription pricing tiers (Basic Free, Pro 199k, Pro Max 499k).
- Browse industry blueprints and test drive interactive studio capabilities before registering.
- Complete a streamlined, 2-step onboarding funnel that registers an organization, selects a domain template, and initializes an operational workspace.

## 2. Changes Made
1. **Public Route Architecture (`src/routes/index.tsx`)**:
   - Implemented root `/` route using TanStack Router with `beforeLoad` auth bypass: authenticated users are automatically redirected to `/_authenticated/metadata/`.
   - Updated `ROUTE.md` Route Registry Matrix.
2. **Liquid Glass Landing Components (`src/features/landing/components/`)**:
   - `landing-navbar.tsx`: Frosted sticky header with brand logo, nav links, and CTA buttons.
   - `landing-hero.tsx`: Headline, value proposition, and architectural telemetry chips.
   - `landing-showcase.tsx`: Interactive 3-column studio preview showing dynamic schema definitions, auto-generated reactive forms, and Pattern C graph edges across CMS, Logistics, and CRM domains.
   - `landing-bento-grid.tsx`: 6 core architectural pillars (Zero-Downtime, Pattern C Graph, PostgreSQL RLS, Domain Blueprints, GDPR Art. 17, and Noisy Neighbor Guard).
   - `landing-pricing.tsx`: Monthly/Yearly toggle (-20% annual discount) and 3 transparent pricing cards.
   - `landing-blueprints-section.tsx`: Direct catalog showcase with preview modal triggers.
   - `landing-footer.tsx`: Standard legal and payment compliance footer.
3. **2-Step Onboarding Funnel Modal (`onboarding-funnel-modal.tsx`)**:
   - Step 1: User credentials & organization name (auto-generating tenant slug).
   - Step 2: Interactive Blueprint Carousel with preview inspection.
   - Auto-provisions blueprint, hydrates JWT tokens and tenant store context, and redirects into the workspace.
4. **Main Container & Unit Tests**:
   - Created `src/features/landing/index.tsx`.
   - Created `src/features/landing/landing.test.tsx` verifying hero rendering, pricing cadence toggle, and plan selection callbacks.

## 3. Verification
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
- `pnpm --filter @acc/console test`: 14 suites, 79 tests passed.

## 4. Key Artifacts
- Plan: `apps/console/doc/implementation_plan_62.md`
- Walkthrough: `apps/console/doc/walkthrough_63.md`
