# Walkthrough: Add GraalVM Native Image and Leyden (CDS) Support

## Changes Made
1. **Added GraalVM Native Image Profile:**
   - Modified `apps/api/project0-ms-aio/pom.xml` to include a `native` Maven profile.
   - Integrated the `org.graalvm.buildtools:native-maven-plugin` plugin to support AOT compilation.

2. **Created `Dockerfile.native`:**
   - Added a multi-stage Dockerfile located at `apps/api/Dockerfile.native`.
   - Utilizes `ghcr.io/graalvm/native-image-community:17-ol9` to perform the native build.
   - Produces a minimal footprint `oraclelinux:9-micro` container image containing the native executable.

3. **Created `Dockerfile.leyden`:**
   - Added a multi-stage Dockerfile located at `apps/api/Dockerfile.leyden`.
   - Compiles the fat JAR using standard JDK 17.
   - Executes a training run using `-XX:ArchiveClassesAtExit=application.jsa` and `-Dspring.context.exit=onRefresh` to generate a Class Data Sharing (CDS) archive.
   - The final entrypoint utilizes `-XX:SharedArchiveFile=application.jsa` to start the application with significantly reduced startup times and memory footprint, reflecting Project Leyden's goals in Java 17 setups.

## Validation
- Verified the structure and commands of the Dockerfiles and `pom.xml`.
- Preserved the existing Java 17 configuration.
