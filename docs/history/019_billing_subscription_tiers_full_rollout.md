# 019 — Billing & Subscription Tiers: Full-Stack Rollout (Phases 1–6)

## Problem
Unipost lacked a subscription billing system. There were no defined pricing tiers, no backend entitlement enforcement, no sandbox mocks, no billing UI, and no settings navigation for billing or workspaces.

## Plan
Six sequential phases covering the full vertical slice from backend to tests:

| Phase | Scope |
|-------|-------|
| 1 | Backend Java/Spring — DTO enrichment, new endpoints, entitlement logic |
| 2 | Landing page — 4-tier pricing grid rewrite |
| 3 | Unified Sandbox — billing sandbox handler rewrite |
| 4 | Settings billing UI — 7 new components |
| 5 | Navigation, i18n, living docs, route tree fix |
| 6 | Test suite green, git archival |

## Subscription Tiers (Standardized)

| Key | Label | Scope | Price |
|-----|-------|-------|-------|
| `BASIC` | Basic (individual) | Personal | Free |
| `PRO` | Pro (individual) | Personal | 199,000₫/mo · 1,990,000₫/yr |
| `PRO_MAX` | Pro Max (individual) | Personal | 499,000₫/mo · 4,990,000₫/yr |
| `ENTERPRISE` | Enterprise (organization) | Org | Contact for pricing |

## Changes

### Phase 1 — Backend (`apps/backend/acc-fw`)
- **New DTOs**: `QuotaUsageDto`, `VatInvoiceDto`, `BillingTransactionDto`, `ContactSalesRequest`
- **`TenantBillingSummaryDto`**: Added `quotas`, `vatInvoice`, `history` fields
- **`DefaultTenantEntitlementService`**: Added `ENTERPRISE_FEATURES` set (`FEATURE_DEDICATED_REPLICA`, `FEATURE_ENTERPRISE_SLA`, `FEATURE_SSO_SAML`), ENTERPRISE tier handling in fallback and activation paths
- **`PayOsBillingService`**: Optional `EntityTypeRepository`/`EntityRecordRepository` deps for quota computation; in-memory VAT invoice store; enterprise sales inquiry logging; transaction history builder
- **`TenantBillingController`**: New `PUT /api/v1/billing/vat-invoice` and `POST /api/v1/billing/contact-sales` endpoints
- **Tests**: 14/14 passing (`PayOsBillingAndEntitlementsTest`, `TenantBillingControllerTest`)

### Phase 2 — Landing Page (`apps/console/src/features/landing`)
- **`landing-pricing.tsx`**: Complete rewrite — 4-tier card grid, billing cadence toggle (monthly/yearly), `onContactSales` callback, `PlanTierType` exported
- **`landing/index.tsx`**: `handleOpenSignUp` now accepts `'ENTERPRISE'` and maps to `'PRO_MAX'` for funnel modal
- **Tests**: 4/4 passing

### Phase 3 — Unified Sandbox (`apps/console/src/core/sandbox`)
- **`billing-sandbox-handler.ts`**: Full rewrite — `SandboxSubscriptionTier`, ENTERPRISE features, `GET /summary` with quotas + VAT + history, `PUT /vat-invoice`, `POST /contact-sales`, `POST /payos/webhook` prepending transaction history (stateful, resets on dock reset)
- **`use-billing.ts`**: Added `SubscriptionTier`, `QuotaUsage`, `VatInvoiceInfo`, `BillingTransaction` types; `useUpdateVatInvoice()` and `useContactEnterpriseSales()` hooks
- **Tests**: 92/92 passing

### Phase 4 — Settings Billing UI (`apps/console/src/features/settings/billing/`)
- `current-subscription-card.tsx` — plan badge, quota gauges (native Tailwind progress bars — no `@/components/ui/progress` dependency)
- `plan-pricing-selector.tsx` — 4-tier pricing grid with cadence toggle
- `billing-history-table.tsx` — VietQR transaction ledger with status badges
- `vat-invoice-form.tsx` — Vietnamese e-invoice form (company name, tax ID, address)
- `contact-enterprise-modal.tsx` — enterprise sales lead capture modal
- `sandbox-billing-dock.tsx` — DEV-only instant webhook simulation panel
- `billing-panel.tsx` — orchestrator wrapping all above inside `ContentSection`
- `index.ts` — barrel export
- `routes/_authenticated/settings/billing.tsx` — TanStack Router route file

### Phase 5 — Navigation, i18n, Living Docs
- **`settings/index.tsx`**: Added `CreditCard` import + `Billing & Subscriptions` nav item (`/settings/billing`)
- **`sidebar-data.ts`**: Added `CreditCard` import + `workspaces` + `billing` entries in settings group
- **`vi/console.json`** + **`en/console.json`**: Added `"workspaces"` and `"billing"` i18n keys
- **`ROUTE.md`**: Added `/settings/billing` row and Section 3.7 screen blueprint
- **`DESIGN.md`**: Added Section 3.6 Liquid Glass billing glass tokens

#### Bug Fix — `routeTree.gen.ts` (Settings Nav Not Showing)
TanStack Router's auto-generated `routeTree.gen.ts` was stale and missing `/settings/workspaces` and `/settings/billing`. Manually patched:
- Import block — added `AuthenticatedSettingsWorkspacesRouteImport` and `AuthenticatedSettingsBillingRouteImport`
- `const` route update declarations for both
- `FileRoutesByFullPath`, `FileRoutesByTo`, `FileRoutesById` interface entries
- `FileRouteTypes` union type literals
- `declare module '@tanstack/react-router'` augmentation blocks
- `AuthenticatedSettingsRouteRouteChildren` interface + const object

#### Other Fixes
- `current-subscription-card.tsx`: Removed nonexistent `@/components/ui/progress` import; replaced with native Tailwind HTML divs
- `create-workspace-modal.tsx`: Added `LayoutGrid` to lucide-react import (was undefined)

### Phase 6 — Test Suite Green + Git Archival
- **`settings-nav.test.tsx`**: Fixed `ResizeObserver is not defined` JSDOM crash by:
  1. `beforeAll(() => { global.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }; })`
  2. Mocking `./components/sidebar-nav` module to avoid transitive Radix `ScrollArea` deps
  3. Replaced ambiguous `getByText('Profile')` (matched `ProfileDropdown` mock too) with `getByTestId`-based assertions

## Verification
- Backend: 14/14 tests passing
- Console: **93/93 tests passing** (19 test files)
- TypeScript: `tsc` clean (no type errors)
- Routes: `/settings/workspaces` and `/settings/billing` visible in app sidebar

## Walkthrough
See `apps/console/doc/` for paired implementation plan and walkthrough artifacts.

## Tasks
- [x] Phase 1 — Backend DTO enrichment + endpoints
- [x] Phase 2 — Landing pricing page rewrite
- [x] Phase 3 — Unified sandbox handler
- [x] Phase 4 — Settings billing UI components
- [x] Phase 5 — Nav, i18n, living docs, route tree fix
- [x] Phase 6 — Tests green + git archival

## Enhancements (Future)
- Wire real payOS webhook validation (HMAC-SHA256) in production billing service
- Add Stripe fallback for international cards
- Build VAT invoice PDF export using iText/Apache FOP
- Add quota enforcement middleware (reject API calls when limit exceeded)
- Add billing email notifications (invoice issued, payment failed, trial expiring)
