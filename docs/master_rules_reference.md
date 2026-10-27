# Master Rules & Architecture Reference (Source of Truth)

This document is the authoritative, comprehensive repository of all architectural standards, development workflows, design systems, and operational constraints for the **acc** monorepo.

---

## 1. Rule Management Standard Operating Procedure (SOP)

### Purpose & Architecture
To minimize token consumption during automated coding sessions while preserving 100% of institutional knowledge, all rules follow a two-tier architecture:
1. **Master Reference (`docs/master_rules_reference.md`)**: Complete, verbose documentation containing explanations, architectural context, detailed examples, and edge cases.
2. **Active Rules (`.agents/rules/`)**: Hyper-compact, imperative constraints loaded directly into the AI context window.

### Workflow for Adding or Updating Rules
Whenever a rule needs to be introduced, updated, or modified:
1. **Step 1 (Source of Truth)**: Write the full explanation, rationale, and code examples into this document (`docs/master_rules_reference.md`).
2. **Step 2 (Categorization)**: Determine whether the rule is:
   - **Generic Common**: Applicable across any software project (e.g., git conventions, error handling, tracking).
   - **Workspace Specific**: Bound to this monorepo's applications, frameworks, UI system, or packages.
3. **Step 3 (Distillation)**: Condense the rule into minimal, imperative bullet points / YAML syntax without transitional fluff.
4. **Step 4 (Append Active Rule)**: Append only the distilled constraint to `.agents/rules/00-generic-common.md` or `.agents/rules/01-workspace-specific.md`.

---

## 2. Turborepo Monorepo Architecture & Registry

### Monorepo Specifications
- **Package Manager**: pnpm (strict workspace isolation)
- **Orchestration**: Turborepo
- **Turbo Pipelines**: `build`, `dev`, `lint`, `test`, `check-types`, `validate:infra`

### Workspace Registry Matrix
| Identifier | Path | Framework / Runtime | Internal Dependencies |
| :--- | :--- | :--- | :--- |
| `@acc/backend` | `apps/backend` | Java 21, Spring Boot, Spring Modulith, Spring Cloud, Maven | None |
| `@acc/console` | `apps/console` | React 19, Vite 8, Tailwind CSS v4, TanStack Router/Query | `@acc/ui`, `@acc/i18n`, `@acc/typescript-config` |
| `mobile-ui` | `apps/mobile-ui` | Expo SDK 57, React Native 0.86, React 19, Zustand | None |
| `tekgo-ui` | `apps/tekgo-ui` | Next.js 15 (App Router), React 19, MDX, Pliny | `@acc/ui` |
| `@acc/i18n` | `packages/i18n` | Shared i18next dictionaries and translation utilities | None |
| `@acc/typescript-config` | `packages/typescript-config` | Shared TypeScript tsconfig base configurations | None |
| `@acc/ui` | `packages/ui` | Shared React components and Liquid Glass design utilities | None |

### Operational Directives & Boundaries
1. **Persistent Mapping**: Treat the registry above as the definitive workspace index. Never perform full-repository directory scans to discover apps or packages.
2. **Direct Scoping**: When working on an application or package, scope all searches, edits, and file reads directly to its registered directory.
3. **Monorepo Command Execution**:
   - Always run commands from the repository root using `--filter` or Turborepo pipelines.
   - Example: `pnpm --filter tekgo-ui dev` or `turbo run build --filter=@acc/console`.
   - Never change directories (`cd`) inside agent commands.
4. **Package Manager Discipline**:
   - Strictly use `pnpm`. Never invoke `npm` or `yarn`.
   - Local workspace dependencies must always use the `workspace:*` protocol (e.g., `"@acc/ui": "workspace:*"`).
   - Sync root `pnpm-lock.yaml` with `pnpm install` whenever dependencies change.
5. **Architectural Isolation**:
   - Deployable applications reside in `apps/`; reusable shared code resides in `packages/`.
   - Sibling apps in `apps/` must never directly import from one another via relative paths. Extract shared code into `packages/`.
