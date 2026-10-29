# Master Implementation Plan — Iteration 48: Studio Architecture Remediation, Zero-Leak Memory Safety & State Integrity

**Document Status:** Complete & Verified  
**Date:** 2026-10-29  
**Target:** `@acc/studio` (ACC Dedicated React 19 NLE Studio Application)  
**Standard:** Enterprise Clean Coder, SOLID Principles, W3C WebCodecs / Web Audio Memory Hygiene  

---

## 1. Executive Summary & Problem Formulation

A comprehensive systems audit of `apps/studio` revealed fundamental design loopholes, competing memory ownership mechanisms, and uncoordinated event loops:

1. **Competing Bitmap Lifecycle Ownership:**
   `preview.worker.ts` (`safeSetTexture`) blindly calls `.close()` on overwritten textures while `PreviewFrameMemoryManager` simultaneously holds references in its LRU cache. When scrubbing backward, the memory manager serves closed (detached) bitmaps (`width === 0`), causing silent frame blit failures and WebCodecs pipeline thrashing.
2. **Abandoned In-Flight Promises on Coordinator Reset:**
   `PreviewWorkerCoordinator.reset()` drops `this.activeTasks` without resolving or rejecting pending promises, leaving calling threads stranded in memory forever.
3. **Uncoordinated Global Keyboard Shortcuts:**
   Five distinct components listen to `window.addEventListener('keydown')` simultaneously. `useShuttleEngine.ts` captures `KeyK` unconditionally (breaking `Cmd+K` razor split), while `Timeline.tsx` and `usePreviewHotkeys.ts` concurrently trigger conflicting delete handlers on `Delete`/`Backspace`.
4. **Asynchronous DAG Compilation Race Condition:**
   `IRStateManager.dispatch()` updates `state.doc` and fires an un-awaited asynchronous DAG compilation. Rapid slider scrubbing or drag edits spawn multiple concurrent compilations where a slower, older compilation can finish last and overwrite newer timeline state.
5. **Decoupling Failure in 60 FPS Playhead Animation:**
   `useShuttleEngine.ts` throttles its RAF tick to 66ms (~15 Hz) before notifying `onScrub()`. Because `onScrub()` is the sole trigger for `StudioPlayheadController.seek()`, high-frequency direct canvas and needle subscribers stutter at 15 FPS instead of animating at 60 FPS.
6. **Dual Command Systems & Pervasive Heavy Serialization:**
   `TimelineCommandDispatcher` retains an unbounded `history` array without undo/redo, duplicating `HistoryManager`. Over 60 occurrences of synchronous `JSON.parse(JSON.stringify(doc))` exist across command executions, bypassing `cloneIR()` and causing severe GC pressure during 60 FPS interactions.
7. **Audio RAM Blowup & Dual Unshared AudioContexts:**
   `AudioAssetCache` holds uncompressed Float32Array PCM buffers in RAM instead of leveraging OPFS (`ContentCacheRegistry`), while instantiating an unshared `AudioContext` alongside `WebAudioEngine`.

---

## 2. Architectural Trade-Off Matrices

| Dimension | Option A: Ad-Hoc Hotfixes | Option B: Full Application Rewrite | Option C: Phased Architecture Remediation [Selected] |
|---|---|---|---|
| **Memory Ownership** | Monkey-patch `.close()` checks in worker. | Rebuild worker and memory manager from scratch. | **Single Ownership in `PreviewFrameMemoryManager`**: `safeSetTexture` becomes a pure reference setter; `PreviewFrameMemoryManager` exclusively governs LRU eviction and synchronous disposal. |
| **Keyboard Management** | Add boolean guards in each component's keydown listener. | Replace with heavy third-party shortcut framework. | **Centralized `StudioKeyboardManager` with Priority Routing**: Modal > Focused Surface/Tool > Transport > Global Workspace, with strict modifier key guards. |
| **State Compilation** | Fire-and-forget background compiles with optimistic flags. | Complete synchronous redesign of DAG compiler. | **Two-Tier Compilation Guard**: UI busy/compiling indicator + awaitable `dispatch(): Promise<void>` backed by an internal sequential execution lock. |
| **Playhead Motion** | Run full React state updates at 60 FPS (severe CPU load). | Keep 15 FPS throttle everywhere (noticeable stutter). | **60 FPS RAF Needle/Canvas Decoupling**: RAF loop calls `StudioPlayheadController.seek()` on every tick (60 FPS) while keeping React state updates throttled to 10–15 Hz. |
| **Audio Cache Architecture** | Retain all decoded PCM in memory (RAM blowup). | Stream raw network audio without caching (high latency). | **OPFS-First Streaming via `ContentCacheRegistry`**: Decoded chunks are fetched/streamed on demand; shared single `AudioContext` provider. |
| **Command Infrastructure** | Keep duplicate `TimelineCommandDispatcher`. | Redesign command interface across monorepo. | **Unified `IRStateManager` Commands + `cloneIR()`**: Eliminate `TimelineCommandDispatcher`; migrate commands to native `structuredClone`. |

