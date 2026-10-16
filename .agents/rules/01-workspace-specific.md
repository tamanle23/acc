---
trigger: always_on
description: Compact monorepo registry, packaging boundaries, i18n sync, and Liquid Glass design standards.
---

# WORKSPACE REGISTRY & ROUTING
- Specs: `pnpm` workspace + Turborepo pipelines (`build`, `dev`, `lint`, `test`, `check-types`).
- Registry:
  - `@unipost/backend`: `apps/backend` (Java 21 / Spring Modulith) | Deps: None
  - `@unipost/console`: `apps/console` (React 19 / Vite 8) | Deps: `@unipost/ui`, `@unipost/i18n`, `@unipost/typescript-config`
  - `@unipost/desktop`: `apps/desktop-console` (Electrobun) | Deps: `@unipost/console`, `@unipost/typescript-config`
  - `mobile-ui`: `apps/mobile-ui` (Expo SDK 57 / React Native 0.86) | Deps: None
  - `tekgo-ui`: `apps/tekgo-ui` (Next.js 15 / React 19) | Deps: `@unipost/ui`
  - Packages: `@unipost/i18n` (`packages/i18n`), `@unipost/typescript-config` (`packages/typescript-config`), `@unipost/ui` (`packages/ui`)
- Directive: Treat registry as authoritative. NEVER perform full-repo tree scans to locate apps. Scope all operations directly inside registered paths.

# MONOREPO & PACKAGING BOUNDARIES
- Package Manager: STRICTLY `pnpm`. NEVER run `npm` or `yarn`. Run `pnpm install` at root on dependency changes.
- Workspace Linking: MUST use `"workspace:*"` for all internal package references.
- Execution: ALWAYS run commands from root with filters: `pnpm --filter <app> <cmd>` or `turbo run <task> --filter=<app>`. NEVER use `cd`.
- Isolation: Apps in `apps/` MUST NEVER import from sibling apps via relative paths. Use `packages/`.
- Build Outputs: NEVER edit files in `dist/`, `.next/`, `out/`, `.vite/`, `target/`.

# I18N & LOCALE SYNCHRONIZATION
- Common Resources: Shared strings MUST be in `packages/i18n/src/locales/<lang>/common.json` (ns `common:`).
- App Resources: App-specific strings MUST be in `apps/<app>/src/locales/<lang>/<app>.json`.
- UI Usage: MUST use `useTranslation()` with English fallback: `t('key', 'Fallback')`. NEVER hardcode raw text.
- Locale Sync: Whenever keys are modified, MUST sync all supported locales (`en`, `vi`) simultaneously.
- Nav Items: All items in `sidebar-data.ts` MUST have matching keys in all locale JSON files.

# LIQUID GLASS UI DESIGN STANDARDS
- Priority: Liquid Glass is the mandatory visual aesthetic across all UI clients.
- Core Glass Tokens:
  - Translucency: Multi-layer backdrop blur (`backdrop-blur-md` to `backdrop-blur-2xl`) over tinted frosted scrims (`bg-white/65`, `dark:bg-slate-900/65`). NEVER use flat opaque backgrounds.
  - Borders: Specular borders `border-white/30 dark:border-white/10` with inset highlights `shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]`.
  - Shadows: Diffuse floating elevation `shadow-xl shadow-black/5 dark:shadow-black/30`.
  - Contrast: WCAG AA compliance is mandatory. Adjust scrim opacity behind text.
- Platform Specifics:
  - Web: Tailwind v4 glass cards (`backdrop-blur-xl bg-white/65 border border-white/30`), frosted sticky headers.
  - Mobile: Expo `BlurView` (`tint="systemMaterial"`, intensity 50-85) + `LinearGradient` specular sheens.
  - Desktop: Electrobun window vibrancy + CSS `backdrop-filter: blur(...)`.

# UI/UX LIVING DESIGN & ROUTE SPECIFICATIONS (GOOGLE STITCH)
- Files: Every frontend/mobile app (`console`, `mobile-ui`, `tekgo-ui`, `desktop-console`) MUST maintain `DESIGN.md` and `ROUTE.md` in its root folder.
- DESIGN.md: Acts as portable Google Stitch design system context. MUST define OKLCH/hex color tokens, Liquid Glass blur/specular metrics, typography scale, component specs, and Stitch prompt templates.
- ROUTE.md: MUST define routing engine, complete screen registry table, screen blueprints with state/store bindings, and user flow diagrams.
- Synchronization: When routes, screens, or UI tokens are added/edited, MUST synchronously update `DESIGN.md` and `ROUTE.md`. NEVER leave them out of sync.

# DYNAMIC METADATA ENGINE INVARIANTS
- Schema Caching: MUST use versioned cache keys `schema:{id}:v{version}` with L1 in-memory parsed `JsonSchema` + L2 Distributed Hazelcast fallback. Hazelcast failures MUST NEVER break schema compile or validation.
- Schema Evolution: Any attribute definition mutation MUST increment `UNIPOST_ENTITY_TYPES.schema_version` in the same transaction.
- Soft-Delete Indexes: Metadata tables (`UNIPOST_ENTITY_TYPES`, `UNIPOST_ATTRIBUTE_DEFINITIONS`, `UNIPOST_RELATIONSHIP_TYPES`, `UNIPOST_ENTITY_RELATIONSHIPS`) MUST use partial unique indexes `WHERE "deletedDate" IS NULL`.
- Record Validation: Compilation MUST set `additionalProperties: false`. Server-side defaults MUST be applied prior to JSON Schema validation.
- Relationships: MUST enforce cardinality constraints and reject cross-tenant relations. `relation_picker` attributes MUST validate target record existence.