6. **Read-Only Output Boundaries**:
   - Never manually modify generated build outputs (`dist/`, `.next/`, `out/`, `.vite/`, `target/`, `.turbo/`).

---

## 3. Version Control & Automated Git Commits

### Execution Lifecycle Commit Rule
Whenever an implementation plan, bug fix, refactoring, or code update completes execution and verification (lint, build, tests passing), the agent **MUST automatically stage and commit all changes** to Git. Do not leave verified code uncommitted or wait for explicit user prompting.

### Commit Message Standards
- Format follows **Conventional Commits**: `<type>(<scope>): <summary>`
  - Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `style`, `test`, `chore`.
  - Scopes: `backend`, `console`, `desktop`, `mobile-ui`, `tekgo-ui`, `i18n`, `ui`, `agents`, `root`.
- Multi-part changes must include bullet points in the commit message body explaining the rationale.
- Clean Staging: Never stage secrets, live credentials (`.env`), or temporary scratch files.

---

## 4. App-Specific Artifact History & Incremental Tracking

### Traceability Architecture
All agent planning documents and post-execution walkthroughs must be stored directly within the affected application's local `doc/` directory to ensure version-controlled historical tracking.

### Numbering & Counter Mechanism
1. **Target Path**: `apps/<target-app>/doc/` (or `packages/<target-pkg>/doc/`). Auto-create if absent.
2. **Shared Global Counter**:
   - Compute `NEXT = MAX(all existing NN indices across plans and walkthroughs) + 1`. If none exist, start at `01`.
   - A planned feature generates a matched pair sharing the same index number:
     - `apps/<target-app>/doc/implementation_plan_<NN>.md` (created before execution)
     - `apps/<target-app>/doc/walkthrough_<NN>.md` (created after execution)
   - A reactive fix (no planning phase) skips the plan file but advances the shared counter:
     - `apps/<target-app>/doc/walkthrough_<NEXT>.md`
3. **Dual Persistence**:
   - Interactive artifacts in the agent session brain directory are mirrored 1:1 into the target app's `doc/` folder.
   - Never overwrite prior numbered iterations.

---

## 5. Critical Catches & Architectural Gotchas Documentation

### Capture Philosophy
When a non-obvious bug, edge-case, architectural failure mode, or framework-specific gotcha is uncovered during development, it must be permanently recorded so it is never repeated.

### Documentation Workflow
- **Coding Standard Workarounds**: Add a new rule or update this master document if the issue requires standardizing agent behavior.
- **Domain/Project Logic Catches**: Document the edge-case, root cause, and failure mode directly in the target app's `doc/` walkthrough or architecture notes.

---

## 6. Internationalization (i18n) Strategy & Locale Synchronization

### Dictionary Separation
1. **Shared Dictionaries (`packages/i18n`)**:
   - Common, reusable UI strings (e.g., "Save", "Cancel", "Submit", "Loading", generic validation errors).
   - Path: `packages/i18n/src/locales/<lang>/common.json`.
   - Namespace: `common` (e.g., `t('common:save', 'Save')`).
2. **App-Specific Dictionaries (`apps/<app>/src/locales/`)**:
   - Domain-specific terms, screen titles, feature-specific copy.
   - Path: `apps/<app>/src/locales/<lang>/<app>.json`.
   - Namespace: Default app namespace (e.g., `t('dashboard.title', 'Dashboard')`).

### Implementation & Synchronization Rules
- **React Components**: Always use the `useTranslation()` hook. Refactor static configurations containing user text into hooks (e.g., `useSidebarData()`).
- **Mandatory Fallback**: Always supply English fallback text: `t('key', 'English Fallback Text')`.
- **Multi-Language Sync**: When adding/modifying keys, update all supported locale files (`en`, `vi`) simultaneously. Never introduce asymmetric dictionary keys.
- **Sidebar Navigation**: Every item added to `sidebar-data.ts` must have corresponding keys in every locale JSON.

---

## 7. Liquid Glass UI Design Standards

