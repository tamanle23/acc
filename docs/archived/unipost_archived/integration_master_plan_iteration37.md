# Integration Master Plan - Iteration 37: VideoIR Sequence & Track ID Governance, Hierarchical Authoring, and Referential Integrity

## 1. Goal Description
Establish a robust, future-proof identity and naming model across the entire Video Intermediate Representation (VideoIR) specification, validation pipeline, and Studio authoring engine:
1. **Explicit Identity vs. Display Separation**:
   - `id`: System key strictly enforced as globally unique across the document (`track.id`, `sequence.id`).
   - `name`: Human-readable display label (`track.name`, `sequence.name`), optional string, non-unique (can be renamed by user).
2. **Lightweight Hierarchical Sequential Authoring Engine (`VideoIRAuthoringEngine`)**:
   - Centralized sequence and track creation factory.
   - Low compute overhead (no UUID/nanoid overhead). Generates deterministic, human-readable, tree-scoped sequential IDs based on the track hierarchy:
     - Tracks: `track_v1`, `track_v2`, `track_a1`, `track_a2`, `track_tt1` (timed text), `track_d1` (data).
     - Sequences: Children of tracks, sequentially numbered based on track prefix: e.g. `seq_v1_1`, `seq_v1_2`, `seq_a1_1`.
     - Collision-resistant: Scans document tree to pick `max(existing_index) + 1` so deletions or splits never cause collisions.
3. **Strict Validation & Referential Integrity (`VideoIRSchemaValidator`)**:
   - Reject duplicate `track.id` and duplicate `sequence.id` globally across the document.
   - Reject dangling relational targets (`after`, `syncWith`, `matchLengthOf`, `linkedSequenceId`, `overlapTarget`, `outgoingSeqId`).
   - Reject self-referencing relational pointers.
4. **Synchronize all 8 VideoIR Components**:
   - Type definitions (`VideoIR.ts`).
   - JSON Schema (`video-ir.schema.json`).
   - High-speed Schema Validator (`VideoIRSchemaValidator.ts`).
   - Specification documentation (`1. video_(IR)_specification.md`).
   - Relational DAG Compiler (`RelationalDAGCompiler.ts`).
   - Studio State Manager & Commands (`irState.ts`, `SplitSequenceCommand`, `DuplicateSequenceCommand`, presets).
   - Automated test suite.

---

## 2. Architectural Decisions & Requirements

### Decision 1: `id` vs `name`
- **`track.id`**: Mandatory unique string. Used for routing, layering, containment, and selection.
- **`track.name`**: Optional display string (e.g. `"V1: Primary Plate"`). Non-unique.
- **`sequence.id`**: Mandatory globally unique string across the entire VideoIR document. Used by the Relational DAG Compiler (`after`, `syncWith`, `matchLengthOf`), A/V Linking (`editorial/av_link`), Transitions (`overlapTarget`), and Flat Resolution Maps (`ResolvedTimeline.sequences`).
- **`sequence.name`**: Optional display string (e.g. `"Cyberpunk Metropolis Highway"`). Non-unique. Formalized in `IRSequence` type and `video-ir.schema.json`.

### Decision 2: Hierarchical Sequential ID Generation (`VideoIRAuthoringEngine`)
- Instead of compute-heavy random strings or UUIDs, authoring uses structured sequential numbering derived from track type and position in tree:
  - Format: `seq_<trackIdShort>_<sequenceIndex>` (e.g., track `track_v1` -> `seq_v1_1`, `seq_v1_2`, `seq_v1_3`).
  - For splits: `seq_v1_1_s1`, `seq_v1_1_s2`.
  - For duplicates: `seq_v1_1_c1`.
- The engine guarantees $O(N)$ inspection of existing IDs to compute `nextSeqIndex = max(existing) + 1`.

### Decision 3: Referential Integrity in `VideoIRSchemaValidator`
- In addition to structural and duplicate-ID checks, `VideoIRSchemaValidator.validate()` validates the relational integrity:
  1. `seenSeqIds = new Set<string>()`: duplicate check across all tracks.
  2. For every sequence with relational start `after`: target must exist in `seenSeqIds` and `target !== seq.id`.
  3. For every sequence with relational start `syncWith`: target must exist in `seenSeqIds` and `target !== seq.id`.
  4. For every sequence with relational duration `matchLengthOf` (when !== `'timeline'`): target must exist in `seenSeqIds` and `target !== seq.id`.
  5. For any modifier `editorial/av_link` with `linkedSequenceId`: target must exist in `seenSeqIds` and `target !== seq.id`.
  6. For any transition modifier with `overlapTarget` / `outgoingSeqId`: target must exist in `seenSeqIds` and `target !== seq.id`.

---

## 3. Proposed Changes

