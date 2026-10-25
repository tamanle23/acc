---
name: acc-monorepo-guidelines
description: >-
  Comprehensive guide, path-scoped rules, architecture boundaries, and local
  build, test, and lint commands for the acc monorepo, covering backend
  microservices, web applications, mobile app, desktop client, and shared packages.
---

# Acc Monorepo Guidelines & Development Runbook

This guide establishes the workspace standards, path-scoped architectural rules, tech stack guidelines, and standard build/test/lint commands across all projects in the **acc** monorepo.

---

## 1. Monorepo Architecture & Discovered Project Catalog

The repository is organized as a multi-project monorepo orchestrated by **Turborepo** and **pnpm workspaces** (`apps/*`, `packages/*`), alongside a multi-module Maven backend.

```
acc/
├── .agents/                      # AI assistant configurations, rules, and skills
│   ├── rules/monorepo.md         # Turborepo and pnpm enforcement rules
│   └── SKILL.md                  # Comprehensive monorepo runbook (this document)
├── apps/
│   ├── desktop-console/          # Electrobun desktop client (@acc/desktop)
│   ├── mobile-ui/                # Expo / React Native mobile app (mobile-ui)
│   ├── acc-backend/         # Java 17 / Spring Boot multi-module backend (com.acc)
│   ├── acc-console/         # React 19 / Vite 8 web console (@acc/web)
│   └── tekgo-ui/                 # Next.js 15 documentation and portal (tekgo-ui)
├── packages/
│   └── typescript-config/        # Shared tsconfig presets (@acc/typescript-config)
├── pnpm-workspace.yaml           # pnpm workspace definition (apps/*, packages/*)
├── turbo.json                    # Turborepo pipeline caching and task graph
└── package.json                  # Root package orchestrator
```

### Discovered Applications & Packages Matrix

| Project Directory | Package / Artifact ID | App Type | Core Tech Stack & Frameworks | Key Configuration Files |
| :--- | :--- | :--- | :--- | :--- |
| **`apps/acc-backend`** | `com.acc:acc` | Multi-module Backend Services | Java 17, Spring Boot 4.1.1, Spring Modulith 2.1.1, Spring Cloud 2025.1.1, MyBatis 3.5.16, Apache Camel 4.8.0, QueryDSL, Lombok, MapStruct, HSQLDB | `pom.xml`, `mvnw`, `mvnw.cmd` |
| **`apps/acc-console`** | `@acc/web` | Web / Electron Admin Console | React 19.2.4, Vite 8, Tailwind CSS v4, TanStack Router & Query & Table, Radix UI, Clerk Auth, Zustand, ESLint 10, Knip | `package.json`, `vite.config.ts`, `vite.electron.config.ts`, `eslint.config.js`, `knip.config.ts` |
| **`apps/tekgo-ui`** | `tekgo-ui` | Web Portal / Content App | Next.js 15.5.12 (App Router), React 19, Tailwind CSS v4, Pliny, Remark/Rehype, KaTeX, MDX, Husky, Lint-Staged | `package.json`, `next.config.js`, `eslint.config.mjs`, `postcss.config.js` |
| **`apps/mobile-ui`** | `mobile-ui` | Cross-Platform Mobile App | Expo SDK 57, React Native 0.86.3, React 19, Zustand, React Navigation 7, Metro Bundler | `package.json`, `app.json`, `metro.config.js`, `babel.config.js`, `tsconfig.json` |
| **`apps/desktop-console`** | `@acc/desktop` | Cross-Platform Desktop App | Electrobun 2.0.1 (Bun + Cottontail runtime), Hutch, TypeScript | `package.json`, `electrobun.config.ts`, `hutch.config.ts`, `tsconfig.json` |
| **`packages/typescript-config`** | `@acc/typescript-config` | Shared Tooling / Library | TypeScript base configs (`base.json`, `electron-main.json`, `react-renderer.json`) | `package.json`, `base.json` |

---

## 2. Global Workspace Standards & Version Control Practices

### 2.1 Package Manager Discipline
* **Strictly Use pnpm**: Never invoke `npm` or `yarn` inside this monorepo.
* **Root Installation**: Run `pnpm install` exclusively from the workspace root to ensure `pnpm-lock.yaml` remains consistent and in sync across all workspaces.
* **Workspace Links Protocol**: Always declare dependencies between local packages using `workspace:*` (e.g., `"@acc/typescript-config": "workspace:*"`).
* **Adding Packages**:
  * To a specific workspace: `pnpm --filter <workspace-name> add <package>`
  * To a specific workspace as devDependency: `pnpm --filter <workspace-name> add -D <package>`
  * To root workspace: `pnpm add -D -w <package>`

