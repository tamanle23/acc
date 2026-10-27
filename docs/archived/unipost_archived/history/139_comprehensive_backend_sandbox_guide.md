# 139. Comprehensive Backend Unified Sandbox Platform Guide

## Problem
Developers, automated test engineers, and AI agents needed a clear, authoritative, and end-to-end 360° guide explaining how to operate, configure, test, and extend the newly implemented **Backend Unified Sandbox Platform** (`acc-sandbox`), including authentication persona cheatsheets, embedded PostgreSQL RLS mechanics, boundary simulator references, and interactive API recipes.

## Plan
1. Capture detailed requirements and architecture in `docs/integration_master_plan_iteration9.md`.
2. Author the comprehensive operational guide directly inside the sandbox module at `apps/backend/acc-sandbox/README.md`.
3. Document:
   - Zero-stub mandate and PostgreSQL embedded engine (`pglite-spring-boot-test`).
   - Dual operating modes (`DEV` vs `TEST`).
   - System architecture diagrams and design patterns (Strategy, Registry, Proxy, AOP, Batch Memento).
   - Monorepo root and backend package CLI scripts.
   - Boundary simulators (PayOS VietQR, InMemoryStorage, MockWebhookDispatcher).
   - Authentication & Authorization: Zero-database persona JWTs (`SandboxTokenAspect`) and Liquibase database users (`UNIPOST_USER`).
   - Interactive cURL recipes with JSON payloads.
   - High-volume CMS scaffolding (1,000+ Articles, Categories, Media Assets, Graph Edges).
   - External PostgreSQL datasource configuration instructions.
   - SPI Extension Guide for writing custom simulators.
   - Full configuration properties table and troubleshooting FAQ.
4. Verify markdown structure and commit according to Rule 6.

## Changes
- **`docs/integration_master_plan_iteration9.md`**: Master integration plan and architecture specification for Iteration 9.
- **`apps/backend/acc-sandbox/README.md`**: The authoritative 360° developer and architecture guide for the Backend Unified Sandbox Platform.

## Verification
- Verified all property keys match `SandboxProperties.java`.
- Verified all CLI commands match root and backend `package.json`.
- Verified all persona identifiers, roles, and tenant claims match `SandboxPersonaRegistry.java` and `SandboxTokenAspect.java`.
- Verified Liquibase seeded users match `changelog-master_data.xml` and `changelog-mock_data.xml`.

## Tasks
- [x] Author `docs/integration_master_plan_iteration9.md`
- [x] Author comprehensive 360° guide at `apps/backend/acc-sandbox/README.md`
- [x] Create history record and git commit
