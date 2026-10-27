# Implementation Plan: Video IR Spec Modernization (Sequence Types, Global Modifiers, Explicit Targets, Dual Blend Modes & Modular Modifier Schema)

This plan details the full 8-component synchronization across the Video IR architecture to implement sequence typing, global-level modifier chains, explicit modifier targeting, dual-level blend modes, and a modular JSON schema for modifier plugins.

---

## Goal Description
Modernize the **Video IR Specification (V1.0-Stable)** to eliminate ambiguity, provide strict semantic validation, and enable modular extensibility:
1. **Explicit Sequence Types**: Add strictly required `type: 'video' | 'image' | 'audio' | 'text' | 'overlay'` to `IRSequence` with enforced track-containment compatibility.
2. **Global Document-Level Modifiers**: Add `modifiers?: ModifierNode[]` at the root `VideoIRDocument` level for master color grading, global camera shake, ambient weather, and master audio limiting.
3. **Explicit Modifier Targeting**: Add strictly required `target: SequenceType | SequenceType[]` to `ModifierNode` to guarantee that modifiers can only reside on tracks and sequences of matching domain.
4. **Dual-Level Blend Modes**: Support `blendMode` (`'normal' | 'screen' | 'multiply' | 'overlay' | 'add'`) on both `IRSequence` and `IRTrack`, where sequence-level blending overrides track-level defaults.
5. **Modular Schema Architecture**: Decouple modifier definitions into an independent `schema/modifiers.schema.json` and `packages/ir/src/types/modifiers.ts`, allowing new plugins to be added without modifying the core Video IR topology schema.

---

## User Review Required

> [!IMPORTANT]
> **Breaking Schema Migration Notice**:
> Per the user's explicit design choice, `type: SequenceType` on `IRSequence` and `target: SequenceType | SequenceType[]` on `ModifierNode` are **strictly required with no fallback**.
> - Every mock sequence and modifier in existing test fixtures, demo projects, and staging presets will be updated to include these required properties.
> - The validator will reject any sequence or modifier missing these fields or violating track-containment rules.

> [!NOTE]
> **Track-to-Sequence Strict Compatibility Matrix**:
> | Sequence Type (`seq.type`) | Permitted Track Types (`track.type`) |
> | :--- | :--- |
> | `video`, `image`, `overlay` | `video` tracks ONLY |
> | `audio` | `audio` tracks ONLY |
> | `text` | `timed_text` tracks ONLY |
> 
> A modifier with `target` can only be placed on a sequence or track whose type matches at least one target in `modifier.target`.

---

## Open Questions
All key architectural questions were resolved during `/grill-me`:
1. `seq.type`: Strictly required everywhere.
2. `modifier.target`: Strictly required as `SequenceType | SequenceType[]`.
3. `doc.modifiers`: Evaluated as a post-composition master pass (visual canvas & master audio buffer).
4. `blendMode`: Dual-level (`IRSequence.blendMode` overrides `IRTrack.blendMode`).
5. Modular schema: Separate `schema/modifiers.schema.json` referenced by `schema/video-ir.schema.json`.

---

## Proposed Changes

```
┌────────────────────────────────────────────────────────┐
│               schema/video-ir.schema.json              │
│       (Core Topology: Meta, Tracks, Sequences)         │
└──────────────────────────┬─────────────────────────────┘
                           │ $ref
                           ▼
┌────────────────────────────────────────────────────────┐
│               schema/modifiers.schema.json             │
│    (Modular Plugin Registry: Params & Discriminators)  │
└────────────────────────────────────────────────────────┘
```

---

### Component 1: Video IR Core Types & Modular Modifier Types

#### [NEW] `packages/ir/src/types/modifiers.ts`
Define standard modifier parameter interfaces, target mappings, and the discriminated union:
- `TransformModifierParams`
- `Depth3DModifierParams`
- `Camera3DModifierParams`
- `ColorGradingModifierParams`
- `ParticleVfxModifierParams`
- `HologramHudModifierParams`
- `TextStyleModifierParams`
- `VolumeModifierParams`
- `PanModifierParams`
- `FilterModifierParams`
- `PitchModifierParams`
- `DynamicDuckingModifierParams`
- `SplitEditModifierParams`
- `TransitionModifierParams`
- `ProceduralSfxModifierParams`
- `StandardModifierNode` & `CustomModifierNode`

#### [MODIFY] `packages/ir/src/types/VideoIR.ts`
- Export `SequenceType = 'video' | 'image' | 'audio' | 'text' | 'overlay'`.
- Export `BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add'`.
- Update `IRSequence`:
  ```ts
  export interface IRSequence {
    id: string;
    type: SequenceType; // Strictly required
    assetId?: string;
    compositionId?: string;
    activeStreams?: string[];
    time: SequenceTime;
    blendMode?: BlendMode; // Dual-level sequence override
    cues?: TimedTextCue[];
    modifiers?: ModifierNode[];
  }
  ```
- Update `ModifierNode`:
  ```ts
  export interface ModifierNode<TParams = Record<string, unknown>> {
    type: string;
    target: SequenceType | SequenceType[]; // Strictly required
    params: TParams;
  }
  ```
- Update `VideoIRDocument`:
  ```ts
  export interface VideoIRDocument {
    version: string;
    meta: IRMeta;
    assets?: Record<string, AssetDefinition>;
    modifiers?: ModifierNode[]; // Global document-level modifier chain
    tracks: IRTrack[];
  }
  ```
- Update `ResolvedSequence` and `ResolvedTimeline` to include `type` and `blendMode`.

---

### Component 2: JSON Schema Definitions (Draft-07)

#### [NEW] `schema/modifiers.schema.json`
Independent schema file containing definitions for all standard modifier nodes, their `target` validation, and typed parameters.