### Visual Language Principles
Liquid Glass is the mandatory design standard for all UI clients across web, mobile, and desktop:
1. **Optical Translucency & Frosted Glass**:
   - Use multi-layered backdrop blurs (`backdrop-blur-md` to `backdrop-blur-2xl`) over semi-translucent backgrounds (`bg-white/65`, `dark:bg-slate-900/65`). Avoid flat, opaque fills.
2. **Specular Highlights & Glass Borders**:
   - Light mode: `border border-white/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]`
   - Dark mode: `border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]`
3. **Fluid Gradients & Ambient Glow**:
   - Ambient multi-stop mesh gradients, soft radial blurs, and chromatic caustic glows underlying glass layers.
4. **Depth & Elevation**:
   - Multi-layered soft drop shadows: `shadow-[0_8px_32px_0_rgba(0,0,0,0.08)]` (light), `shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]` (dark).
5. **Legibility & Accessibility**:
   - Maintain WCAG AA text contrast using background scrim opacity (`bg-white/70`, `dark:bg-slate-900/75`).
6. **Micro-Interactions**:
   - Smooth cubic-bezier transitions, subtle hover sheen, gentle press elevation scaling (`scale-[1.01]`, `active:scale-95`).

### Implementation Snippets by Platform
- **Web (Tailwind CSS v4)**:
  - Glass Card:
    ```html
    <div class="bg-white/65 dark:bg-slate-900/65 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/30 rounded-2xl">
      <!-- content -->
    </div>
    ```
  - Sticky Header:
    ```html
    <header class="sticky top-0 z-50 bg-white/50 dark:bg-slate-950/50 backdrop-blur-2xl border-b border-white/20 dark:border-white/10">
    ```
  - Liquid Button:
    ```html
    <button class="relative overflow-hidden bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/15 border border-white/30 dark:border-white/15 backdrop-blur-md text-foreground shadow-sm transition-all duration-200 active:scale-95">
    ```
- **Mobile (Expo & React Native)**:
  - `BlurView` from `expo-blur` (`tint="systemMaterial"`, intensity 50-85) for floating tab bars and bottom sheets.
  - `LinearGradient` from `expo-linear-gradient` for specular top sheen borders.

---

## 8. App UI/UX Design & Route Specification Foundation (Google Stitch Integration)

### Core Directives
To ensure visual consistency, architectural predictability, and seamless collaboration with generative design engines like **Google Stitch**, every frontend and mobile application in the monorepo (`apps/console`, `apps/mobile-ui`, `apps/tekgo-ui`) maintains two living foundation files in its root directory:
1. **`DESIGN.md` (Portable Design System & Google Stitch Context)**:
   - Contains complete design tokens (colors, OKLCH scales, light/dark themes, Liquid Glass blur/specular values, typography hierarchy, radii, elevation).
   - Specifies core component contracts (`GlassCard`, `GlassButton`, frosted headers, floating bars).
   - Provides ready-to-use "Zoom-Out-Zoom-In" prompting blueprints specifically formatted for Google Stitch AI screen generation.
2. **`ROUTE.md` (Screen Architecture & Navigation Matrix)**:
   - Documents the routing engine (TanStack Router, React Navigation, Next.js App Router).
   - Maps out the complete route matrix (path, file location, layout shell, auth guards, parameters).
   - Provides detailed screen blueprints (components, state/store dependencies, interactive behaviors).
   - Visualizes user journeys with Mermaid flowcharts.

### Living Document Maintenance SOP
- **Synchronous Updates**: Whenever an agent or engineer adds, modifies, or deletes a route, screen, or core visual component, they MUST update the corresponding `DESIGN.md` and `ROUTE.md` files in the app's directory.
- **Design Token Synchronization**: Any token adjustments in CSS or TypeScript must be mirrored in `DESIGN.md` so that Google Stitch generations remain in lockstep with the running codebase.
- **Google Stitch Workflow**: When requesting new screens or layouts from Google Stitch or AI coding assistants, feed `DESIGN.md` and `ROUTE.md` as contextual constraints to ensure pixel-perfect fidelity with the monorepo's Liquid Glass standard.

---

## 9. Dynamic Metadata Engine Architecture & Failure Modes

