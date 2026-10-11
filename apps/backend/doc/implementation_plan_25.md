# Implementation Plan - Backend OCC & 3-Way Auto-Merge Engine (Phase 10)

## Problem Statement
When mobile operators and web console editors collaborate on dynamic metadata records (e.g. articles or custom entities), concurrent edits previously led to either blind Last-Write-Wins (LWW) data loss or rigid optimistic lock failures (HTTP 409) even when the concurrent edits touched completely disjoint attributes (such as editor A modifying `category` and editor B modifying `content`).

## Architecture & Implementation Overview
1. **Optimistic Locking**:
   - `BaseModel` manages `@Version private Long version` mapped across all entity records in `UNIPOST_ENTITIES`.
   - Incoming mutations specify `Long version` alongside mutated attributes.
2. **3-Way Auto-Merge Engine (`autoMergeAttributes`)**:
   - Compares:
     - `base`: original record attributes loaded by the client.
     - `current`: active persisted attributes in the database.
     - `incoming`: new mutation payload submitted by the client.
   - For every attribute:
     - If client changed and server did not $\to$ accept client change.
     - If server changed and client did not $\to$ preserve server change.
     - If both changed to identical value $\to$ accept change.
     - If both changed to different values $\to$ throw `MetadataConflictException` (HTTP 409) identifying the colliding field.
3. **DTO Enhancements**:
   - Extended `UpdateRecordRequest` and `PatchRecordRequest` with optional `Map<String, Object> baseAttributes` while preserving backwards-compatible constructors.

## Verification
- Comprehensive test suite in `MetadataServiceOccAutoMergeTest`:
  - Disjoint attribute auto-merging verified.
  - Same-attribute conflict exception verified.
  - Optimistic locking without base attributes verifies 409 rejection.
- All 62 unit and integration tests across `MetadataControllerTest`, `MetadataServiceTest`, and `MetadataServiceOccAutoMergeTest` passed.
