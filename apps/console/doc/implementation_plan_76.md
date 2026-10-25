# Implementation Plan 76: Phase 2 - Universal Client SDK (`@acc/client`)

## 1. Overview
In accordance with `docs/brainstorming/integration_master_plan_iteration_1.md` (Phase 2), we extract typed DTOs and a universal HTTP client (`AccClient`) into a shared monorepo package `packages/client` (`@acc/client`).

## 2. Package Scope & Architecture
1. **Package Configuration**:
   - `packages/client/package.json`: Private workspace package named `@acc/client` linking to `@acc/typescript-config`.
   - `packages/client/tsconfig.json`: Extends `@acc/typescript-config/base.json`.
2. **Domain Interfaces & DTOs**:
   - `packages/client/src/types.ts`:
     - Metadata types: `DataType`, `UiComponentType`, `CardinalityType`, `EntityType`, `AttributeDefinition`, `EntityRecord`, `RelationshipType`, `EntityRelationship`, `CompiledSchema`.
     - Pagination & query: `PageResponse<T>`, `PageRequestParams`.
     - Mutations & Validation: `CreateEntityTypeDto`, `UpdateEntityTypeDto`, `CreateAttributeDefinitionDto`, `UpdateAttributeDefinitionDto`, `CreateEntityRecordDto`, `UpdateEntityRecordDto`, `CreateRelationshipTypeDto`, `UpdateRelationshipTypeDto`, `CreateEntityRelationshipDto`, `ValidationErrorDetail`, `ValidateRecordResponse`, `SchemaDriftAnalysisResponse`, `SchemaBackfillExecutionResponse`, `FacetBucketDto`, `FacetGroupDto`, `EntityFacetsResponse`.
     - Domain Blueprints: `BlueprintSummaryDto`, `BlueprintAttribute`, `BlueprintEntityType`, `BlueprintRelationship`, `BlueprintManifest`, `TenantProvisioningRequest`, `TenantProvisioningResult`.
     - Billing & Quotas: `SubscriptionTier`, `QuotaUsage`, `VatInvoiceInfo`, `BillingTransaction`, `TenantBillingSummary`, `CreatePaymentLinkPayload`, `CheckoutResponse`, `ContactSalesPayload`.
     - Problem Detail: RFC 7807 `ProblemDetail` specification.
3. **Universal HTTP Client (`AccClient`)**:
   - `packages/client/src/client.ts`:
     - Standard `fetch`-based client compatible with browser, React Native (Expo), Node.js, and Edge runtimes.
     - Automatically generates W3C `traceparent` headers (`00-${traceId}-${spanId}-01`).
     - Supports base URL, bearer tokens, custom request interceptors, and default context headers (`X-Tenant-Id`, `X-Workspace-Id`).
     - Standardized error handling returning typed `AccClientError` with `ProblemDetail`.
4. **Re-export & Consolidation**:
   - `packages/client/src/index.ts`: Re-export all types and client functions/classes.
   - `apps/console/src/features/metadata/api/types.ts`: Re-export everything from `@acc/client` to maintain 100% backward compatibility for all existing console imports.
   - Update `apps/console/package.json`: Add `"@acc/client": "workspace:*"` dependency.

## 3. Verification Plan
- Unit test suite `packages/client/src/__tests__/client.test.ts` testing:
  - W3C `traceparent` header generation.
  - Context header injection (`X-Tenant-Id`, `X-Workspace-Id`).
  - Request execution and response parsing.
  - RFC 7807 Problem Detail error wrapping.
- Run `pnpm --filter @acc/client test` or `vitest run`.
- Run `pnpm --filter @acc/console exec tsc --noEmit`.
- Run `pnpm --filter @acc/console test`.
