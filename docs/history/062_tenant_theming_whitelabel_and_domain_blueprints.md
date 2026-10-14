# History Entry 062: White-Labeling & Dynamic Tenant Theming and Domain Blueprint Seeding Engine (Phase 23)

## Problem Statement
Enterprises utilizing the UniPost platform require:
1. **Dynamic White-Labeling & Theming**: Instant recoloring of brand palettes (primary, accent, ring, glass scrim tint, border radius) based on tenant configuration without requiring page reload or separate bundle deployments, while upholding strict WCAG 2.2 AA accessibility contrast standards.
2. **Domain Blueprint Seeding Engine**: Ready-to-deploy, transactionally compiled domain models for verticals such as Healthcare Records (patients, clinical encounter notes, prescriptions) and Real Estate MLS (property listings, agents, tour schedules), complementing existing CMS, B2B CRM, and Fleet Logistics catalogs.

## Proposed Plan
1. **Define Enterprise Theming Model in `@unipost/tokens`**:
   - Introduce `TenantThemeConfig` interface (brandName, logoUrl, primaryColor, primaryForeground, accentColor, ringColor, glassScrimTint, borderRadius, fontFamily).
   - Implement `defaultTenantThemes` catalog with pre-configured themes:
     - `tenant-acme`: Neutral corporate glass.
     - `tenant-healthcare`: Emerald medical green (`#059669`).
     - `tenant-realestate`: Royal violet luxury real estate (`#7C3AED`).
     - `tenant-fleet`: High-visibility amber orange (`#EA580C`).
   - Implement `applyTenantThemeOverrides(theme, targetElement)` modifying `:root` CSS custom variables dynamically without page reloads.
2. **Wire Dynamic Theming into `@unipost/console`**:
   - In `apps/console/src/features/metadata/store/use-metadata-ui-store.ts`, update `setActiveTenant` to automatically inject CSS variable overrides corresponding to the active tenant.
3. **Backend & Frontend Domain Blueprints**:
   - Provision `healthcare-records-blueprint.json` and `real-estate-mls-blueprint.json` in `apps/backend/unipost-fw/src/main/resources/metadata/blueprints/`.
   - Update `apps/console/src/features/metadata/data/mock-blueprints.ts` and `blueprint-card.tsx` to display Healthcare and Real Estate manifests with their respective Lucide icons (`HeartPulse`, `Home`).
4. **Testing & Verification**:
   - Unit tests in `@unipost/tokens` verifying token contracts, WCAG contrast compliance, and `applyTenantThemeOverrides`.
   - Unit tests in `@unipost/console/src/features/metadata/__tests__/tenant-blueprints-and-theming.test.ts` verifying manifest catalog inclusion, summary mapping, and store theme injection.

## Changes Made
- `packages/tokens/src/index.ts`: Added `TenantThemeConfig`, `defaultTenantThemes`, and `applyTenantThemeOverrides`.
- `packages/tokens/src/index.test.ts`: Added test coverage for theme overrides and preset validation.
- `apps/console/src/features/metadata/store/use-metadata-ui-store.ts`: Wired `applyTenantThemeOverrides` inside `setActiveTenant`.
- `apps/backend/unipost-fw/src/main/resources/metadata/blueprints/healthcare-records-blueprint.json`: Added complete Healthcare blueprint with entities, attributes, and relationships.
- `apps/backend/unipost-fw/src/main/resources/metadata/blueprints/real-estate-mls-blueprint.json`: Added Real Estate MLS blueprint with entities, attributes, and relationships.
- `apps/console/src/features/metadata/data/mock-blueprints.ts`: Synchronized frontend mock manifests with Healthcare and Real Estate blueprints.
- `apps/console/src/features/metadata/components/blueprint-gallery/blueprint-card.tsx`: Added `HeartPulse` and `Home` Lucide icons.
- `apps/console/src/features/metadata/__tests__/tenant-blueprints-and-theming.test.ts`: Added unit test suite covering blueprint manifests and store theming.

## Verification
- `pnpm --filter @unipost/tokens test`: Passed (5/5 tests).
- `pnpm --filter @unipost/tokens check-types`: Passed with no errors.
- `pnpm --filter @unipost/console exec vitest run src/features/metadata/__tests__/tenant-blueprints-and-theming.test.ts`: Passed (3/3 tests).

## Tasks Completed
- [x] Pluggable domain blueprint catalog with Healthcare and Real Estate MLS manifests.
- [x] Dynamic brand color palettes and CSS variable injection without page reload.
- [x] Synchronized console gallery icons and mock manifests.
- [x] Multi-tier unit test verification.
