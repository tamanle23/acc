import type {
  VideoIRDocument,
  IRSequence,
  IRTrack,
  IRMeta,
  ModifierNode,
  TimedTextCue,
  RelationalStart,
  RelationalDuration,
  ResolvedTimeline,
  ResolvedSequence,
} from '@acc/ir';
import { RelationalDAGCompiler, AssetMetadataProber } from '@acc/ir';
import type {
  JsonPatchOperation,
  TimelinePlayheadState,
  ActiveClipInfo,
} from './types';

/**
 * Deep clone an object to preserve strict STATE-IMMUTABILITY.
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Parses an RFC 6902 JSON Pointer path into tokens.
 * e.g. "/tracks/0/sequences/1" -> ["tracks", "0", "sequences", "1"]
 */
function parseJsonPointer(path: string): string[] {
  if (!path || path === '/') return [];
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  return normalized.split('/').map((part) =>
    part.replace(/~1/g, '/').replace(/~0/g, '~')
  );
}

/**
 * Navigate to the target and parent object based on tokens.
 */
function resolvePath(obj: any, tokens: string[]): { parent: any; key: string; target: any } {
  if (tokens.length === 0) {
    return { parent: null, key: '', target: obj };
  }
  let current = obj;
  for (let i = 0; i < tokens.length - 1; i++) {
    const key = tokens[i];
    if (current === undefined || current === null) {
      throw new Error(`Invalid JSON patch path: property '${tokens.slice(0, i + 1).join('/')}' does not exist.`);
    }
    current = current[key];
  }
  const lastKey = tokens[tokens.length - 1];
  return { parent: current, key: lastKey, target: current ? current[lastKey] : undefined };
}

/**
 * StudioTimelineState:
 * Immutable state manager and timeline playhead controller for the Web/CLI Studio editor.
 * Maintains the canonical VideoIRDocument AST, applies bi-directional JSON-Patches (RFC 6902),
 * and provides playhead scrubbing and active clip resolution.
 */
export class StudioTimelineState {
  private document: VideoIRDocument;
  private currentFrame: number = 0;
  private isPlaying: boolean = false;
  private compiler: RelationalDAGCompiler;
  private cachedTimeline: ResolvedTimeline | null = null;
  private undoStack: JsonPatchOperation[][] = [];
  private redoStack: JsonPatchOperation[][] = [];
  private listeners: Set<(state: TimelinePlayheadState, doc: VideoIRDocument) => void> = new Set();

  constructor(initialDoc: VideoIRDocument, baseDir?: string) {
    this.document = deepClone(initialDoc);
    const prober = new AssetMetadataProber(baseDir);
    this.compiler = new RelationalDAGCompiler({ prober });
  }

  /**
   * Initializes or refreshes DAG compilation for the current document.
   */
  public async compile(): Promise<ResolvedTimeline> {
    this.cachedTimeline = await this.compiler.compile(this.document);
    return this.cachedTimeline;
  }

  public getDocument(): VideoIRDocument {
    return deepClone(this.document);
  }

  public getCachedTimeline(): ResolvedTimeline | null {
    return this.cachedTimeline;
  }

  public getPlayheadState(): TimelinePlayheadState {
    const fps = this.document.meta.globalFps || 30;
    const totalFrames = this.cachedTimeline?.totalFrames ?? 0;
    const durationSeconds = this.cachedTimeline?.durationSeconds ?? (totalFrames / fps);

    return {
      currentFrame: this.currentFrame,
      currentTime: Number((this.currentFrame / fps).toFixed(3)),
      isPlaying: this.isPlaying,
      fps,
      totalFrames,
      durationSeconds,
    };
  }

  /**
   * Subscribe to state and playhead changes.
   */
  public subscribe(listener: (state: TimelinePlayheadState, doc: VideoIRDocument) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getPlayheadState();
    const doc = this.getDocument();
    for (const listener of this.listeners) {
      try {
        listener(state, doc);
      } catch (err) {
        console.error('[StudioTimelineState] Listener error:', err);
      }
    }
  }

  /**
   * Scrub/seek to a specific frame or second.
   */
  public seek(target: number | string): TimelinePlayheadState {
    const fps = this.document.meta.globalFps || 30;
    const totalFrames = this.cachedTimeline?.totalFrames ?? 0;

    let targetFrame = 0;
    if (typeof target === 'string') {
      if (target.endsWith('s')) {
        targetFrame = Math.round(parseFloat(target.slice(0, -1)) * fps);
      } else {
        targetFrame = parseInt(target, 10);
      }
    } else {
      targetFrame = Math.round(target);
    }

    if (totalFrames > 0) {
      this.currentFrame = Math.max(0, Math.min(targetFrame, totalFrames - 1));
    } else {
      this.currentFrame = Math.max(0, targetFrame);
    }

    this.notify();
    return this.getPlayheadState();
  }