---

## 3. Mermaid Topology & Interaction Flow

```mermaid
flowchart TD
    subgraph UI_Layer["React UI & Interaction Layer"]
        SKM["StudioKeyboardManager\n(Priority Stack: Modal > Surface > Transport > Global)"]
        UI_Guard["UI Compilation Guard\n(Disables conflicting edits while isCompiling=true)"]
        Shuttle["useShuttleEngine\n(60 FPS RAF Loop)"]
    end

    subgraph Controller_Layer["High-Frequency Playhead & State Coordination"]
        SPC["StudioPlayheadController\n(Discrete Frame Clock)"]
        SM["IRStateManager\n(awaitable dispatch with sequential compilation lock)"]
    end

    subgraph Worker_Layer["Worker Pipeline & Memory Manager"]
        PWC["PreviewWorkerCoordinator\n(Task Key Hash: targetId:type:contentHash)"]
        Worker["preview.worker.ts\n(Pure Pointer safeSetTexture)"]
        PFMM["PreviewFrameMemoryManager\n(Exclusive ImageBitmap Ownership & LRU .close())"]
    end

    subgraph Storage_Layer["Audio & Storage Engine"]
        SAC["SharedAudioContextProvider\n(Single AudioContext Instance)"]
        CCR["ContentCacheRegistry (OPFS)\n(Blob Streaming for Audio & Video)"]
        Export["ClientExportOrchestrator\n(try/finally OPFS lock release)"]
    end

    SKM -->|Transport Actions| Shuttle
    SKM -->|Editing Commands| UI_Guard
    UI_Guard -->|Awaited Execution| SM
    Shuttle -->|Every RAF (60 FPS)| SPC
    Shuttle -.->|Throttled 10-15 Hz| SM
    SPC -->|Direct Canvas & Needle| Worker
    SM -->|Preflight Timeline| PWC
    Worker -->|Fetch / Evict| PFMM
    Worker -->|Read Blob / Cache| CCR
    Export -->|Release Writable Stream| CCR
    SAC -->|Audio Decode / Playback| CCR
```

---

## 4. Mathematical & Algorithmic Specifications

### 4.1 Monotonic Compilation Epoch Guard
Let $E \in \mathbb{N}$ represent the monotonic compilation epoch counter. For each command dispatch $k$:
$$E_{k} = E_{k-1} + 1$$

When asynchronous compilation initiated at epoch $E_{k}$ resolves with timeline $T_{E_k}$:
$$\text{state.timeline} = \begin{cases}
T_{E_k} & \text{if } E_{k} = E_{\text{current}} \\
\text{discard} & \text{if } E_{k} < E_{\text{current}}
\end{cases}$$

This guarantees that an earlier, slower compilation can never overwrite a newer compilation state.

### 4.2 Preflight Content Hash Function
To guarantee that modifier parameter mutations are never skipped by preflight caching, the task cache key $K$ is defined as:
$$K = \text{targetId} \,\|\, \text{modifier.type} \,\|\, \mathcal{H}(\text{modifier.params})$$
where $\mathcal{H}(P)$ is a deterministic 32-bit FNV-1a hash of canonicalized JSON parameter string:
$$\mathcal{H}(s) = \left( \bigoplus_{i=0}^{n-1} s[i] \right) \times 16777619 \pmod{2^{32}}$$

### 4.3 Frame Memory Bound Invariance
Let $N_{\text{active}}$ be the number of active video sequences intersecting $[t - 2\text{s}, t + 3\text{s}]$.
The total resident decoded frame memory $M_{\text{resident}}$ is strictly bounded by:
$$M_{\text{resident}} = \sum_{i=1}^{N_{\text{cached}}} W_i \times H_i \times 4\text{ bytes} \le M_{\text{budget}} \quad (M_{\text{budget}} = 150\text{ MB})$$
$$N_{\text{cached}} \le \min(64, \lfloor M_{\text{budget}} / (W \times H \times 4) \rfloor)$$

