# Walkthrough: Renaming `prjz` to `acc`

## Overview

We successfully refactored and renamed every occurrence of **`prjz`** to **`acc`** across the entire codebase, covering:
- Maven project `groupId` (`com.acc`) and `artifactId` (`acc`)
- Module directory names (`acc-*`)
- Java package structures (`com.acc.*`)
- Spring Modulith configurations and verification tests
- Application configs, resources, MyBatis mappers, Liquibase changelogs, and shell scripts

All 10 modules compile, package, and pass Spring Modulith architecture verification with **`BUILD SUCCESS`**.

---

## Changes Summary

### 1. Directory & Module Renaming
All 9 Maven submodule directories were renamed:
- `prjz-core` &rarr; `acc-core`
- `prjz-resources` &rarr; `acc-resources`
- `prjz-fw` &rarr; `acc-fw`
- `prjz-db` &rarr; `acc-db`
- `prjz-ms-fs` &rarr; `acc-ms-fs`
- `prjz-ms-identity` &rarr; `acc-ms-identity`
- `prjz-report-engine` &rarr; `acc-report-engine`
- `prjz-ms-worker` &rarr; `acc-ms-worker`
- `prjz-ms-aio` &rarr; `acc-ms-aio`

Resource directories and scripts:
- `acc-db/src/main/resources/db/acc/`
- `acc-db/src/main/resources/db/acc_old/`
- `acc-db/src/main/resources/liquibase_local_acc.properties`
- `deployment/acc.sh`

### 2. Java Package Structure
All Java package roots across all modules moved from:
`com/prjz/...` &rarr; `com/acc/...`

Every `.java` file was updated:
- `package com.acc.*`
- `import com.acc.*`
- `@ComponentScan(basePackages = { "com.acc" })`
- `@Modulithic(systemName = "acc", useFullyQualifiedModuleNames = true)`
- Byte-order mark (BOM) was cleanly stripped to ensure standard Java UTF-8 compilation.

### 3. Maven POM Files
- **Root POM (`pom.xml`)**:
  - `<groupId>com.acc</groupId>`
  - `<artifactId>acc</artifactId>`
  - Module references updated to `./acc-*`
- **Module POMs (`acc-*/pom.xml`)**:
  - Parent coordinates updated to `com.acc:acc`
  - Artifact IDs updated to `acc-*`
  - Internal dependencies updated to reference `${project.groupId}:acc-*`

### 4. Configuration & Resources
Updated all references to `acc` in:
- `application.yml` and `application-local.yml`
- MyBatis mapper XMLs (`com.acc.*` namespaces and result types)
- `logback.xml` and `logback-local.xml`
- Liquibase changelogs and database scripts

---

## Verification Results

### 1. Full Reactor Clean Install
```bash
.\mvnw.cmd clean install -DskipTests
```
```
[INFO] ------------------------------------------------------------------------
[INFO] Reactor Summary for acc 1.0.0-SNAPSHOT:
[INFO] 
[INFO] acc ........................................... SUCCESS [  0.272 s]
[INFO] acc-core ...................................... SUCCESS [  2.390 s]
[INFO] acc-resources ................................. SUCCESS [  0.841 s]
[INFO] acc-fw ........................................ SUCCESS [  3.090 s]
[INFO] acc-db ........................................ SUCCESS [  1.196 s]
[INFO] acc-ms-fs ..................................... SUCCESS [  6.412 s]
[INFO] acc-ms-identity ............................... SUCCESS [  2.202 s]
[INFO] acc-report-engine ............................. SUCCESS [  2.683 s]
[INFO] acc-ms-worker ................................. SUCCESS [  2.102 s]
[INFO] acc-ms-aio .................................... SUCCESS [  3.513 s]
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] Total time:  24.921 s
```

### 2. Spring Modulith Architecture Verification Test
```bash
.\mvnw.cmd test -pl acc-ms-aio -Dtest=ModularityTests
```
```
[INFO] Running com.acc.aio.ModularityTests
=== Spring Modulith Application Modules ===
# Controller
> Logical name: com.acc.aio.controller
> Base package: com.acc.aio.controller
> Excluded packages: none
> Spring beans:
  + com.acc.aio.controller.GlobalBindingInitializer
  + com.acc.aio.controller.RemoteController

[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 1.264 s -- in com.acc.aio.ModularityTests
[INFO] BUILD SUCCESS
```