  public step(deltaFrames: number): TimelinePlayheadState {
    return this.seek(this.currentFrame + deltaFrames);
  }

  public play(): TimelinePlayheadState {
    this.isPlaying = true;
    this.notify();
    return this.getPlayheadState();
  }

  public pause(): TimelinePlayheadState {
    this.isPlaying = false;
    this.notify();
    return this.getPlayheadState();
  }

  /**
   * Apply an RFC 6902 JSON-Patch sequence immutably with automatic inverse patch creation.
   */
  public async applyPatch(operations: JsonPatchOperation[], recordUndo: boolean = true): Promise<{
    document: VideoIRDocument;
    inverseOps: JsonPatchOperation[];
    timeline: ResolvedTimeline;
  }> {
    const nextDoc = deepClone(this.document);
    const inverseOps: JsonPatchOperation[] = [];

    for (const op of operations) {
      const inverse = this.executeSingleOp(nextDoc, op);
      if (inverse) {
        inverseOps.unshift(inverse);
      }
    }

    // Compile new document to ensure schema and DAG validity
    const newTimeline = await this.compiler.compile(nextDoc);

    // If compile succeeds, commit new state
    this.document = nextDoc;
    this.cachedTimeline = newTimeline;

    if (recordUndo && operations.length > 0) {
      this.undoStack.push(inverseOps);
      this.redoStack = []; // Reset redo stack on new patch
    }

    // Clamp current frame if document length shrunk
    if (this.currentFrame >= newTimeline.totalFrames && newTimeline.totalFrames > 0) {
      this.currentFrame = newTimeline.totalFrames - 1;
    }

    this.notify();
    return {
      document: this.getDocument(),
      inverseOps,
      timeline: newTimeline,
    };
  }

  /**
   * Undo the previous patch operation.
   */
  public async undo(): Promise<{ success: boolean; document: VideoIRDocument }> {
    if (this.undoStack.length === 0) {
      return { success: false, document: this.getDocument() };
    }
    const inverseOps = this.undoStack.pop()!;
    const nextDoc = deepClone(this.document);
    const redoOps: JsonPatchOperation[] = [];

    for (const op of inverseOps) {
      const redo = this.executeSingleOp(nextDoc, op);
      if (redo) redoOps.unshift(redo);
    }

    this.cachedTimeline = await this.compiler.compile(nextDoc);
    this.document = nextDoc;
    this.redoStack.push(redoOps);
    this.notify();

    return { success: true, document: this.getDocument() };
  }