### Core Architectural Invariants
1. **Schema Caching (C4 & C5)**:
   - Dynamic Draft-07 schemas compiled from attribute definitions must use immutable, versioned cache keys: `schema:{entityTypeId}:v{schemaVersion}`.
   - Cache resolution operates in two tiers: L1 parsed in-memory cache (`ConcurrentHashMap<String, JsonSchema>`) for microsecond throughput, backed by L2 Distributed Hazelcast with TTL fallback.
   - Cache misses must gracefully fall through to in-process recompilation. A Hazelcast outage must NEVER fail schema compilation or record validation.
2. **Schema Invalidation & Evolution**:
   - Every attribute definition creation, update, reorder, archive, or unarchive MUST increment `UNIPOST_ENTITY_TYPES.schema_version` within the same transaction.
   - Spring Modulith event publication triggers local L1 cache clearing. Stale version entries become unreachable by construction.
3. **Database Constraints & Soft-Deletes**:
   - Unique constraints on dynamic metadata entities (`system_name`, `(entity_type_id, system_name)`, and `(source_entity_id, target_entity_id, relationship_type_id)`) MUST use PostgreSQL partial unique indexes conditioned on `WHERE "deletedDate" IS NULL`.
   - Never use unconditional unique constraints on soft-deleted metadata tables.
4. **Validation Integrity (C3)**:
   - JSON Schema compilation generates `additionalProperties: false` to prevent schema drift and arbitrary payload contamination.
   - Server-side defaults must be injected into records before JSON Schema validation occurs.
   - `relation_picker` attributes must be validated against real records of the target entity type prior to saving.
5. **Relationship Cardinality & Multi-Tenancy**:
   - Entity relationships must strictly enforce cardinality (`ONE_TO_ONE`, `ONE_TO_MANY`, `MANY_TO_ONE`, `MANY_TO_MANY`).
   - Cross-tenant relationship linking is strictly forbidden.

---

## 10. Production-Grade Implementation & Zero-Stub / Mock Invariant

### Core Rationale
When executing implementation plans, tasks, or user requests, writing synthetic mocks, temporary stubs, fake assertions, or "implemented but put aside" orphaned code leads to severe technical debt, deceptive green test suites, and unverified architectural invariants. All delivered code must be production-grade, wired into the active execution path, and verified against real system components.

### Non-Negotiable Directives
1. **NO FAKE / SYNTHETIC TEST TARGETS**:
   - Tests asserting system properties (security, multi-tenancy, RLS, schemas, crypto, idempotency) MUST exercise actual production classes, filters, and engines (e.g. real Spring Security filter chains, real Jackson compilers, real DB/RLS sessions), NEVER in-memory mock adapters or standalone synthetic stub engines like `@acc/sandbox` when testing backend or core system invariants.
   - Vitest and JUnit tests must assert against the real domain contracts.
2. **NO ORPHANED / "PUT ASIDE" IMPLEMENTATIONS**:
   - NEVER write features, utilities, components, or handlers that are left disconnected from the active application graph.
   - If a new engine, service, or widget is created, it MUST be actively registered, imported, and wired into the live execution path (e.g. registered in `WidgetRegistry`, routed in `ROUTE.md`, wired in store actions, or added to build/CI pipelines).
   - "Placeholder implementations", unused dummy methods, commented-out dead code, or files created without consumers are strictly prohibited.
3. **NO DETERMINISTIC MOCK BYPASSES IN QUALITY GATES**:
   - CI/CD and penetration testing suites must never use hardcoded success responses, trivial mock returns (`status: 200` without real validation), or short-circuited checks.
   - Penetration fuzzing, chaos tests, and performance benchmarks must execute against actual parsing, token validation, regex matching, and atomic locking logic.

---

## 11. Common Component Reuse & Anti-Boilerplate Mandate

### Core Rationale
Re-inventing existing design patterns by implementing raw HTML/JSX tables, duplicate search bars, manual pagination loops, or bespoke modal shells causes visual inconsistency, breaks Liquid Glass styling parity, degrades keyboard accessibility (WCAG 2.2 AA), and introduces redundant maintenance surface area. Prioritizing shared library components ensures design token adherence, consistent user ergonomics, and minimal boilerplate.

