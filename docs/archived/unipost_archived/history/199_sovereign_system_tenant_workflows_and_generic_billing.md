# History Entry 199: SYSTEM Sovereign Tenant Workflows & Provider-Agnostic Billing Architecture

## 1. Problem
[`docs/master_database_schema_architecture.md`](../master_database_schema_architecture.md) required two major strategic enhancements:
1. **Sovereign `SYSTEM` Tenant & Custody Workflows**: The architecture needed a comprehensive specification of how the root custodian interacts with the persistence tier, specifically resolving the PostgreSQL RLS Write Paradox and documenting the 4 mission-critical custodial workflows:
   - Canonical Blueprint Authoring & Publishing.
   - Dual-Context Ephemeral Impersonation (`Assume-Tenant`).
   - Fleet Resource Quota Overrides (Infinity Quotas).
   - Sovereign Audit Recovery & Version Restoration.
2. **Provider-Agnostic Payment & Billing Architecture**: `UNIPOST_TENANT_BILLING` previously contained vendor-specific columns (`payos_customer_id`), locking the persistence schema to a single gateway. The system requires support for multiple payment providers (payOS, Stripe, PayPal, VNPay, MoMo, or Wire Invoicing) without breaking changes or DDL alterations.

## 2. Plan
1. **Generic Multi-Gateway Schema**:
   - Refactor `UNIPOST_TENANT_BILLING` to replace hardcoded vendor columns with:
     - `payment_provider VARCHAR(50)` (e.g., `PAYOS`, `STRIPE`, `VNPAY`).
     - `provider_customer_ref VARCHAR(255)` (generic customer identifier).
     - `current_order_ref VARCHAR(255)` (generic order/intent reference).
     - `currency VARCHAR(10)` (ISO 4217).
     - `billing_metadata JSONB` (extensible gateway payloads: QR strings, payment link IDs, card brand/last4, webhook metadata).
   - Document the Strategy & Adapter pattern for payment gateway services.
2. **Deep-Dive Section 4 on `SYSTEM` Sovereign Tenant**:
   - Formally document the resolution of the PostgreSQL RLS Write Paradox via the Dual-Scope Sovereign Custodian policy pattern.
   - Detail the 4 core custodial operational workflows with sequence and flow diagrams.
   - Clean up duplicate and redundant subsection numbering in Section 3.3.

## 3. Changes
- **Primary Architecture Reference**:
  - Refactored Table 10 in Section 3.2 of [`docs/master_database_schema_architecture.md`](../master_database_schema_architecture.md) to multi-gateway generic payment schema with JSONB metadata.
  - Added class diagram for `PaymentGatewayService` and adapters (`PayOsGatewayAdapter`, `StripeGatewayAdapter`, `VnPayGatewayAdapter`).
  - Rewrote Section 4: *Multi-Tenant Engine & Sovereign `SYSTEM` Tenant Workflows* with detailed subsections 4.1 (RLS Write Paradox Resolution) and 4.2 (The 4 Sovereign Workflows with sequence and flowchart diagrams).
  - Cleaned up Section 3.3 numbering and removed redundant assume-tenant duplicate text.

## 4. Verification
- Backend compile: `./mvnw test-compile -q` PASSED.
- Console typecheck: `pnpm --filter @acc/console exec tsc --noEmit` exited with code 0 (zero errors).
- Validated all Mermaid diagrams for syntax and rendering correctness.

## 5. Walkthrough
Refer to Section 3.2 (Table 10) and Section 4 of [`docs/master_database_schema_architecture.md`](../master_database_schema_architecture.md).
