# 137. Backend package.json Sandbox Run & Test Scripts

## Problem
Developers and CI environments needed straightforward npm/pnpm run scripts in `apps/backend/package.json` to launch the unified backend monolith (`unipost-ms-aio`) under different sandbox execution modes (`dev:sandbox`, `dev:sandbox:persistent`, `dev:sandbox:pristine`, `dev:sandbox:test`) and quickly test the sandbox module (`test:sandbox`), without memorizing or manually typing lengthy Maven command-line flags.

## Plan
1. Update `apps/backend/package.json` scripts:
   - `dev:sandbox`: Default persistent dev mode sandbox.
   - `dev:sandbox:persistent`: Explicit alias for persistent dev mode.
   - `dev:sandbox:pristine`: Clean startup dev mode wiping local scratch state.
   - `dev:sandbox:test`: Ephemeral in-memory test mode.
   - `test:sandbox`: Targeted Surefire runner for `unipost-sandbox`.
   - Update `test:modulith` to gracefully skip projects without specified tests (`-Dsurefire.failIfNoSpecifiedTests=false`).
2. Verify multi-module dependency wiring in `apps/backend/pom.xml` and `apps/backend/unipost-ms-aio/pom.xml`.
3. Validate compilation, `test:sandbox`, and Modulith architecture verification.

## Changes
- **`apps/backend/package.json`**:
  - Added `dev:sandbox`, `dev:sandbox:persistent`, `dev:sandbox:pristine`, `dev:sandbox:test`, and `test:sandbox`.
  - Added `-Dsurefire.failIfNoSpecifiedTests=false` to `test:modulith`.
- **`apps/backend/pom.xml`**:
  - Ordered `<module>./unipost-sandbox</module>` prior to `<module>./unipost-ms-aio</module>` in reactor build order.
- **`apps/backend/unipost-ms-aio/pom.xml`**:
  - Added `<dependency>com.unipost:unipost-sandbox</dependency>`.
- **`apps/backend/unipost-ms-aio/.../WorkflowDefinitionController.java`**:
  - Added `@Autowired` to controller constructor.
- **`apps/backend/unipost-sandbox/.../SandboxTokenAspect.java` & `SandboxDataPreWarmer.java`**:
  - Replaced Lombok `@RequiredArgsConstructor` with explicit public constructors to eliminate Java compiler warnings.

## Verification
- `pnpm --filter @unipost/backend test:sandbox`: 31/31 tests passing (0 failures, 0 errors).
- `pnpm --filter @unipost/backend test:modulith`: All 9 reactor modules built successfully, ModularityTests passed.

## Tasks
- [x] Configure backend sandbox run scripts in package.json
- [x] Reorder Maven reactor modules and wire `unipost-sandbox` into `unipost-ms-aio`
- [x] Verify sandbox test suite and Modulith architecture tests
- [x] Create history record and git commit
