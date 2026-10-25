# Walkthrough: Turborepo Integration for Java Modulith Backend

The Java Spring Modulith backend (`apps/backend`) has been integrated into the Turborepo and `pnpm` monorepo workspace. Turborepo pipeline tasks (`build`, `dev`, `test`, `lint`, `check-types`) are now fully functional from the root workspace and via targeted `--filter` commands.

## Architecture Overview

- **Spring Modulith Core**: The backend domain modules (`acc-core`, `acc-fw`, `acc-resources`, `acc-db`, `acc-ms-fs`, `acc-ms-identity`, `acc-report-engine`, `acc-ms-worker`) define domain boundaries.
- **AIO Wrapper (`acc-ms-aio`)**: The All-In-One wrapper application bundles and executes all modulith modules, houses the Spring Modulith verification test (`ModularityTests.java`), and packages the final runnable Fat JAR.
- **Turborepo & Cross-Platform Orchestration**:
  - `apps/backend/package.json`: Exposes standard Turborepo task scripts.
  - `apps/backend/mvnw.cjs`: Cross-platform Node.js runner that dynamically detects OS shell requirements (`mvnw.cmd` on Windows vs `mvnw` on POSIX) and auto-detects `JAVA_HOME` if isolated by Turborepo.
  - `apps/backend/turbo.json`: Defines caching for `builds/**` and `**/target/**`.
  - `turbo.json`: Added `JAVA_HOME` to `globalPassThroughEnv`.

## Changes Made

### Java Backend (`apps/backend`)

#### [package.json](file:///c:/Users/Admin/workspace/git/acc/apps/backend/package.json)
Created private workspace package `@acc/backend` with scripts:
- `build`: `node mvnw.cjs clean package -DskipTests`
- `dev`: `node mvnw.cjs -pl acc-ms-aio spring-boot:run -Dspring-boot.run.profiles=dev`
- `test`: `node mvnw.cjs test`
- `test:modulith`: `node mvnw.cjs -pl acc-ms-aio test -Dtest=ModularityTests`
- `lint`: `node mvnw.cjs test-compile -DskipTests`
- `check-types`: `node mvnw.cjs test-compile -DskipTests`
- `clean`: `node mvnw.cjs clean`

#### [mvnw.cjs](file:///c:/Users/Admin/workspace/git/acc/apps/backend/mvnw.cjs)
Implemented a zero-dependency cross-platform runner:
- Invokes `mvnw.cmd` on Windows and `mvnw` on Linux/macOS.
- Automatically detects `JAVA_HOME` via `where.exe java` / `which java` if not present in the environment.

#### [turbo.json](file:///c:/Users/Admin/workspace/git/acc/apps/backend/turbo.json)
Configured package-level caching:
```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "extends": ["//"],
  "tasks": {
    "build": {
      "outputs": ["builds/**", "**/target/**"]
    }
  }
}
```

### Monorepo Root

#### [turbo.json](file:///c:/Users/Admin/workspace/git/acc/turbo.json)
- Added `"JAVA_HOME"` to `globalPassThroughEnv` so Turborepo passes the Java environment variable to spawned task runners.

#### [pnpm-lock.yaml](file:///c:/Users/Admin/workspace/git/acc/pnpm-lock.yaml)
- Updated via `pnpm install` to register `@acc/backend` in the 7 workspace packages.

## Verification Results

### 1. Spring Modulith Architecture Verification
Command:
```bash
pnpm --filter @acc/backend test:modulith
```
Result: **Passed**
- Executed `ModularityTests` in `acc-ms-aio`.
- Verified domain boundaries and controllers:
  ```
  === Spring Modulith Application Modules ===
  # Controller
  > Logical name: com.acc.aio.controller
  > Base package: com.acc.aio.controller
  > Excluded packages: none
  Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
  ```

### 2. Turborepo Lint & Type-Check Task
Command:
```bash
pnpm turbo run lint --filter=@acc/backend
```
Result: **Passed** (exit code 0)
- Compiled all 10 modules including annotation processors (MapStruct, Lombok, QueryDSL).

### 3. Turborepo Test Pipeline
Command:
```bash
pnpm turbo run test --filter=@acc/backend
```
Result: **Passed** (exit code 0)
- Ran full test suite across the reactor in 8.0s.

### 4. Turborepo Build & Fat JAR Packaging
Command:
```bash
pnpm turbo run build --filter=@acc/backend
```
Result: **Passed** (exit code 0)
- Packaged Fat JAR artifact in `apps/backend/acc-ms-aio/target/acc-ms-aio-1.0.0-SNAPSHOT.jar` and `apps/backend/builds/acc-ms-aio/`.
