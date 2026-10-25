# 008. Domain Blueprint Seeding: Headless CMS & Digital Publishing

**Date:** 2026-10-09  
**Status:** Completed  
**Scope:** `@acc/backend` (`apps/backend/acc-fw`)

## 1. Problem Statement
Tenants requiring editorial workflow, digital media asset management, and blog/article publishing need a pre-modeled, production-ready Headless Content Management System (CMS) blueprint. Seeding this workspace manually requires creating complex schemas (articles, categories, media assets, SEO metadata) and graph relationships, which is repetitive and error-prone.

## 2. Plan & Architecture Decisions
- Design and implement a domain blueprint manifest [`cms-publishing-blueprint.json`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/resources/metadata/blueprints/cms-publishing-blueprint.json):
  - **Article & Editorial Post (`ent_cms_article`):** Title, URL Slug, Excerpt Summary, Body Content, Publishing Status (`DRAFT`, `IN_REVIEW`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`), Featured Flag, SEO Meta Title, SEO Meta Description.
  - **Content Category (`ent_cms_category`):** Category Name, URL Slug, Description.
  - **Media Asset (`ent_cms_media_asset`):** Asset Title, Storage CDN URL, Media Type (`IMAGE_JPEG`, `IMAGE_PNG`, `IMAGE_WEBP`, `VIDEO_MP4`, `DOCUMENT_PDF`), Accessibility Alt Text.
  - **Graph Relationships:**
    - `rel_article_primary_category`: Article $\rightarrow$ Category (`MANY_TO_ONE`).
    - `rel_article_cover_media`: Article $\rightarrow$ Media Asset (`MANY_TO_ONE`).
- Verify automated discovery via [`BlueprintCatalogService`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/tenant/blueprint/BlueprintCatalogService.java).
- Add unit test coverage in [`TenantProvisioningServiceTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/test/java/com/acc/tenant/service/TenantProvisioningServiceTest.java) validating atomic cloning (3 models, 15 attributes, 2 edges) and cache pre-warming.

## 3. Changes
- **Blueprint Manifest:**
  - Created [`apps/backend/acc-fw/src/main/resources/metadata/blueprints/cms-publishing-blueprint.json`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/resources/metadata/blueprints/cms-publishing-blueprint.json).
- **Test Suite:**
  - Added `provisionCmsBlueprintSuccessfully` in [`TenantProvisioningServiceTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/test/java/com/acc/tenant/service/TenantProvisioningServiceTest.java).

## 4. Verification
- `TenantProvisioningServiceTest`: 5/5 tests passed (Logistics Fleet, Blank Workspace, Conflict Detection, Unknown Blueprint, and CMS Publishing Blueprint).
- Full Maven reactor test compile & execution: 10/10 modules passed cleanly (`BUILD SUCCESS`).
