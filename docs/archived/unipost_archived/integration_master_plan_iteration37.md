# Integration Master Plan - Iteration 37: VideoIR Sequence & Track ID Governance, Hierarchical Authoring, and Referential Integrity

## 1. Goal Description
Establish a robust, future-proof identity, naming, and referential integrity model across the entire Video Intermediate Representation (VideoIR) specification, validation pipeline, and authoring engines:
1. **Explicit Identity vs. Display Separation**:
   - `id`: System key strictly enforced as globally unique across the document (`track.id`, `sequence.id`).
   - `name`: Human-readable display label (`track.name`, `sequence.name`), optional string, non-unique (user-editable).
2. **Universal Sequential Authoring Engine (`VideoIRAuthoringEngine`)**:
   - Centralized sequence and track creation engine placed in `@acc/ir` (`packages/ir`) so backend, CLI, and Studio share identical, deterministic ID allocation rules.
   - Low compute overhead (zero-crypto / zero-UUID overhead).
   - **Track-Move & Reorder Immune**: Sequence IDs are **not** bound to volatile track indices. Tracks and sequences can be reordered or moved across tracks freely without breaking sequence IDs or relational DAG links.
   - **Meaningful Fixed Information & Global Monotonic Counters**:
     - Format: `seq_<modality>_<slug>_<globalIndex>` (e.g. `seq_video_city_traffic_1`, `seq_audio_voiceover_2`, `seq_text_title_3`).
     - Modality: Invariant sequence kind (`video`, `audio`, `image`, `text`, `generator`).
     - Slug: Sanitized slug of asset name or clip title (fallback to modality if empty).
     - Global Monotonic Counter: Strictly incrementing high-water mark across all sequence types.
     - Monotonic High-Water Mark: Stored in `doc.meta.nextSequenceIndex` to guarantee counters strictly advance forward even as clips are deleted or dropped over time (with fallback scan `max(existing) + 1` if absent).
   - **Lifecycle ID Handling**:
     - **Razor Split**: Part 1 keeps the original sequence ID (`seq_1`), and Part 2 receives the next global index (`seq_4`). Existing inbound references targeting `seq_1` safely remain attached to Part 1.
     - **Duplicate**: Cloned sequence receives the next global index (`seq_video_city_traffic_5`) and display name `${orig.name || orig.id} (Copy)`.
3. **Strict Validation & Referential Integrity (`VideoIRSchemaValidator`)**:
   - Strict rejection on:
     - Duplicate `track.id` or duplicate `sequence.id` globally across the document.
     - Dangling relational targets (`after`, `syncWith`, `matchLengthOf`, `linkedSequenceId`, `overlapTarget`, `outgoingSeqId`).
     - Self-referencing relational pointers.
   - No silent degradation: schema validation fails fast with explicit, actionable error messages.
4. **Synchronize all 8 VideoIR Components**:
   - Type definitions (`VideoIR.ts`).
   - JSON Schema (`video-ir.schema.json`).
   - High-speed Schema Validator (`VideoIRSchemaValidator.ts`).
   - Specification documentation (`1. video_(IR)_specification.md`).
   - Authoring Engine (`VideoIRAuthoringEngine.ts` in `packages/ir`).
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

### Decision 2: Location and Signature of `VideoIRAuthoringEngine`
- Located in `packages/ir/src/authoring/VideoIRAuthoringEngine.ts` and exported from `@acc/ir`.
- Functions:
  - `allocateNextSequenceId(doc: VideoIRDocument, options: { type: SequenceType; nameOrSlug?: string }): { id: string; nextIndex: number }`
  - `allocateSplitSequenceId(doc: VideoIRDocument, originalSeq: IRSequence): { part1Id: string; part2Id: string; nextIndex: number }`
  - `allocateDuplicateSequenceId(doc: VideoIRDocument, originalSeq: IRSequence): { id: string; nextIndex: number }`
  - `createSequence(options: CreateSequenceOptions): IRSequence`
  - `generateNextTrackId(doc: VideoIRDocument, type: TrackType): string`

### Decision 3: Global Monotonic Counter & Document Metadata
- Monotonic counter is tracked via `doc.meta.nextSequenceIndex` (defaulting to 1 for new projects).
- If `doc.meta.nextSequenceIndex` is missing (legacy document), `VideoIRAuthoringEngine` scans all sequences across all tracks, parses the trailing numerical digits via `_(\d+)$`, and seeds `nextSequenceIndex = max(found_indices, 0) + 1`.
- When an ID is allocated, `doc.meta.nextSequenceIndex` is updated on the document so subsequent operations in the session or future reloads never collide.

### Decision 4: Razor Split & Duplicate Lifecycle
- **Split**:
  - Part 1 keeps `originalSeq.id` (preserving existing dependencies pointing to the head of the clip).
  - Part 2 gets `allocateSplitSequenceId` -> `seq_<modality>_<slug>_<nextGlobalIndex>`.
  - Part 2's start relation is set to `{ after: originalSeq.id, offsetFrames: 0 }`.
  - Part 1's duration is trimmed to `splitFrame - startFrame`; Part 2's duration is `endFrame - splitFrame`.
  - Part 2's display name is set to `${originalSeq.name || originalSeq.id} (Part 2)`.
- **Duplicate**:
  - Cloned sequence gets `seq_<modality>_<slug>_<nextGlobalIndex>`.
  - Name set to `${orig.name || orig.id} (Copy)`.

