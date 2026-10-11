# Walkthrough - Backend OCC & 3-Way Auto-Merge Engine (Phase 10)

## Summary of Changes
Implemented a robust 3-way auto-merging engine into `unipost-fw` metadata service that resolves non-conflicting concurrent edits on disjoint attributes while strictly detecting true attribute collisions and preventing silent Last-Write-Wins overwrites.

### 1. DTO Enhancements
- Added `baseAttributes` field and backward-compatible overloaded constructors to [`UpdateRecordRequest.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/presentation/dto/metadata/UpdateRecordRequest.java) and [`PatchRecordRequest.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/presentation/dto/metadata/PatchRecordRequest.java).

### 2. 3-Way Auto-Merge Engine
- Added `autoMergeAttributes(base, current, incoming)` to [`MetadataService.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/service/MetadataService.java):
  - Resolves mutations across disjoint fields seamlessly without failing the transaction.
  - Detects true field collisions (both modified the same field to different values) and throws [`MetadataConflictException`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/main/java/com/unipost/service/exception/MetadataConflictException.java) (HTTP 409).
  - Integrates into `updateEntityRecord` and `patchEntityRecord`.

### 3. Automated Unit Tests
- Created [`MetadataServiceOccAutoMergeTest.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/unipost-fw/src/test/java/com/unipost/service/MetadataServiceOccAutoMergeTest.java):
  - Verified disjoint auto-merge across server updates and client edits.
  - Verified true collision throwing 409 conflict exception.
  - Verified version mismatch handling.

## Verification Results
- `.\mvnw.cmd test -pl unipost-fw -Dtest="MetadataServiceOccAutoMergeTest,MetadataServiceTest,MetadataControllerTest"`: 62/62 tests passed.
- `pnpm --filter tekgo-ui build`: Next.js 15 build passed (95 static/dynamic pages).
- Package test suites (`@unipost/client`, `@unipost/sandbox`): All passed.
