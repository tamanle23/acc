# Add GraalVM Native Image and Project Leyden Support

This plan outlines the steps to add GraalVM Native Image support for the AIO modulith and create Dockerfiles for different deployment environments (GraalVM Native and Project Leyden/CDS).

## Proposed Changes

### AIO Modulith POM
- Add the `native` profile and `org.graalvm.buildtools:native-maven-plugin` to `apps/api/project0-ms-aio/pom.xml`.

### Dockerfiles
- Create `apps/api/deployment/Dockerfile.native`: Uses a Java 17 GraalVM native-image builder base image to compile the application AOT, and packages the resulting native binary into a minimal runtime image.
- Create `apps/api/deployment/Dockerfile.leyden`: Uses a Java 17 runtime. Leverages Spring Boot's Class Data Sharing (CDS) support to perform a training run (`-XX:ArchiveClassesAtExit`) during the build stage to generate the CDS archive, and uses `-XX:SharedArchiveFile` in the final image for optimized startup performance.

## Verification Plan
- Verify Dockerfiles are successfully created and structurally sound.