### Non-Negotiable Directives
1. **MANDATORY COMMON COMPONENT DISCOVERY**:
   - Before creating or modifying UI screens, tables, forms, or navigation panels, developers and AI agents MUST inspect existing shared component directories (`apps/console/src/components/`, `packages/ui/src/`) for existing abstractions.
2. **DATA-TABLE COMPONENT PRIORITY**:
   - All tabular listings (e.g. Workflows Catalog, Approvals Inbox, Workflow Executions, Users, Tenants) MUST use the centralized `@/components/data-table` primitives (`DataTable`, `DataTableToolbar`, `DataTablePagination`, `DataTableColumnHeader`, `DataTableFacetedFilter`) powered by TanStack Table.
   - Never write raw boilerplate `<table>`, `<thead>`, `<tbody>`, or manual pagination rows when presenting tabular entities.
3. **SEPARATION OF COLUMN CONCERNS**:
   - Table column definitions MUST be defined in dedicated `*-columns.tsx` files implementing TanStack `ColumnDef<T>[]` with accessible headers (`DataTableColumnHeader`).
4. **ANTI-BOILERPLATE ENFORCEMENT**:
   - Do not implement ad-hoc search inputs or filter button rows outside `DataTableToolbar` when a `DataTable` is already present. Use `DataTableToolbar`'s native search, faceted filters, and reset actions.

---

## 12. Unified Sandbox Parity & Screen Synchronization Mandate

### Core Rationale
The Unified Sandbox Platform (`@acc/sandbox` and `apps/console/src/core/sandbox/`) is the central offline execution engine enabling client applications (`@acc/console`, mobile, desktop) to run, demonstrate, and be automated without a live backend connection. When developers or AI agents create new routes, feature screens, modals, or mutation workflows without adding or updating corresponding sandbox route handlers, the screen renders blank or crashes with unhandled 404/500 errors in development mode (`import.meta.env.DEV`), breaking local-first workflows and automated UI test harnesses.

### Non-Negotiable Directives
1. **MANDATORY SANDBOX PARITY FOR NEW SCREENS & FEATURES**:
   - Whenever introducing a new screen, route, or feature that consumes backend REST/GraphQL/SSE APIs, developers and AI agents MUST concurrently create or update a corresponding `SandboxRouteHandler` in `packages/sandbox/src/handlers/`.
   - The handler MUST implement the `SandboxRouteHandler` contract (`id`, `name`, `priority`, `matcher`, `handler`) and be registered in `packages/sandbox/src/index.ts`.
2. **MULTI-TENANT & PERSONA AWARENESS**:
   - Sandbox handlers MUST inspect the request's tenant context (`req.headers['X-Tenant-Id']` or `defaultSandboxStore.getState().activeTenantId`).
   - Mock data stores MUST partition records by tenant ID. When the active persona is Sovereign Custodian (`SYSTEM`), handlers MUST allow fleet-wide aggregation across all tenants or tenant-scoped filtering.
3. **STATEFUL IN-MEMORY REPOSITORY & RESET HOOK**:
   - Every simulated domain MUST maintain an in-memory repository with realistic initial seed data.
   - Every repository MUST register a `reset()` function with `sandboxResetRegistry` (e.g. `sandboxResetRegistry.register(() => this.reset())`) so clicking "Reset Data" in `SandboxDock` reliably restores clean initial states.
4. **EDGE-CASE & DIAGNOSTIC SIMULATION SUPPORT**:
   - Where applicable, sandbox handlers and repositories MUST provide simulation utilities (e.g. `injectPoisonTask`, fault injection, error simulations) callable from `SandboxDock`'s diagnostics panel to facilitate manual and automated edge-case verification.
5. **ZERO AD-HOC MOCKS IN UI COMPONENTS**:
   - Components MUST ALWAYS call their standard API hooks (e.g. `useQuery`, `springApiClient`, Axios). Under no circumstances may hardcoded mock arrays or fake in-component switches bypass the Unified Sandbox.

