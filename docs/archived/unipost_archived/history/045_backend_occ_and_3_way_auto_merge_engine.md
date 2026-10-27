# 045: Backend OCC & 3-Way Auto-Merge Engine (Phase 10)

## Problem
In concurrent editing environments (multiple users on Console or mobile outbox background sync), updates often collide. Simple version checking rejects all concurrent saves with HTTP 409 even when editors modify non-overlapping attributes (e.g., tags vs. content), causing frustrating re-edits or accidental Last-Write-Wins overwrites.

## Plan
1. Add `baseAttributes` support to `UpdateRecordRequest` and `PatchRecordRequest` to capture the base state when the client started editing.
2. Implement `autoMergeAttributes` 3-way merge algorithm in `MetadataService` comparing base, current persisted database attributes, and incoming client attributes.
3. Automatically merge non-conflicting mutations on disjoint attributes and increment version cleanly.
4. Raise `MetadataConflictException` (HTTP 409) specifically when true field collisions occur (both changed the same attribute to different values).
5. Verify with automated tests in `MetadataServiceOccAutoMergeTest`.

## Changes
- `apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/UpdateRecordRequest.java`: Added `baseAttributes` with backwards-compatible constructors.
- `apps/backend/acc-fw/src/main/java/com/acc/presentation/dto/metadata/PatchRecordRequest.java`: Added `baseAttributes` with backwards-compatible constructors.
- `apps/backend/acc-fw/src/main/java/com/acc/service/MetadataService.java`: Added `autoMergeAttributes` and wired 3-way auto-merging into `updateEntityRecord` and `patchEntityRecord`.
- `apps/backend/acc-fw/src/test/java/com/acc/service/MetadataServiceOccAutoMergeTest.java`: New comprehensive test suite covering 3-way auto-merging, disjoint edits, collision detection, and version mismatch fallback.
- `apps/backend/acc-fw/src/test/java/com/acc/presentation/MetadataControllerTest.java`: Updated constructor calls.

## Verification
- `.\mvnw.cmd test -pl acc-fw -Dtest="MetadataServiceOccAutoMergeTest,MetadataServiceTest,MetadataControllerTest"`: 62/62 tests passed.
- `pnpm --filter tekgo-ui build`: Succeeded.
- `pnpm --filter @acc/client test`: Passed.
- `pnpm --filter @acc/sandbox test`: Passed.

## Tasks
- [x] Extend UpdateRecordRequest and PatchRecordRequest DTOs
- [x] Implement 3-way merge algorithm in MetadataService
- [x] Integrate merge engine into update and patch record lifecycles
- [x] Add automated unit tests in MetadataServiceOccAutoMergeTest
- [x] Verify monorepo builds and tests

## Enhancement
Phase 11 will introduce the Transactional Outbox Pattern and event publishing in PostgreSQL (`UNIPOST_EVENT_OUTBOX`) with polling jobs in `acc-ms-worker` for at-least-once distributed delivery without two-phase commit overhead.
