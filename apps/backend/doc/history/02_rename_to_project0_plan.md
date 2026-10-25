# Implementation Plan: Rename Repository from `prjz` to `acc`

This plan details renaming every occurrence of **`prjz`** to **`acc`** across the entire codebase, including Maven coordinates, directory names, Java package structures, configuration files, and documentation.

## User Review Required

> [!IMPORTANT]
> **Complete Package & Directory Refactoring:**
> - Java package root changes from `com.prjz.*` to `com.acc.*`.
> - All Maven module folders change from `prjz-*` to `acc-*`.
> - Maven `groupId` changes from `com.prjz` to `com.acc`.
> - Root Maven `artifactId` changes from `prjz` to `acc`.

---

## Proposed Changes

### Step 1: Clean Build Artifacts
Run Maven clean or delete all `target/` directories across all modules so only source files are modified:
- Remove all `target/` folders.

### Step 2: Source Code Package Refactoring
Move Java directories from `com/prjz` to `com/acc` in:
- `prjz-core/src/main/java/com/prjz` &rarr; `com/acc`
- `prjz-fw/src/main/java/com/prjz` &rarr; `com/acc`
- `prjz-ms-fs/src/main/java/com/prjz` &rarr; `com/acc`
- `prjz-ms-identity/src/main/java/com/prjz` &rarr; `com/acc`
- `prjz-report-engine/src/main/java/com/prjz` &rarr; `com/acc`
- `prjz-ms-worker/src/main/java/com/prjz` &rarr; `com/acc`
- `prjz-ms-aio/src/main/java/com/prjz` &rarr; `com/acc`
- `prjz-ms-aio/src/test/java/com/prjz` &rarr; `com/acc`

Update package declarations and imports across all Java files:
- Replace `package com.prjz` &rarr; `package com.acc`
- Replace `import com.prjz` &rarr; `import com.acc`
- Replace string references (e.g. `@ComponentScan(basePackages = { "com.acc" })`, `@Modulithic(systemName = "acc")`).

### Step 3: Module & Directory Renaming
Rename module folders:
- `prjz-core` &rarr; `acc-core`
- `prjz-resources` &rarr; `acc-resources`
- `prjz-fw` &rarr; `acc-fw`
- `prjz-db` &rarr; `acc-db`
- `prjz-ms-fs` &rarr; `acc-ms-fs`
- `prjz-ms-identity` &rarr; `acc-ms-identity`
- `prjz-report-engine` &rarr; `acc-report-engine`
- `prjz-ms-worker` &rarr; `acc-ms-worker`
- `prjz-ms-aio` &rarr; `acc-ms-aio`

### Step 4: Maven POMs & Coordinates
- **Root POM (`pom.xml`)**:
  - `<groupId>com.acc</groupId>`
  - `<artifactId>acc</artifactId>`
  - `<modules>`: Update all module paths to `./acc-*`
- **Module POMs (`acc-*/pom.xml`)**:
  - Update `<parent>` coordinates to `com.acc:acc`.
  - Update `<artifactId>acc-*</artifactId>`.
  - Update internal dependencies to `<groupId>${project.groupId}</groupId>` / `acc-*`.

### Step 5: Configuration Files & Resources
Update occurrences of `prjz` to `acc` in:
- `application.yml`, `application.properties` (e.g. `acc-export`, context paths, datasource credentials/names)
- `logback-spring.xml` / logback configs
- MyBatis mapper XMLs (`com.acc.*`)
- Shell scripts (`deployment/`, `start-hsql.sh`)
- Jenkinsfile & build files

---

## Verification Plan

### Automated Tests
1. **Full Reactor Build & Install:**
   ```powershell
   .\mvnw.cmd clean install -DskipTests
   ```
2. **Spring Modulith Verification:**
   ```powershell
   .\mvnw.cmd test -pl acc-ms-aio -Dtest=ModularityTests
   ```
3. **Verify Zero Leftover `com.prjz` references in Source Trees:**
   ```powershell
   Get-ChildItem -Recurse -Include *.java,*.xml,*.yml | Select-String "com.prjz"
   ```
