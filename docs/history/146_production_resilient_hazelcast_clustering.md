# 146 - Production-Resilient Hazelcast Clustering & Profile-Aware Discovery

## Problem Statement
In change `145`, Hazelcast clustering was configured in standalone loopback mode (`127.0.0.1`, multicast/join disabled) to eliminate a Windows socket exception (`java.net.SocketException: Invalid argument: setsockopt`). However, deploying that configuration directly to a production cluster (Kubernetes, AWS ECS, or multi-VM instances) would cause each container/pod to run in total isolation without discovering peer instances. Under horizontal scaling, metadata schema cache invalidations and distributed state updates would not propagate across nodes, violating distributed cache consistency invariants.

## Plan
1. Make `HazelcastConfiguration.java` profile-aware:
   - Check if `prod` Spring profile is active or `hazelcast.cluster.enabled=true`.
   - In dev/test/sandbox mode: Keep loopback `127.0.0.1`, join disabled, `hazelcast.socket.bind.any=false` for local zero-exception operation.
   - In production mode:
     - If `hazelcast.k8s.service-name` is configured, enable Kubernetes DNS Discovery plugin.
     - If `hazelcast.members` is configured, enable static TCP-IP discovery with member host list.
     - Fallback to safe container/cloud auto-detection with `hazelcast.socket.bind.any=true` and multicast disabled.
2. Update `apps/backend/acc-ms-aio/src/main/resources/application-prod.yml` with production clustering template and properties.
3. Keep `SandboxProperties` registered as `@Component` + `@Primary` so that both component scanning and explicit autowiring cleanly resolve without duplicate or missing bean errors.
4. Verify backend sandbox tests (`pnpm test:backend:sandbox`), Modulith tests (`pnpm test:modulith`), and full live backend launch (`pnpm dev:backend:sandbox`).

## Changes

### 1. `apps/backend/acc-fw/src/main/java/com/acc/boot/config/HazelcastConfiguration.java`
- Injected Spring `Environment` to detect active profiles and configuration properties.
- Added `configureClusteredNetworking(Config config)` and `configureLocalStandaloneNetworking(Config config)`.
- Clustered networking enables Kubernetes Discovery (`service-name`, `namespace`) or static TCP-IP member lists, with `hazelcast.socket.bind.any=true`.
- Local standalone networking safely isolates to loopback `127.0.0.1` with `setsockopt` multicast disabled.

### 2. `apps/backend/acc-ms-aio/src/main/resources/application-prod.yml`
- Added production `hazelcast` cluster configuration section:
  - `hazelcast.cluster.enabled: true`
  - `hazelcast.cluster-name: acc-prod-cluster`
  - Documented Kubernetes and TCP-IP discovery options for DevOps/Helm/K8s manifests.

### 3. `apps/backend/acc-sandbox/src/main/java/com/acc/sandbox/config/SandboxProperties.java` & `SandboxAutoConfiguration.java`
- Scoped `SandboxProperties` with `@Component` and `@Primary` to ensure deterministic single bean injection across all simulator and registry constructors.

## Verification
1. `node apps/backend/mvnw.cjs -pl acc-fw,acc-sandbox,acc-ms-aio compile -q`: Exit 0.
2. `pnpm test:backend:sandbox`: 33/33 tests passed (BUILD SUCCESS).
3. `pnpm --filter @acc/backend test:modulith`: `ModularityTests` passed (BUILD SUCCESS).
4. `pnpm dev:backend:sandbox`:
   - Booted Jetty on port 8000 in 14.8 seconds.
   - Hazelcast successfully bound to `[127.0.0.1]:5701` in standalone mode with 0 `SocketException` errors.
   - Actuator health check `Invoke-RestMethod -Uri 'http://localhost:8000/actuator/health'` returned `status: UP` with `{liveness, readiness}` groups.

## Tasks
- [x] Profile-aware Hazelcast configuration in `HazelcastConfiguration.java`
- [x] Production discovery properties in `application-prod.yml`
- [x] Verification of sandbox tests (33/33) and Modulith architecture
- [x] Verification of live server boot on port 8000 and actuator health UP
