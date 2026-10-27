# 012: Domain Blueprints Full-Stack Phase 1 - In-App Gallery & Template Preview

## 1. Problem Statement
While the backend had transactional deep-cloning logic (`TenantProvisioningService`) and classpath scanning (`BlueprintCatalogService`), the system lacked:
- An endpoint to query full manifest details (`GET /api/v1/metadata/blueprints/{id}`) for frontend previewing.
- Public read access in Spring Security for blueprint discovery prior to login.
- Integration with `@acc/console`'s Unified Sandbox Platform (`.agents/rules/02-unified-sandbox.md`).
- Client UI in `@acc/console` to browse, search, and preview blueprint schemas (entity models, attribute tables, relationship graphs, and dynamic forms) before committing to provisioning.

## 2. Changes Made
1. **Backend (`@acc/backend`)**:
   - Updated `apps/backend/acc-fw/src/main/java/com/acc/presentation/TenantProvisioningController.java` to expose `GET /api/v1/metadata/blueprints/{blueprintId}`.
   - Updated `apps/backend/acc-ms-aio/src/main/resources/application-local.yml` permitAlls list for `/api/v1/metadata/blueprints` and `/api/v1/metadata/blueprints/**`.
2. **Unified Sandbox Platform**:
   - Created `apps/console/src/features/metadata/data/mock-blueprints.ts` containing manifests for Headless CMS, Fleet Logistics, B2B CRM, and Blank Canvas.
   - Updated `apps/console/src/core/sandbox/handlers/metadata-sandbox-adapter.ts` to mock `/blueprints`, `/blueprints/:id`, and `/tenants/provision`.
3. **Frontend API & Store**:
   - Added blueprint types to `apps/console/src/features/metadata/api/types.ts`.
   - Created `apps/console/src/features/metadata/api/use-blueprints.ts` with `useBlueprintCatalog`, `useBlueprintDetails`, and `useProvisionTenantBlueprint`.
   - Added `isBlueprintGalleryOpen`, `openBlueprintGallery`, `closeBlueprintGallery` to `apps/console/src/features/metadata/store/use-metadata-ui-store.ts`.
4. **Liquid Glass UI Components**:
   - Created `BlueprintGraphCanvas`: zero-dependency SVG DAG canvas rendering bezier relationship curves and cardinality badges (`1:N`, `N:N`, `1:1`).
   - Created `TemplatePreviewModal`: 3-tab preview modal (Models & Fields, Relationship Graph, Dynamic Form Mockup).
   - Created `BlueprintCard` and `BlueprintGalleryDialog` with category filters and instant provisioning trigger.
   - Mounted dialog in `MetadataDialogs`, added `Templates` button to `EntityTypeSidebar`, and enhanced empty state callout in `MetadataFeature`.

## 3. Verification
- `.\mvnw.cmd test -Dtest=TenantProvisioningServiceTest -pl acc-fw`: 5 tests passed.
- `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
- `pnpm --filter @acc/console test`: 13 suites, 76 tests passed.

## 4. Key Artifacts
- Plan: `apps/console/doc/implementation_plan_62.md`
- Walkthrough: `apps/console/doc/walkthrough_62.md`