  /**
   * Redo the previously undone patch.
   */
  public async redo(): Promise<{ success: boolean; document: VideoIRDocument }> {
    if (this.redoStack.length === 0) {
      return { success: false, document: this.getDocument() };
    }
    const redoOps = this.redoStack.pop()!;
    const nextDoc = deepClone(this.document);
    const undoOps: JsonPatchOperation[] = [];

    for (const op of redoOps) {
      const undo = this.executeSingleOp(nextDoc, op);
      if (undo) undoOps.unshift(undo);
    }

    this.cachedTimeline = await this.compiler.compile(nextDoc);
    this.document = nextDoc;
    this.undoStack.push(undoOps);
    this.notify();

    return { success: true, document: this.getDocument() };
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Executes a single RFC 6902 patch op and returns its inverse.
   */
  private executeSingleOp(doc: any, op: JsonPatchOperation): JsonPatchOperation | null {
    const tokens = parseJsonPointer(op.path);
    const { parent, key, target } = resolvePath(doc, tokens);

    switch (op.op) {
      case 'add': {
        if (Array.isArray(parent)) {
          if (key === '-') {
            parent.push(deepClone(op.value));
            return { op: 'remove', path: `${op.path}/${parent.length - 1}` };
          } else {
            const idx = parseInt(key, 10);
            parent.splice(idx, 0, deepClone(op.value));
            return { op: 'remove', path: op.path };
          }
        } else if (parent && typeof parent === 'object') {
          const existed = key in parent;
          const oldVal = parent[key];
          parent[key] = deepClone(op.value);
          return existed ? { op: 'replace', path: op.path, value: deepClone(oldVal) } : { op: 'remove', path: op.path };
        }
        throw new Error(`Cannot add property at path: ${op.path}`);
      }

      case 'remove': {
        if (Array.isArray(parent)) {
          const idx = parseInt(key, 10);
          const oldVal = parent[idx];
          parent.splice(idx, 1);
          return { op: 'add', path: op.path, value: deepClone(oldVal) };
        } else if (parent && typeof parent === 'object') {
          const oldVal = parent[key];
          delete parent[key];
          return { op: 'add', path: op.path, value: deepClone(oldVal) };
        }
        throw new Error(`Cannot remove property at path: ${op.path}`);
      }

      case 'replace': {
        if (!parent || !(key in parent)) {
          throw new Error(`Target does not exist for replace op at path: ${op.path}`);
        }
        const oldVal = parent[key];
        parent[key] = deepClone(op.value);
        return { op: 'replace', path: op.path, value: deepClone(oldVal) };
      }

      case 'test': {
        const matches = JSON.stringify(target) === JSON.stringify(op.value);
        if (!matches) {
          throw new Error(`JSON Patch test failed at path ${op.path}: expected ${JSON.stringify(op.value)}, got ${JSON.stringify(target)}`);
        }
        return null;
      }

      case 'move': {
        if (!op.from) throw new Error("JSON Patch 'move' operation requires 'from' property");
        const fromTokens = parseJsonPointer(op.from);
        const fromLoc = resolvePath(doc, fromTokens);
        const movingVal = deepClone(fromLoc.target);
        this.executeSingleOp(doc, { op: 'remove', path: op.from });
        this.executeSingleOp(doc, { op: 'add', path: op.path, value: movingVal });
        return { op: 'move', from: op.path, path: op.from };
      }

      case 'copy': {
        if (!op.from) throw new Error("JSON Patch 'copy' operation requires 'from' property");
        const fromTokens = parseJsonPointer(op.from);
        const fromLoc = resolvePath(doc, fromTokens);
        const copyingVal = deepClone(fromLoc.target);
        this.executeSingleOp(doc, { op: 'add', path: op.path, value: copyingVal });
        return { op: 'remove', path: op.path };
      }

      default:
        throw new Error(`Unsupported JSON Patch operation: ${(op as any).op}`);
    }
  }

  /**
   * Returns active clips and metadata at the given frame (or current playhead frame).
   */
  public getActiveClipsAtFrame(frame?: number): ActiveClipInfo[] {
    const targetFrame = frame !== undefined ? frame : this.currentFrame;
    if (!this.cachedTimeline) return [];

    const activeList: ActiveClipInfo[] = [];

    for (const [trackId, resolvedTrack] of this.cachedTimeline.tracks.entries()) {
      for (const resolvedSeq of resolvedTrack.sequences) {
        if (targetFrame >= resolvedSeq.startFrame && targetFrame < resolvedSeq.endFrame) {
          const localFrame = targetFrame - resolvedSeq.startFrame;
          const fps = this.document.meta.globalFps || 30;
          const localMs = (localFrame / fps) * 1000;

          // Find active cues within this local time
          const activeCues: TimedTextCue[] = [];
          if (resolvedSeq.cues) {
            for (const cue of resolvedSeq.cues) {
              const startMs = cue.startOffsetMs;
              const endMs = cue.endOffsetMs === 'end' ? Infinity : cue.endOffsetMs;
              if (localMs >= startMs && localMs <= endMs) {
                activeCues.push(cue);
              }
            }
          }

          // Collect sequence-level and track-level modifiers
          const allModifiers = [
            ...(resolvedTrack.modifiers || []),
            ...(resolvedSeq.modifiers || []),
          ];

          activeList.push({
            sequenceId: resolvedSeq.id,
            trackId,
            trackType: resolvedTrack.type,
            assetId: resolvedSeq.assetId,
            localFrame,
            startFrame: resolvedSeq.startFrame,
            endFrame: resolvedSeq.endFrame,
            durationFrames: resolvedSeq.durationFrames,
            modifiers: allModifiers,
            activeCues,
          });
        }
      }
    }

    return activeList;
  }

  // ==========================================
  // Semantic Helper Methods for High-Level UI
  // ==========================================

  public async updateSequenceTime(
    trackId: string,
    sequenceId: string,
    start: number | RelationalStart,
    duration?: number | RelationalDuration
  ) {
    const trackIdx = this.document.tracks.findIndex((t) => t.id === trackId);
    if (trackIdx === -1) throw new Error(`Track '${trackId}' not found`);

    const seqIdx = this.document.tracks[trackIdx].sequences.findIndex((s) => s.id === sequenceId);
    if (seqIdx === -1) throw new Error(`Sequence '${sequenceId}' not found in track '${trackId}'`);

    const ops: JsonPatchOperation[] = [
      { op: 'replace', path: `/tracks/${trackIdx}/sequences/${seqIdx}/time/start`, value: start },
    ];
    if (duration !== undefined) {
      ops.push({ op: 'replace', path: `/tracks/${trackIdx}/sequences/${seqIdx}/time/duration`, value: duration });
    }

    return await this.applyPatch(ops);
  }

  public async updateTextCue(
    trackId: string,
    sequenceId: string,
    cueIndex: number,
    text: string,
    startOffsetMs?: number,
    endOffsetMs?: number | 'end'
  ) {
    const trackIdx = this.document.tracks.findIndex((t) => t.id === trackId);
    if (trackIdx === -1) throw new Error(`Track '${trackId}' not found`);

    const seqIdx = this.document.tracks[trackIdx].sequences.findIndex((s) => s.id === sequenceId);
    if (seqIdx === -1) throw new Error(`Sequence '${sequenceId}' not found in track '${trackId}'`);

    const currentCues = this.document.tracks[trackIdx].sequences[seqIdx].cues || [];
    if (cueIndex < 0 || cueIndex >= currentCues.length) {
      throw new Error(`Cue index ${cueIndex} out of bounds`);
    }

    const currentCue = currentCues[cueIndex];
    const updatedCue: TimedTextCue = {
      text,
      startOffsetMs: startOffsetMs !== undefined ? startOffsetMs : currentCue.startOffsetMs,
      endOffsetMs: endOffsetMs !== undefined ? endOffsetMs : currentCue.endOffsetMs,
    };

    const ops: JsonPatchOperation[] = [
      { op: 'replace', path: `/tracks/${trackIdx}/sequences/${seqIdx}/cues/${cueIndex}`, value: updatedCue },
    ];

    return await this.applyPatch(ops);
  }

  public async toggleModifier(
    trackId: string,
    sequenceId: string,
    modifierType: string,
    enabled: boolean,
    defaultParams: Record<string, unknown> = {}
  ) {
    const trackIdx = this.document.tracks.findIndex((t) => t.id === trackId);
    if (trackIdx === -1) throw new Error(`Track '${trackId}' not found`);

    const seqIdx = this.document.tracks[trackIdx].sequences.findIndex((s) => s.id === sequenceId);
    if (seqIdx === -1) throw new Error(`Sequence '${sequenceId}' not found in track '${trackId}'`);

    const seq = this.document.tracks[trackIdx].sequences[seqIdx];
    const modifiers = seq.modifiers || [];
    const modIdx = modifiers.findIndex((m) => m.type === modifierType);

    const ops: JsonPatchOperation[] = [];

    if (enabled && modIdx === -1) {
      // Add modifier
      if (!seq.modifiers) {
        ops.push({ op: 'add', path: `/tracks/${trackIdx}/sequences/${seqIdx}/modifiers`, value: [{ type: modifierType, params: defaultParams }] });
      } else {
        ops.push({ op: 'add', path: `/tracks/${trackIdx}/sequences/${seqIdx}/modifiers/-`, value: { type: modifierType, params: defaultParams } });
      }
    } else if (!enabled && modIdx !== -1) {
      // Remove modifier
      ops.push({ op: 'remove', path: `/tracks/${trackIdx}/sequences/${seqIdx}/modifiers/${modIdx}` });
    }

    if (ops.length > 0) {
      return await this.applyPatch(ops);
    }
    return { document: this.getDocument(), inverseOps: [], timeline: this.cachedTimeline! };
  }

  public async updateTrackStyle(trackId: string, styleKey: string, value: unknown) {
    const trackIdx = this.document.tracks.findIndex((t) => t.id === trackId);
    if (trackIdx === -1) throw new Error(`Track '${trackId}' not found`);

    const track = this.document.tracks[trackIdx];
    const ops: JsonPatchOperation[] = [];

    if (!track.style) {
      ops.push({ op: 'add', path: `/tracks/${trackIdx}/style`, value: { [styleKey]: value } });
    } else {
      const existed = styleKey in track.style;
      ops.push({
        op: existed ? 'replace' : 'add',
        path: `/tracks/${trackIdx}/style/${styleKey}`,
        value,
      });
    }

    return await this.applyPatch(ops);
  }
}