### Decision 5: Strict Referential Integrity in `VideoIRSchemaValidator`
- In `VideoIRSchemaValidator.validate()`:
  1. `seenSequenceIds = new Set<string>()`: duplicate check across all tracks.
  2. For every sequence with relational start `after`: target must exist in `seenSequenceIds` and `target !== seq.id`.
  3. For every sequence with relational start `syncWith`: target must exist in `seenSequenceIds` and `target !== seq.id`.
  4. For every sequence with relational duration `matchLengthOf` (when !== `'timeline'`): target must exist in `seenSequenceIds` and `target !== seq.id`.
  5. For any modifier `editorial/av_link` with `linkedSequenceId`: target must exist in `seenSequenceIds` and `target !== seq.id`.
  6. For any transition modifier with `overlapTarget` / `outgoingSeqId`: target must exist in `seenSequenceIds` and `target !== seq.id`.
- Any dangling or self-referential pointer results in an immediate validation error returned in `errors` list.

---

## 3. Proposed Implementation Changes

### Component 1: VideoIR Specifications & Core Schema (`packages/ir`)

#### [MODIFY] `packages/ir/src/types/VideoIR.ts`
- Add `name?: string;` to `IRSequence`.
- Add `nextSequenceIndex?: number;` to `VideoIRDocument['meta']`.

#### [MODIFY] `schema/video-ir.schema.json`
- In definition `IRSequence`, add optional `name`:
```json
"name": {
  "type": "string",
  "description": "Optional human-readable sequence display name"
}
```
- In document `meta`, add optional `nextSequenceIndex`:
```json
"nextSequenceIndex": {
  "type": "integer",
  "minimum": 1,
  "description": "Monotonically increasing counter for sequence ID allocation"
}
```

#### [NEW] `packages/ir/src/authoring/VideoIRAuthoringEngine.ts`
- Implement slug sanitization (`toSlug(name)` -> lowercase, alphanumerics, underscores).
- Implement global monotonic ID generator with track-move immunity:
  - `seq_<modality>_<slug>_<globalIndex>`
- Implement track ID generator (`track_v1`, `track_a1`, etc.).

#### [MODIFY] `packages/ir/src/schema/VideoIRSchemaValidator.ts`
- Global sequence ID uniqueness check.
- Referential integrity check for relational start, relational duration, linked audio-video modifiers, and transition overlap targets.

#### [MODIFY] `docs/ir/1. video_(IR)_specification.md`
- Document `id` vs `name` semantics.
- Document ID format and track-move invariance.
- Document Global Uniqueness and Referential Integrity constraints.

---

### Component 2: Studio Commands & UI (`apps/studio`)

#### [MODIFY] `apps/studio/src/lib/commands/SplitSequenceCommand.ts`
- Retain original ID on Part 1.
- Use `VideoIRAuthoringEngine` for Part 2 ID allocation and update `doc.meta.nextSequenceIndex`.
- Set Part 2 display name to `${orig.name || orig.id} (Part 2)`.

#### [MODIFY] `apps/studio/src/lib/commands/DuplicateSequenceCommand.ts`
- Use `VideoIRAuthoringEngine` for new sequence ID allocation and update `doc.meta.nextSequenceIndex`.
- Set duplicate display name to `${orig.name || orig.id} (Copy)`.

#### [MODIFY] `apps/studio/src/lib/commands/AddSequenceCommand.ts` & `AddLinkedAVSequenceCommand.ts`
- Use `VideoIRAuthoringEngine` for sequence ID allocations.

---

## 4. Verification Plan

### Automated Tests
1. **New Test Suite**: `autogenerated-tests/video_ir_identity_and_referential_integrity.test.ts`
   - Rejects duplicate sequence ID on same track and across different tracks.
   - Allows duplicate sequence `name` and duplicate track `name` without error.
   - Rejects dangling `after`, `syncWith`, `matchLengthOf`, `linkedSequenceId`, `overlapTarget`.
   - Rejects self-referential relations (`seq_1` with `after: "seq_1"`).
   - Validates `VideoIRAuthoringEngine` generates monotonic, track-move immune IDs (`seq_video_city_traffic_1`, `seq_audio_bgm_2`) without collisions.
   - Validates that deleting earlier/latest sequences does not reuse indices when `doc.meta.nextSequenceIndex` advances.
   - Validates `SplitSequenceCommand` (part 1 preserves ID, part 2 gets next monotonic index, relationships intact).
   - Validates `DuplicateSequenceCommand` produces 100% schema-valid documents.
2. **Existing Test Suite Parity**:
   - `bun test autogenerated-tests/video_ir_modifier_params_validation.test.ts`
   - `bun test autogenerated-tests/architectural_canvas_and_timeline_decoupling.test.ts`
   - `bun test autogenerated-tests/studio_phase9_dnd_kit_architecture.test.ts`
   - `bun test autogenerated-tests/canonical_pipeline_4_ir.test.ts`
3. **Build Verification**:
   - `pnpm --filter @acc/ir build`
   - `pnpm --filter @acc/studio exec vite build`

### Manual Verification
- In Studio UI:
  - Add clips from asset library, duplicate clips, razor-split clips.
  - Verify sequence IDs are cleanly formatted with modality and slug.
  - Move sequences across tracks and verify IDs and relational links remain rock-solid.
  - Verify Inspector displays both the read-only unique ID and the editable Name.