---

## 5. Concrete File, Interface, and Class Signatures

### 5.1 Centralized `StudioKeyboardManager`
**File:** `apps/studio/src/lib/keyboard/StudioKeyboardManager.ts`
```typescript
export type KeyboardPriority = 'modal' | 'input' | 'surface' | 'transport' | 'global';

export interface KeybindingRule {
  id: string;
  key?: string;
  code?: string;
  priority: KeyboardPriority;
  metaOrCtrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  allowInInputs?: boolean;
  handler: (e: KeyboardEvent) => boolean | void; // return true to prevent default & stop propagation
}

export class StudioKeyboardManager {
  private static instance: StudioKeyboardManager | null = null;
  private rules: Map<string, KeybindingRule> = new Map();

  public static getInstance(): StudioKeyboardManager;
  public register(rule: KeybindingRule): () => void;
  public handleKeyEvent(e: KeyboardEvent): void;
}
```

### 5.2 Sequential Lock in `IRStateManager`
**File:** `apps/studio/src/lib/ir/irState.ts`
```typescript
export class IRStateManager {
  private currentCompileEpoch = 0;
  private isCompiling = false;
  private compileQueue: Promise<void> = Promise.resolve();

  // Async dispatch signature with sequential compilation lock
  public async dispatch(command: ICommand): Promise<void>;
  public getIsCompiling(): boolean;
  public recompile(): Promise<void>;
}
```

### 5.3 Exclusive Bitmap Lifecycle in `PreviewFrameMemoryManager`
**File:** `apps/studio/src/renderer/workers/PreviewFrameMemoryManager.ts`
```typescript
export class PreviewFrameMemoryManager {
  // Exclusive owner of ImageBitmap disposal
  public set(assetId: string, frame: number, bitmap: ImageBitmap): void;
  public get(assetId: string, frame: number): ImageBitmap | null;
  public pruneOutsideWindow(playheadFrame: number, fps: number, timeline?: any): void;
  public evictAsset(assetId: string): void;
  public clear(): void;
  private closeBitmap(bitmap: ImageBitmap): void;
}
```

### 5.4 Unified Audio Context Provider
**File:** `apps/studio/src/lib/audio/SharedAudioContext.ts`
```typescript
export class SharedAudioContext {
  private static ctx: AudioContext | null = null;
  public static getContext(sampleRate = 44100): AudioContext;
  public static close(): Promise<void>;
}
```

---

## 6. Phased Execution Roadmap

### Phase 1: P0 Memory Ownership & Centralized Keyboard Safety
1. **Unify ImageBitmap Lifecycle:**
   - Remove `existing.close()` from `safeSetTexture()` in `apps/studio/src/renderer/workers/preview.worker.ts`.
   - Ensure all `.close()` operations occur strictly inside `PreviewFrameMemoryManager.ts`.
2. **Implement `StudioKeyboardManager`:**
   - Create `apps/studio/src/lib/keyboard/StudioKeyboardManager.ts` with priority routing.
   - Migrate keydown listeners in `App.tsx`, `Timeline.tsx`, `usePreviewHotkeys.ts`, `Titlebar.tsx`, and `useShuttleEngine.ts` to register with `StudioKeyboardManager`.
   - Strictly guard `KeyK` (transport stop) against `metaKey`/`ctrlKey` (razor cut).
3. **Promise Rejection on Coordinator Reset:**
   - Update `PreviewWorkerCoordinator.reset()` to iterate and reject all pending tasks with `new Error('Coordinator reset')` before clearing.

### Phase 2: P1 Concurrency, 60 FPS Motion & Cache Invalidation
1. **Awaitable Sequential `dispatch()`:**
   - Refactor `IRStateManager.dispatch()` to be `async` and chain through an internal sequential promise lock.
   - Introduce `state.isCompiling` and expose it to the UI store.
   - Guard concurrent dispatches in `App.tsx` and inspectors with a non-intrusive compilation indicator.
2. **60 FPS Playhead Decoupling:**
   - In `useShuttleEngine.ts`, invoke `StudioPlayheadController.getInstance().seek(discreteFrame, false)` on **every** RAF tick.
   - Keep React state updates (`onScrub`) throttled to 66ms (~15 Hz) during active playback.
