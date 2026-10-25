# Implementation Plan - UI Wiring for Phase 7 (Quotas & ReDoS Defense) & Phase 8 (Data Lifecycle & GDPR Purge)

Integrate backend Phase 7 (Rate Limiting, Schema/Attribute Quotas, ReDoS validation) and Phase 8 (Streaming Export & GDPR Hard-Purge) directly into `@acc/console`.

## User Review Required

> [!NOTE]
> - **Settings Data & Privacy Panel**: Added under Settings (`/settings/data-privacy`) with:
>   - **1-Click Export Archive**: Downloads full tenant data ZIP (`tenant_export_{id}_{timestamp}.zip`).
>   - **GDPR Article 17 Hard-Purge Danger Zone**: Destructive modal requiring typing the tenant ID, executing `POST /api/v1/metadata/tenants/{tenantId}/purge`, and displaying the cryptographic `CertificateOfErasure` (SHA-256 hash) upon completion.
> - **Schema Quotas & ReDoS Prevention in Schema Studio**:
>   - **Model Limit Indicator**: Visual capacity meter (`X / 50 Models`) on `EntityTypeSidebar`. Disables "+ New" when cap is reached.
>   - **Attribute Limit Indicator**: Visual capacity meter (`Y / 100 Attributes`) on `SchemaBuilder`. Disables "Add Field" when cap is reached.
>   - **Pre-flight ReDoS Regex Guard**: Validates regex patterns in `AttributeDialog`, rejecting catastrophic nested quantifiers (e.g. `(a+)+`, `([a-zA-Z]+)*`) with real-time UI warnings before submitting.
> - **Global HTTP 429 Interceptor**:
>   - Catches HTTP 429 status in `handleServerError` and Axios handlers, parsing `Retry-After` headers and surfacing a countdown notice.

---

## Proposed Changes

### 1. Settings Route & Navigation
- **Add Settings Subroute**: `apps/console/src/routes/_authenticated/settings/data-privacy.tsx`.
- **Add Nav Item**: Update `apps/console/src/features/settings/index.tsx` sidebar items with `Data & Privacy` (`/settings/data-privacy`, icon `<ShieldAlert size={18} />`).

### 2. Data & Privacy Component (`apps/console/src/features/settings/data-privacy/`)
- `data-privacy-panel.tsx`:
  - **Data Portability Section**: Explains GDPR Article 20, shows summary of tenant data, and provides an "Export Complete Archive (.ZIP)" button.
  - **GDPR Article 17 Erasure Section**: Red-tinted frosted glass Danger Zone card with "Initiate Erasure" button.
  - **`PurgeConfirmationDialog`**: Requires user confirmation typing the tenant ID, calls `POST /api/v1/metadata/tenants/{tenantId}/purge`, and renders the returned `CertificateOfErasure` (with certificate ID, SHA-256 hash, and deletion counts).

### 3. Schema Studio Quota & ReDoS Protections
- **`apps/console/src/features/metadata/components/entity-type/entity-type-sidebar.tsx`**:
  - Show quota badge `X / 50 Models`.
  - Disable "+ New" button with tooltip if model count $\ge 50$.
- **`apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx`**:
  - Show quota badge `Y / 100 Attributes`.
  - Disable "Add Field" button with tooltip if attribute count $\ge 100$.
- **`apps/console/src/features/metadata/components/schema-builder/attribute-dialog.tsx`**:
  - Add client-side static analysis matching dangerous nested quantifiers `(\(.*[+*]\)[+*]|\([a-zA-Z0-9_\[\]|-]+[+*]\)[+*])`.
  - Render an alert banner if a dangerous regex is detected and block form submission.

### 4. Global HTTP 429 Rate-Limit Interceptor
- **`apps/console/src/lib/handle-server-error.ts`**:
  - Detect `error.response?.status === 429`.
  - Extract `Retry-After` header and display a specialized sonner toast: `"Rate limit exceeded. Please wait X seconds before retrying."`

---

## Verification Plan

### Automated & Build Verification
1. Run TypeScript check & build: `pnpm --filter @acc/console check-types` and `pnpm --filter @acc/console build`.
2. Unit tests for ReDoS static analysis and quota checks.
3. Test Settings navigation and render in `@acc/console`.