### 2.2 Command Execution & Filtering
* **Run via Filters**: Avoid navigating into individual directories (`cd`) for running development scripts. Run from the workspace root using pnpm filters or Turborepo:
  * Example: `pnpm --filter tekgo-ui dev`
  * Example: `pnpm --filter @acc/web build`
* **Turborepo Pipelines**: Utilize `turbo run <task>` (e.g., `turbo build`, `turbo lint`, `turbo test`, `turbo check-types`) to leverage build caching and topological execution order.

### 2.3 Build Artifacts & Output Boundaries
* **Read-Only Artifacts**: Build outputs (`dist/`, `.next/`, `.vite/`, `out/`, `target/`, `build/`, `.turbo/`, `.cottontail-tmp/`) are generated artifacts. Do NOT edit files inside these directories directly.
* **Clean Boundaries**:
  * Never introduce circular references across workspaces.
  * Apps in `apps/` must never import directly from sibling apps via relative paths (e.g. `../../apps/foo`). Shared code, interfaces, and utilities must reside inside a dedicated package under `packages/`.

### 2.4 Version Control & Commit Practices
* **Conventional Commits**: Format commit messages as `<type>(<scope>): <summary>`
  * Valid types: `feat`, `fix`, `refactor`, `perf`, `docs`, `style`, `test`, `chore`.
  * Recommended scopes: `backend`, `acc-console`, `tekgo-ui`, `mobile-ui`, `desktop-console`, `typescript-config`, `root`.
  * Example: `feat(acc-console): integrate tanstack query devtools`
* **Ignore Rules**:
  * Keep credentials and environment files (`.env`, `.env.*local`, `credentials.json`) out of version control.
  * Always verify `.gitignore` before adding new local configuration files or caches.

### 2.5 Universal UI Standard: Liquid Glass Design Priority
* **Liquid Glass First**: For every application with a User Interface (`apps/acc-console`, `apps/tekgo-ui`, `apps/mobile-ui`, `apps/desktop-console`, and future client apps), **Liquid Glass** is the mandatory design aesthetic.
* **Core Tenets**:
  * **Optical Translucency & Frosted Surfaces**: Use multi-layer backdrop blurs (`backdrop-blur-md` to `backdrop-blur-2xl` / `expo-blur`) over semi-translucent tinted surfaces (`bg-white/60..75`, `dark:bg-slate-900/60..80`). Avoid flat, opaque background panels.
  * **Specular Highlights & Glass Borders**: Add refined translucent borders (`border-white/20..30` in light, `border-white/10..15` in dark) with subtle top-edge illumination (`shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]`).
  * **Ambient Caustics & Gradients**: Layer delicate multi-stop mesh gradients, soft radial blurs, or liquid fluid accents behind frosted glass sheets.
  * **Floating Elevation**: Soft diffuse multi-layer drop shadows (`shadow-xl shadow-black/5 dark:shadow-black/30`) that convey floating depth.
  * **Strict Legibility**: Ensure WCAG AA text contrast by adjusting surface scrim opacity behind readable content.

### 2.6 App-Specific Artifact Increment History
* **Local `doc/` Tracking**: All planning and walkthrough artifacts produced during agent workflows must be version-controlled in the target application's `doc/` directory (e.g. `apps/<app>/doc/`).
* **Sequential Numbering**: Calculate `MAX(index) + 1` from existing files in `doc/`:
  * Plans: `doc/implementation_plan_<NN>.md`
  * Walkthroughs: `doc/walkthrough_<NN>.md`
* **Preserve History**: Never overwrite previous increment files; preserve chronological iteration history across features and refactors.

---

## 3. Path-Scoped Rules & Tech Stack Guidelines

### 3.1 `apps/acc-backend` (Java / Spring Modulith / Maven)
* **Tech Stack**: Java 17, Spring Boot 4.1.1, Spring Modulith 2.1.1, Spring Cloud 2025.1.1, MyBatis 3.5.16, Apache Camel 4.8.0, QueryDSL 5.1.0, Lombok 1.18.48, MapStruct 1.6.0, AWS Java SDK 2.29.0, HSQLDB.
* **Module Structure**:
  * `acc-core`: Foundational abstractions, utilities, domain value objects.
  * `acc-fw`: Base security, exception handlers, web configurations.
  * `acc-db`: Data persistence entities, JPA / MyBatis mappers, migration scripts.
  * `acc-resources`: Localization messages, email templates, shared assets.
  * `acc-ms-identity`: Authentication, user identity, token verification.
  * `acc-ms-fs`: File storage service integrations (AWS S3, local storage).
  * `acc-ms-worker`: Async background workers, task scheduling, batch jobs.
  * `acc-report-engine`: Report generation, PDF/Excel export pipelines.
  * `acc-ms-aio`: All-In-One service packaging for monolithic/local execution.