3. **Preflight Content Hashing:**
   - Add deterministic parameter hashing in `PreviewWorkerCoordinator.ts` to form `taskKey = ${targetId}:${type}:${paramHash}`.
4. **Decoder Concurrency Gate in Playback:**
   - Coordinate `WorkerClipPrewarmer.prewarmSequentialLookahead` with active sequential playback in `preview.worker.ts` to prevent competing seeks against Mediabunny `CanvasSink`.

### Phase 3: P2 Audio, OPFS Hygiene & Command Unification
1. **Single AudioContext & OPFS-First Audio Cache:**
   - Implement `SharedAudioContext` and share it across `WebAudioEngine` and `AudioAssetCache`.
   - Refactor `AudioAssetCache` to stream and persist audio via `ContentCacheRegistry` (OPFS) instead of retaining raw uncompressed PCM in heap.
2. **OPFS File Lock Cleanup:**
   - In `ClientExportOrchestrator.ts`, wrap export execution in `try ... finally` to ensure `opfsWritable.abort()` or `close()` is always invoked on abort/failure.
3. **Command Infrastructure Consolidation:**
   - Deprecate and remove `TimelineCommandDispatcher` from `apps/studio/src/lib/timeline/commands/TimelineCommands.ts`, routing all timeline actions through `IRStateManager`.
   - Refactor command classes in `apps/studio/src/lib/commands/` to use native `cloneIR()` (`structuredClone`) instead of `JSON.parse(JSON.stringify())`.

### Phase 4: P3 Dead Code Removal & Final Hardening
1. Delete orphaned `apps/studio/src/lib/timeline/ThumbnailLRUCache.ts`.
2. Remove dead `_isTransient` references from `preview.worker.ts`.
3. Synchronize `apps/studio/DESIGN.md` and `apps/studio/ROUTE.md` with updated keyboard shortcuts and state behaviors.

---

## 7. Formal Verification Matrix (`/autogenerated-tests/`)

| Test Suite | Target File | Verification Criteria |
|---|---|---|
| **Bitmap Lifecycle Safety** | `autogenerated-tests/studio_bitmap_lifecycle_safety.test.ts` | Verify reverse scrubbing never draws closed `ImageBitmap`s; confirm cache hit rate remains $>90\%$ without `InvalidStateError`. |
| **Keyboard Priority Stack** | `autogenerated-tests/studio_keyboard_manager_priority.test.ts` | Verify `Cmd+K` splits sequence without stopping shuttle; verify `Delete` triggers exactly one action; verify input bailing. |
| **Sequential Dispatch & Race Guard** | `autogenerated-tests/studio_async_dispatch_sequential_lock.test.ts` | Fire 20 rapid sequential commands; verify execution order is strictly deterministic and `state.timeline` never regresses. |
| **60 FPS Playhead Decoupling** | `autogenerated-tests/studio_playhead_60fps_decoupling.test.ts` | Verify `highFreqSubscribers` receive ticks at 60 FPS while `lowFreqSubscribers` remain throttled at 10–15 Hz. |
| **Preflight Parameter Invalidation** | `autogenerated-tests/studio_preflight_param_hash.test.ts` | Mutate modifier params on an existing sequence; verify preflight executes and updates cache instead of skipping. |
| **AudioContext & OPFS Safety** | `autogenerated-tests/studio_audio_opfs_hygiene.test.ts` | Verify single active `AudioContext`; verify aborted export releases OPFS writable file handle lock. |

---

## 8. Risk & Rollback Mitigations

- **Risk 1: Awaiting `dispatch()` slows down rapid UI interactions.**
  - *Mitigation:* `dispatch()` returns the updated document optimistically to local UI state while locking compilation in the background. Subsequent calls queue sequentially rather than dropping or corrupting state.
- **Risk 2: Keybinding migration breaks existing custom shortcuts.**
  - *Mitigation:* `StudioKeyboardManager` uses declarative keybinding definitions matching existing code mappings 1:1, verified by unit tests.
- **Risk 3: OPFS Audio Streaming latency.**
  - *Mitigation:* Audio clips active in the immediate 10-second lookahead window are pre-decoded into `SharedAudioStreamWorklet` ring buffers before the playhead arrives.
- **Rollback Strategy:**
  - `IRStateManager` retains legacy synchronous `dispatchSync()` method during migration.
  - Keyboard manager allows individual rule deregistration via returned unsubscribe callbacks.
