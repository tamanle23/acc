# Walkthrough 16: Embedded Hazelcast Schema Cache Migration (Phase 1)

## Overview
Migrated the schema caching layer in `@acc/backend` (`acc-fw`) from Redis L2 caching to **Embedded Hazelcast** with local Near Cache. This delivers ultra-low latency, zero external cache dependencies for local runs, and distributed cache coherence.

## Changes Made

### 1. Embedded Hazelcast Configuration
- **File**: [`apps/backend/acc-fw/src/main/java/com/acc/boot/config/HazelcastConfiguration.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/boot/config/HazelcastConfiguration.java)
- Configured embedded `HazelcastInstance` bean with:
  - Map `metadata-schemas` with 3600-second TTL and LRU eviction.
  - Near Cache with `OBJECT` in-memory format for fast local lookups without serialization overhead.
  - Standalone/multicast configuration resilient to network topology.

### 2. Schema Validation Service
- **File**: [`apps/backend/acc-fw/src/main/java/com/acc/service/SchemaValidationService.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/SchemaValidationService.java)
- Replaced `RedisTemplate` with `HazelcastInstance.getMap("metadata-schemas")`.
- Dynamic JSON Schema compilation stores compiled schema string in Hazelcast `IMap<String, String>` with fallback to local L1 in-memory `ConcurrentHashMap` for `JsonSchema` instances.

### 3. Metadata Cache Invalidation Listener
- **File**: [`apps/backend/acc-fw/src/main/java/com/acc/service/MetadataCacheListener.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/main/java/com/acc/service/MetadataCacheListener.java)
- Listens for `AttributeDefinitionUpdatedEvent` and evicts versioned keys (`schema:{id}:*`) and base keys from both L1 memory and the Hazelcast `IMap`.

### 4. Unit and Slice Tests
- **Files**:
  - [`apps/backend/acc-fw/src/test/java/com/acc/service/SchemaValidationServiceTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/test/java/com/acc/service/SchemaValidationServiceTest.java)
  - [`apps/backend/acc-fw/src/test/java/com/acc/service/MetadataCacheListenerTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-fw/src/test/java/com/acc/service/MetadataCacheListenerTest.java)
- Replaced Redis mocks with Hazelcast `IMap` and `HazelcastInstance` mocks; verified cache hit/miss flows and eviction paths.

## Verification Results
- `node mvnw.cjs test '-Dtest=SchemaValidationServiceTest,MetadataCacheListenerTest' -pl :acc-fw`: **BUILD SUCCESS** (7/7 tests pass).
- `node mvnw.cjs test`: **BUILD SUCCESS** (Full reactor build, all 10 modules pass).