* **Development Rules**:
  * Use the provided Maven wrapper (`mvnw.cmd` on Windows, `./mvnw` on Unix).
  * Respect Spring Modulith architectural boundaries: cross-module dependencies should occur through declared module APIs rather than internal package leaks.
  * Keep Lombok and MapStruct annotation processing bindings aligned with `lombok-mapstruct-binding` version defined in the parent POM.
  * Local database: Standalone HSQLDB is available via `start-hsql.sh` or `hsqldb.jar`.

### 3.2 `apps/acc-console` (React 19 / Vite / Tailwind CSS v4)
* **Tech Stack**: React 19.2.4, Vite 8.0.3, `@tailwindcss/vite` 4.2.2, `@tanstack/react-router` 1.168.4, `@tanstack/react-query` 5.95.2, `@tanstack/react-table` 8.21.3, Clerk React 5.61.3, Radix UI primitives, Zustand 5.0.12, Zod 4.3.6, React Hook Form 7.72.0, ESLint 10 (Flat Config), Knip.
* **Workspace Dependency**: Links to `@acc/typescript-config: workspace:*`.
* **Dual-Target Builds**: Supports both standard web deployment (`vite build --mode web`) and Electron renderer bundle (`vite.electron.config.ts --mode electron`).
* **Development Rules**:
  * Use TanStack Router for file-based or code-based client routing.
  * Use TanStack Query for all asynchronous server state; keep component state minimal with Zustand.
  * Styling & Liquid Glass: Tailwind CSS v4 via `@tailwindcss/vite`. Enforce Liquid Glass on cards, dialogs, sidebars, and toolbars (`backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/20 dark:border-white/10 shadow-xl`). Use `cn()` utility (`clsx` + `tailwind-merge`) for class composition.
  * Path aliases: Use `@/*` pointing to `./src/*` as configured in `tsconfig.json`.
  * Linting and cleanup: Run `knip` regularly to detect unused exports, files, and dependencies.

### 3.3 `apps/tekgo-ui` (Next.js 15 / MDX / Tailwind CSS v4)
* **Tech Stack**: Next.js 15.5.12 (App Router), React 19.2.4, `@tailwindcss/postcss` 4.1.18, Pliny 0.4.1, Remark/Rehype markdown pipelines, KaTeX math rendering, Prism code syntax highlighting, Husky, Lint-Staged.
* **Development Rules**:
  * Next.js App Router conventions: Place routes under `app/`.
  * Liquid Glass Theme: Implement floating frosted headers (`backdrop-blur-2xl bg-white/60 dark:bg-slate-950/60`), glassmorphic content cards, and soft ambient radial blur backdrops.
  * Content and MDX: Follow Pliny/MDX patterns for article frontmatter, typography, and rehype plugins.
  * Pre-commit checks: Git pre-commit hooks are orchestrated via Husky and Lint-Staged (formatting with Prettier, linting with ESLint).
  * Build scripts: Custom post-build processing script is triggered at `scripts/postbuild.mjs`.

### 3.4 `apps/mobile-ui` (Expo 57 / React Native / TypeScript)
* **Tech Stack**: Expo SDK ~57.0.24, React Native 0.86.3, React 19.2.3, `@react-navigation/native` & `@react-navigation/bottom-tabs` 7.x, Zustand 5.0.3, AsyncStorage, React Native SVG, TypeScript 5.3.3.
* **Configuration**: Configured via `app.json` (`slug: "mobile-ui"`, bundle ID: `com.company.mobileui`).
* **Development Rules**:
  * Use Expo CLI via workspace commands (`pnpm --filter mobile-ui <script>`).
  * Liquid Glass Mobile Aesthetics: Leverage `BlurView` (`expo-blur`) for floating tab bars, headers, and modal sheets (`tint="systemMaterial"`, intensity 60-80). Use `LinearGradient` (`expo-linear-gradient`) for specular edge highlights and fluid ambient gradients.
  * Metro Bundler: Metro configurations are defined in `metro.config.js`. Ensure monorepo node_modules resolution is preserved.
  * Path aliases: Use `~/*` mapping to `./src/*` as defined in `tsconfig.json`.
  * Safe Areas: Always wrap mobile layouts in `react-native-safe-area-context` containers.

### 3.5 `apps/desktop-console` (Electrobun / Hutch / TypeScript)
* **Tech Stack**: Electrobun 2.0.1 (Bun runtime + Cottontail desktop window manager), Hutch toolchain, TypeScript, ESLint.
* **Workspace Dependencies**: Links to `@acc/typescript-config: workspace:*` and `@acc/web: workspace:*`.
* **Configuration**: `electrobun.config.ts` (app ID `dev.acc.desktop`, Cottontail entrypoint `src/bun/index.ts`) and `hutch.config.ts`.
* **Development Rules**:
  * Use Bun / Hutch runtime commands configured in `hutch.config.ts` and `package.json`.
  * Liquid Glass Desktop Aesthetics: Exploit native window vibrancy/translucency where supported. Ensure webviews use CSS `backdrop-filter: blur(...)` with translucent chrome, glassmorphic toolbars, and floating panels.
  * Desktop-to-web bridge: Electrobun consumes renderer assets produced by `@acc/web`. Ensure `@acc/web` is built before packaging desktop distributions.

