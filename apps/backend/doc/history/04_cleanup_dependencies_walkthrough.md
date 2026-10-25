# Walkthrough: Backend Dependencies Cleanup

## Changes Made
- Performed a surgical cleanup of `apps/backend/acc-ms-worker/pom.xml`.
- Removed `spring-boot-starter-thymeleaf` and `nekohtml` as the worker module does not use Thymeleaf to render views.
- Removed `spring-cloud-loadbalancer` as there is no client-side load balancing occurring within the worker jobs.

## Verification
- Note: Static analysis (`dependency:analyze`) flagged multiple required dependencies such as JDBC drivers (`mariadb-java-client`, `hsqldb`) and Spring Boot auto-configuration starters (`spring-boot-starter-batch`, `spring-boot-starter-quartz`) as "unused declared". These are false positives due to the runtime nature of Java drivers and Spring's auto-configuration reflection. They were carefully retained to prevent breaking database connectivity and batch job logic.
- Compiled the `acc-ms-worker` module successfully using `node mvnw.cjs -pl acc-ms-worker clean compile -DskipTests` to ensure the classpath remains healthy and no required compile-time code was lost.