#### [MODIFY] `schema/video-ir.schema.json`
- Add `SequenceType` definition: `{"enum": ["video", "image", "audio", "text", "overlay"]}`.
- Make `type` required in `IRSequence`.
- Add `blendMode` to `IRSequence`.
- Add `modifiers` to `VideoIRDocument` root schema.
- Reference `ModifierNode` from `modifiers.schema.json#/definitions/ModifierNode` or define it with required `target`.

---

### Component 3: Runtime Validator & SerDe

#### [MODIFY] `packages/ir/src/schema/VideoIRSchemaValidator.ts`
- Update `validate()` to enforce:
  1. `seq.type` is present and valid `SequenceType`.
  2. Track-sequence compatibility:
     - `track.type === 'video'` -> sequences must be `video`, `image`, or `overlay`.
     - `track.type === 'audio'` -> sequences must be `audio`.
     - `track.type === 'timed_text'` -> sequences must be `text`.
  3. `modifier.target` is present and valid `SequenceType` or array of `SequenceType`.
  4. Track-modifier target compatibility: Modifier on track or sequence must target a sequence type compatible with that track.
  5. Validate root `doc.modifiers` array if present.
  6. Validate optional `seq.blendMode` values.

---

### Component 4: Adapters & Compilers

#### [MODIFY] `packages/ir/src/adapters/StoryConfigToUniversalIRAdapter.ts`
- Populate `type: 'video'` for video clips, `type: 'audio'` for BGM/voiceover, `type: 'text'` for subtitles.
- Populate `target` for all created modifiers.

#### [MODIFY] `packages/ir/src/adapters/PipelineIRToUniversalIRAdapter.ts`
- Populate `type` on converted sequences and `target` on all converted modifiers.

#### [MODIFY] `packages/ir/src/compiler/RelationalDAGCompiler.ts`
- Propagate `type` and `blendMode` from `IRSequence` into `ResolvedSequence`.
- Store `modifiers` from `doc.modifiers` onto `ResolvedTimeline`.

---

### Component 5: Plugins & Master Renderer

#### [MODIFY] `packages/ir/src/plugins/` (All 12 plugins)
- Update plugins to specify their native default `target: SequenceType | SequenceType[]`.
- Update `ModifierPlugin` interface in `ModifierPluginRegistry.ts` to include `readonly defaultTarget: SequenceType | SequenceType[]`.

#### [MODIFY] `packages/ir/src/renderer/IRMasterRenderer.ts`
- Execute root `doc.modifiers` (or `timeline.modifiers`) in the post-composition master pass:
  - Visual global modifiers rendered over the final frame canvas.
  - Audio global modifiers rendered on the mixed master audio buffer.
- Respect `seq.blendMode` when compositing clips.

---

### Component 6: Studio Integration & Staging Presets

#### [MODIFY] `apps/studio/src/lib/library/stagingPresets.ts`
- Ensure all 15 staging presets include explicit `type` in their `createSequence` outputs:
  - Text presets: `type: 'text'`
  - Shape presets: `type: 'overlay'` (or `'image'`)
  - Regional VFX: `type: 'overlay'`
  - Full-screen overlays: `type: 'overlay'`
  - Audio/SFX presets: `type: 'audio'`
- Ensure all attached modifiers have explicit `target`.

#### [MODIFY] `apps/studio/src/lib/ir/irState.ts` & `RightSidebar.tsx`
- Ensure `addModifier`, `updateModifier`, and `addSequence` always assign explicit `target` and `type`.
- Expose `blendMode` dropdown in `SequenceMetaCard` in `RightSidebar.tsx`.

---

### Component 7: Documentation & Specifications

#### [MODIFY] `docs/ir/1. video_(IR)_specification.md`
- Document the 5 sequence types and track compatibility rules.
- Document `ModifierNode.target` semantics and array targets.
- Document global document modifiers (`doc.modifiers`).
- Document dual-level `blendMode` cascade.
- Document the modular `modifiers.schema.json` architecture.

#### [MODIFY] `docs/SYSTEM_ARCHITECTURE_DOCUMENT.md`
- Synchronize system architecture diagrams and topology sections with the new spec.

---

### Component 8: Testing Suite

#### [NEW] `autogenerated-tests/video_ir_spec_modernization.test.ts`
Comprehensive verification suite:
1. Validates strict requirement of `seq.type` and track compatibility.
2. Validates strict requirement of `modifier.target` and track domain matching.
3. Validates root `doc.modifiers` schema validation and master pass compilation.
4. Validates sequence-level `blendMode` overriding track-level `blendMode`.
5. Validates modular schema loading (`video-ir.schema.json` + `modifiers.schema.json`).
6. Verifies SerDe roundtrip and full topological DAG compilation.

#### [MODIFY] Update existing tests
- Update test fixtures across `autogenerated-tests/` (e.g. `studio_*.test.ts`, `ir_*.test.ts`, `enterprise_*.test.ts`) that instantiate `mockDoc` or mock sequences to supply explicit `type` and `target`.

---

## Verification Plan

### Automated Tests
1. **New Spec Modernization Suite**:
   ```powershell
   bun test autogenerated-tests/video_ir_spec_modernization.test.ts
   ```
2. **IR Package Tests**:
   ```powershell
   bun test packages/ir
   ```
3. **Studio Regression Suite**:
   ```powershell
   bun test autogenerated-tests/studio
   ```
4. **Full Test Suite**:
   ```powershell
   bun test autogenerated-tests/
   ```
5. **Production Build**:
   ```powershell
   bun run studio:build
   ```

### Manual Verification
- Launch Studio (`bun run studio:dev`), select an overlay sequence, change its `blendMode`, inspect that its modifiers display proper targets, and verify canvas compositing.