### 3.6 `packages/typescript-config` (Shared Config Presets)
* **Role**: Provides unified TypeScript configuration presets across all monorepo packages and applications.
* **Configs**:
  * `base.json`: Base configuration (ESNext target, strict mode enabled, skipLibCheck).
  * Referenced by `@acc/desktop` and `@acc/web`.

---

## 4. Standard Build, Test, and Lint Commands Reference

### 4.1 Monorepo Orchestration Commands (Turborepo & Root)

Execute from the workspace root:

```bash
# Install all dependencies across all workspaces
pnpm install

# Run turbo pipeline across all applicable workspaces
pnpm build              # turbo build (runs build on all workspaces)
pnpm dev                # turbo dev (starts development servers)
pnpm lint               # turbo lint (runs linter across all workspaces)
pnpm test               # turbo test (runs test suites across all workspaces)

# Format entire codebase
pnpm format             # prettier --write "**/*.{ts,tsx,md}"
```

---

### 4.2 Application-Specific Commands

#### 1. `apps/acc-backend` (Maven / Java 17)
Run from `apps/acc-backend` (or prefix with `apps/acc-backend/`):

```bash
# Windows (cmd/powershell):
.\mvnw.cmd clean install                      # Build all modules and run tests
.\mvnw.cmd clean install -DskipTests          # Fast build without tests
.\mvnw.cmd test                               # Run all unit and integration tests
.\mvnw.cmd clean install -pl acc-ms-aio -am # Build AIO service and its dependencies
.\mvnw.cmd spring-boot:run -pl acc-ms-aio   # Run standalone All-in-One Spring Boot app

# Unix / macOS:
./mvnw clean install
./mvnw test
./mvnw spring-boot:run -pl acc-ms-aio
```

#### 2. `apps/acc-console` (`@acc/web`)
Run from the workspace root:

```bash
# Development server (Vite)
pnpm --filter @acc/web dev

# Build both Web and Electron renderer bundles
pnpm --filter @acc/web build

# Build Web bundle only
pnpm --filter @acc/web build:web

# Linting with ESLint 10
pnpm --filter @acc/web lint

# Unused code and dependency audit
pnpm --filter @acc/web knip

# Code formatting check
pnpm --filter @acc/web format:check
pnpm --filter @acc/web format
```

#### 3. `apps/tekgo-ui` (`tekgo-ui`)
Run from the workspace root:

```bash
# Development server (Next.js)
pnpm --filter tekgo-ui dev

# Production build (Next build + postbuild script)
pnpm --filter tekgo-ui build

# Start production server
pnpm --filter tekgo-ui serve

# Lint source directories with Next ESLint
pnpm --filter tekgo-ui lint

# Bundle size analysis
pnpm --filter tekgo-ui analyze
```

#### 4. `apps/mobile-ui` (`mobile-ui`)
Run from the workspace root:

```bash
# Start Expo development bundler
pnpm --filter mobile-ui start

# Launch on Android emulator/device
pnpm --filter mobile-ui android

# Launch on iOS simulator/device
pnpm --filter mobile-ui ios

# Launch Expo web preview
pnpm --filter mobile-ui web

# TypeScript type check
pnpm --filter mobile-ui exec tsc --noEmit
```

#### 5. `apps/desktop-console` (`@acc/desktop`)
Run from the workspace root:

```bash
# Start Electrobun development mode
pnpm --filter @acc/desktop dev

# Build Electrobun desktop distribution
pnpm --filter @acc/desktop build

# Lint desktop client code
pnpm --filter @acc/desktop lint
```

---

## 5. Maintenance Checklist for New Apps & Packages

When adding a new application or shared library:
1. Place deployable applications in `apps/<app-name>` and shared reusable packages in `packages/<package-name>`.
2. Configure `package.json` with appropriate name (use `@acc/<name>` scope where appropriate) and declare dependencies to internal packages using `"workspace:*"`.
3. In `turbo.json`, verify if new output directories need to be cached under the `build` task (default is `dist/**`).
4. Extend `@acc/typescript-config/base.json` in the new package's `tsconfig.json`.
5. Run `pnpm install` from the root to link workspace packages and update `pnpm-lock.yaml`.
6. Update this `.agents/SKILL.md` catalog with the new service details and commands.