### Component 1: VideoIR Specifications & Core Schema (`packages/ir`)

#### [MODIFY] `packages/ir/src/types/VideoIR.ts`
- Add `name?: string;` to `IRSequence`.
```typescript
export interface IRSequence {
  id: string;
  name?: string; // Optional human-readable display label
  type: SequenceType;
  assetId?: string;
  ...
}
```

#### [MODIFY] `schema/video-ir.schema.json`
- In definition `IRSequence`, add optional `name`:
```json
"name": {
  "type": "string",
  "description": "Optional human-readable sequence display name"
}
```

#### [MODIFY] `packages/ir/src/schema/VideoIRSchemaValidator.ts`
- Add `seenSequenceIds = new Set<string>()`.
- In sequence loop:
  - If `seenSequenceIds.has(seq.id)`: report error with track and sequence index.
  - If `seq.name !== undefined && typeof seq.name !== 'string'`: report error.
  - Record sequence references in a collection for pass-2 referential integrity check.
- In Pass 2:
  - Verify every relational reference (`after`, `syncWith`, `matchLengthOf`, `linkedSequenceId`, `overlapTarget`, `outgoingSeqId`) exists in `seenSequenceIds` and does not equal `seq.id`.

#### [MODIFY] `docs/ir/1. video_(IR)_specification.md`
- Document `id` vs `name` semantics for tracks and sequences.
- Formally document the Global Uniqueness Invariant and Referential Integrity constraints.

---

### Component 2: Hierarchical Authoring Engine & Studio Commands (`apps/studio`)

#### [NEW] `apps/studio/src/lib/ir/VideoIRAuthoringEngine.ts`
- Implements:
  - `generateNextTrackId(doc: VideoIRDocument, type: TrackType): string`
  - `generateNextSequenceId(doc: VideoIRDocument, targetTrackId: string): string`
  - `generateSplitSequenceId(doc: VideoIRDocument, originalSeqId: string): string`
  - `generateDuplicateSequenceId(doc: VideoIRDocument, originalSeqId: string): string`
  - `createSequence(options: CreateSequenceOptions): IRSequence`
- Fast, zero-allocation/zero-crypto sequential counter logic.

#### [MODIFY] `apps/studio/src/lib/commands/SplitSequenceCommand.ts`
- Use `VideoIRAuthoringEngine.generateSplitSequenceId(doc, originalSeq.id)` instead of `Date.now()`.
- Populate `newSeq.name` with `${originalSeq.name || originalSeq.id} (Part 2)`.

#### [MODIFY] `apps/studio/src/lib/commands/DuplicateSequenceCommand.ts`
- Use `VideoIRAuthoringEngine.generateDuplicateSequenceId(doc, orig.id)` instead of `Math.random()`.
- Populate `cloned.name` with `${orig.name || orig.id} (Copy)`.

#### [MODIFY] `apps/studio/src/lib/commands/AddLinkedAVSequenceCommand.ts` & Ingestion Handlers
- Use `VideoIRAuthoringEngine` to generate coordinated sequential video and audio IDs (e.g., `seq_v1_3` and `seq_a1_3`) with reciprocal `linkedSequenceId` references.

---

## 4. Verification Plan

### Automated Tests
1. **New Test Suite**: `autogenerated-tests/video_ir_identity_and_referential_integrity.test.ts`
   - Rejects duplicate sequence ID on same track.
   - Rejects duplicate sequence ID across different tracks.
   - Allows duplicate sequence `name` and duplicate track `name` without error.
   - Rejects dangling `after`, `syncWith`, `matchLengthOf`, `linkedSequenceId`, `overlapTarget`.
   - Rejects self-referential relations (`seq_1` with `after: "seq_1"`).
   - Validates `VideoIRAuthoringEngine` generates sequential, tree-structured IDs (`seq_v1_1`, `seq_v1_2`, `seq_a1_1`) without collisions.
   - Validates `SplitSequenceCommand` and `DuplicateSequenceCommand` produce 100% schema-valid documents.
2. **Existing Test Suite Parity**:
   - `bun test autogenerated-tests/video_ir_modifier_params_validation.test.ts`
   - `bun test autogenerated-tests/architectural_canvas_and_timeline_decoupling.test.ts`
   - `bun test autogenerated-tests/studio_phase9_dnd_kit_architecture.test.ts`
   - `bun test autogenerated-tests/canonical_pipeline_4_ir.test.ts`
3. **Build Verification**:
   - `pnpm --filter @acc/ir build`
   - `pnpm --filter @acc/studio exec vite build`

### Manual Verification
- In Studio UI, drop clips from preset library, duplicate clips, and razor-split clips:
  - Verify that sequence IDs remain cleanly formatted, human-readable, and sequential.
  - Verify that inspector displays both the unique ID and the editable Name.
