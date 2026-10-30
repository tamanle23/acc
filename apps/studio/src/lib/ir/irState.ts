import {
  type VideoIRDocument,
  type ResolvedTimeline,
  type ResolvedSequence,
  type ModifierNode,
  type IRTrack,
  type TrackType,
  type SemanticTrackRole,
  type CanAddTrackResult,
  type TrackQuotaStatus,
  RelationalDAGCompiler,
  IntervalTreeIndex,
  VideoIRSchemaValidator,
  VideoIRAuthoringEngine,
  DEFAULT_TRACK_AUTHORING_POLICY,
  type ValidationResult,
} from '@acc/ir';
import { complexSciFiDemoIR } from './complexSciFiDemoIR';
import { defaultDemoIR } from './defaultDemoIR';
import { broadcastNewsDemoIR } from './broadcastNewsDemoIR';
import { cyberAudioVisualizerDemoIR } from './cyberAudioVisualizerDemoIR';
import { quantumPhysicsDemoIR } from './quantumPhysicsDemoIR';
import { astroTelemetryDemoIR } from './astroTelemetryDemoIR';
import { BrowserAssetMetadataProber } from './BrowserAssetMetadataProber';
import { HistoryManager } from '../commands/HistoryManager';
import type { ICommand } from '../commands/ICommand';
import { TrimSequenceCommand } from '../commands/TrimSequenceCommand';
import { RippleTrimSequenceCommand } from '../commands/RippleTrimSequenceCommand';
import { MoveSequenceCommand } from '../commands/MoveSequenceCommand';
import { RippleMoveSequenceCommand } from '../commands/RippleMoveSequenceCommand';
import { SplitSequenceCommand } from '../commands/SplitSequenceCommand';
import { UpdateModifierCommand } from '../commands/UpdateModifierCommand';
import { RemoveModifierCommand } from '../commands/RemoveModifierCommand';
import { AddSequenceCommand, type AddSequenceOptions } from '../commands/AddSequenceCommand';
import { AddLinkedAVSequenceCommand, type AddLinkedAVSequenceOptions } from '../commands/AddLinkedAVSequenceCommand';
import { DuplicateSequenceCommand } from '../commands/DuplicateSequenceCommand';
import { DeleteSequenceCommand } from '../commands/DeleteSequenceCommand';
import { RippleDeleteSequenceCommand } from '../commands/RippleDeleteSequenceCommand';
import { UpdateTextCueCommand } from '../commands/UpdateTextCueCommand';
import { UpdateSequenceTimeCommand } from '../commands/UpdateSequenceTimeCommand';
import { UpdateTrackCommand, type UpdateTrackProperties } from '../commands/UpdateTrackCommand';
import { AddTrackCommand } from '../commands/AddTrackCommand';
import { ReorderTrackCommand } from '../commands/ReorderTrackCommand';
import { UpdateSequencePropsCommand, type UpdateSequenceProperties } from '../commands/UpdateSequencePropsCommand';
import { UpdateProjectMetaCommand, type UpdateProjectMetaProperties } from '../commands/UpdateProjectMetaCommand';
import { ReplaceDocumentCommand } from '../commands/ReplaceDocumentCommand';
import type { IRSequence, SequenceTime } from '@acc/ir';
import { cloneIR, getErrorMessage, type StudioAssetRecord } from './studioTypes';

export type InspectorMode = 'sequence' | 'track' | 'project';

export interface IRState {
  doc: VideoIRDocument;
  timeline: ResolvedTimeline | null;
  intervalTree: IntervalTreeIndex | null;
  selectedSequenceId: string | null;
  selectedTrackId: string | null;
  inspectorMode: InspectorMode;
  error: string | null;
  canUndo: boolean;
  canRedo: boolean;
  activeTemplate: 'scifi' | 'default' | 'broadcast' | 'visualizer' | 'quantum' | 'astro';
}

export type IRStateSubscriber = (state: IRState) => void;

export function migrateLegacyModifiers(doc: any): any {
  if (!doc || typeof doc !== 'object') return doc;
  if (Array.isArray(doc.tracks)) {
    for (const track of doc.tracks) {
      if (Array.isArray(track.modifiers)) {
        for (const mod of track.modifiers) {
          if (mod && mod.type === 'text/style') {
            mod.type = 'timed_text/style';
          }
        }
      }
      if (Array.isArray(track.sequences)) {
        for (const seq of track.sequences) {
          if (Array.isArray(seq.modifiers)) {
            for (const mod of seq.modifiers) {
              if (mod && mod.type === 'text/style') {
                mod.type = 'timed_text/style';
              }
            }
          }
        }
      }
    }
  }
  return doc;
}

/**
 * IRStateManager:
 * Authoritative in-memory state manager for the active VideoIRDocument.
 * Adheres strictly to the Command & Strategy Pattern for Undo/Redo operations.
 */
export class IRStateManager {
  private static instance: IRStateManager;
  private prober = new BrowserAssetMetadataProber();
  private compiler = new RelationalDAGCompiler({ prober: this.prober });
  private historyManager = new HistoryManager();
  private subscribers = new Set<IRStateSubscriber>();

  private state: IRState = {
    doc: cloneIR(complexSciFiDemoIR),
    timeline: null,
    intervalTree: null,
    selectedSequenceId: 'seq-city-intro',
    selectedTrackId: 'track-v1',
    inspectorMode: 'sequence',
    error: null,
    canUndo: false,
    canRedo: false,
    activeTemplate: 'scifi',
  };

  private constructor() {
    this.recompile();
  }

  public static getInstance(): IRStateManager {
    if (!IRStateManager.instance) {
      IRStateManager.instance = new IRStateManager();
    }
    return IRStateManager.instance;
  }

  public getState = (): IRState => {
    return this.state;
  };

  public getSnapshot = (): IRState => {
    return this.state;
  };

  public subscribe = (callback: IRStateSubscriber): (() => void) => {
    this.subscribers.add(callback);
    callback(this.state);
    return () => {
      this.subscribers.delete(callback);
    };
  };

  private notify() {
    for (const sub of this.subscribers) {
      try {
        sub(this.state);
      } catch (e) {
        console.error('[IRStateManager] Subscriber error:', e);
      }
    }
  }

  public async recompile(): Promise<void> {
    try {
      const validation = VideoIRSchemaValidator.validate(this.state.doc);
      if (!validation.valid) {
        this.state = {
          ...this.state,
          error: `Schema error: ${validation.errors.join(', ')}`,
        };
        this.notify();
        return;
      }

      const timeline = await this.compiler.compile(this.state.doc);
      const allSequences: ResolvedSequence[] = [];
      for (const track of timeline.tracks.values()) {
        allSequences.push(...track.sequences);
      }
      const intervalTree = new IntervalTreeIndex(allSequences);

      this.state = {
        ...this.state,
        timeline,
        intervalTree,
        error: null,
        canUndo: this.historyManager.canUndo(),
        canRedo: this.historyManager.canRedo(),
      };
      this.notify();
    } catch (err: unknown) {
      this.state = {
        ...this.state,
        error: getErrorMessage(err, 'DAG Compilation error'),
      };
      this.notify();
    }
  }

  public dispatch(command: ICommand): void {
    const newDoc = this.historyManager.execute(command, this.state.doc);
    this.state = {
      ...this.state,
      doc: newDoc,
      canUndo: this.historyManager.canUndo(),
      canRedo: this.historyManager.canRedo(),
    };
    this.notify();
    this.recompile();
  }

  public undo(): void {
    const rolledBackDoc = this.historyManager.undo(this.state.doc);
    if (rolledBackDoc) {
      this.state = {
        ...this.state,
        doc: rolledBackDoc,
        canUndo: this.historyManager.canUndo(),
        canRedo: this.historyManager.canRedo(),
      };
      this.notify();
      this.recompile();
    }
  }

  public redo(): void {
    const replayedDoc = this.historyManager.redo(this.state.doc);
    if (replayedDoc) {
      this.state = {
        ...this.state,
        doc: replayedDoc,
        canUndo: this.historyManager.canUndo(),
        canRedo: this.historyManager.canRedo(),
      };
      this.notify();
      this.recompile();
    }
  }

  public canUndo(): boolean {
    return this.historyManager.canUndo();
  }

  public canRedo(): boolean {
    return this.historyManager.canRedo();
  }

  public setSelectedSequenceId(id: string | null) {
    let parentTrackId = this.state.selectedTrackId;
    if (id) {
      for (const track of this.state.doc.tracks) {
        if (track.sequences.some((s) => s.id === id)) {
          parentTrackId = track.id;
          break;
        }
      }
    }
    this.state = {
      ...this.state,
      selectedSequenceId: id,
      selectedTrackId: parentTrackId,
      inspectorMode: id ? 'sequence' : this.state.inspectorMode,
    };
    this.notify();
  }

  public setSelectedTrackId(trackId: string | null) {
    this.state = {
      ...this.state,
      selectedTrackId: trackId,
      inspectorMode: trackId ? 'track' : this.state.inspectorMode,
    };
    this.notify();
  }

  public setInspectorMode(mode: InspectorMode) {
    this.state = {
      ...this.state,
      inspectorMode: mode,
    };
    this.notify();
  }

  public async switchTemplate(template: 'scifi' | 'default' | 'broadcast' | 'visualizer' | 'quantum' | 'astro'): Promise<void> {
    this.historyManager.clear();
    let targetDoc = defaultDemoIR;
    if (template === 'scifi') {
      targetDoc = complexSciFiDemoIR;
    } else if (template === 'broadcast') {
      targetDoc = broadcastNewsDemoIR;
    } else if (template === 'visualizer') {
      targetDoc = cyberAudioVisualizerDemoIR;
    } else if (template === 'quantum') {
      targetDoc = quantumPhysicsDemoIR;
    } else if (template === 'astro') {
      targetDoc = astroTelemetryDemoIR;
    }
    this.state = {
      ...this.state,
      doc: cloneIR(targetDoc),
      activeTemplate: template,
      selectedSequenceId: targetDoc.tracks[0]?.sequences[0]?.id || null,
      canUndo: false,
      canRedo: false,
    };
    this.notify();
    await this.recompile();
  }

  public loadDocument(doc: VideoIRDocument): void {
    const migrated = migrateLegacyModifiers(cloneIR(doc));
    this.historyManager.clear();
    this.state = {
      ...this.state,
      doc: migrated,
      error: null,
      canUndo: false,
      canRedo: false,
    };
    this.notify();
    this.recompile();
  }

  public loadFromJSON(jsonString: string): ValidationResult {
    try {
      const parsed = migrateLegacyModifiers(JSON.parse(jsonString));
      const val = VideoIRSchemaValidator.validate(parsed);
      if (!val.valid) {
        this.state = {
          ...this.state,
          error: `Schema error: ${val.errors.join(', ')}`,
        };
        this.notify();
        return val;
      }
      this.historyManager.clear();
      this.state = {
        ...this.state,
        doc: parsed,
        error: null,
        canUndo: false,
        canRedo: false,
      };
      this.notify();
      this.recompile();
      return { valid: true, errors: [] };
    } catch (e: unknown) {
      const err = getErrorMessage(e, 'Invalid JSON');
      this.state = {
        ...this.state,
        error: `JSON parse error: ${err}`,
      };
      this.notify();
      return { valid: false, errors: [err] };
    }
  }

  public applyJSONEdit(jsonString: string): ValidationResult {
    try {
      const parsed = migrateLegacyModifiers(JSON.parse(jsonString));
      const val = VideoIRSchemaValidator.validate(parsed);
      if (!val.valid) {
        return val;
      }
      this.dispatch(new ReplaceDocumentCommand(parsed));
      return { valid: true, errors: [] };
    } catch (e: unknown) {
      const err = getErrorMessage(e, 'Invalid JSON');
      return { valid: false, errors: [`JSON parse error: ${err}`] };
    }
  }

  public exportJSON(): string {
    return JSON.stringify(this.state.doc, null, 2);
  }

  public trimSequence(sequenceId: string, deltaStart: number, deltaDuration: number): void {
    this.dispatch(new TrimSequenceCommand(sequenceId, deltaStart, deltaDuration));
  }

  public rippleTrimSequence(sequenceId: string, deltaStart: number, deltaDuration: number): void {
    this.dispatch(new RippleTrimSequenceCommand(sequenceId, deltaStart, deltaDuration));
  }

  public moveSequence(sequenceId: string, targetTrackId: string, targetStartFrame: number): void {
    this.dispatch(new MoveSequenceCommand(sequenceId, targetTrackId, targetStartFrame));
  }

  public rippleMoveSequence(sequenceId: string, targetTrackId: string, targetStartFrame: number): void {
    const resolvedSeq = this.state.timeline?.sequences?.get(sequenceId);
    const resolvedStartFrame = resolvedSeq?.startFrame;
    const resolvedDurationFrames = resolvedSeq?.durationFrames;
    this.dispatch(new RippleMoveSequenceCommand(sequenceId, targetTrackId, targetStartFrame, resolvedStartFrame, resolvedDurationFrames));
  }

  public splitSequence(sequenceId: string, splitFrame: number): void {
    const resolvedSeq = this.state.timeline?.sequences?.get(sequenceId);
    const startFrame = resolvedSeq?.startFrame ?? 0;
    const endFrame = resolvedSeq?.endFrame ?? 90;
    this.dispatch(new SplitSequenceCommand(sequenceId, splitFrame, startFrame, endFrame));
  }

  public updateSequenceTime(sequenceId: string, time: SequenceTime): void {
    this.dispatch(new UpdateSequenceTimeCommand(sequenceId, time));
  }

  public updateModifier(
    sequenceId: string,
    modifierType: string,
    params: Record<string, unknown>,
    target?: SequenceType | SequenceType[]
  ): void {
    let resolvedTarget = target;
    if (!resolvedTarget) {
      for (const track of this.state.doc.tracks) {
        const found = track.sequences.find((s) => s.id === sequenceId);
        if (found) {
          resolvedTarget = found.type;
          break;
        }
      }
    }
    this.dispatch(new UpdateModifierCommand(sequenceId, modifierType, params, resolvedTarget));
  }

  public addModifier(
    sequenceId: string,
    modifierOrType: string | { type: string; params?: Record<string, unknown>; target?: SequenceType | SequenceType[] },
    params?: Record<string, unknown>,
    target?: SequenceType | SequenceType[]
  ): void {
    if (typeof modifierOrType === 'string') {
      this.updateModifier(sequenceId, modifierOrType, params || {}, target);
    } else {
      this.updateModifier(
        sequenceId,
        modifierOrType.type,
        modifierOrType.params || {},
        modifierOrType.target || target
      );
    }
  }

  public removeModifier(sequenceId: string, modifierType: string): void {
    this.dispatch(new RemoveModifierCommand(sequenceId, modifierType));
  }

  public addSequence(
    targetTrackId: string,
    sequence: IRSequence,
    options?: AddSequenceOptions
  ): void {
    this.dispatch(new AddSequenceCommand(targetTrackId, sequence, options));
    this.setSelectedSequenceId(sequence.id);
  }

  public addLinkedAVSequences(options: AddLinkedAVSequenceOptions): void {
    this.dispatch(new AddLinkedAVSequenceCommand(options));
    const vSeq = options.videoSequence ?? options.videoSeq;
    if (vSeq) {
      this.setSelectedSequenceId(vSeq.id);
    }
  }

  public updateTextCue(sequenceId: string, cueIndex: number, newText: string): void {
    this.dispatch(new UpdateTextCueCommand(sequenceId, cueIndex, newText));
  }

  public duplicateSequence(sequenceId: string): void {
    const cmd = new DuplicateSequenceCommand(sequenceId);
    this.dispatch(cmd);
    const dupId = cmd.getDuplicatedId();
    if (dupId) {
      this.setSelectedSequenceId(dupId);
    }
  }

  public deleteSequence(sequenceId: string): void {
    this.dispatch(new DeleteSequenceCommand(sequenceId));
    if (this.state.selectedSequenceId === sequenceId) {
      this.setSelectedSequenceId(null);
    }
  }

  public rippleDeleteSequence(sequenceId: string, rippleAllUnlocked = false): void {
    this.dispatch(new RippleDeleteSequenceCommand(sequenceId, rippleAllUnlocked));
    if (this.state.selectedSequenceId === sequenceId) {
      this.setSelectedSequenceId(null);
    }
  }

  public addAsset(assetId: string, asset: StudioAssetRecord): void {
    const assets = { ...(this.state.doc.assets || {}), [assetId]: asset };
    this.state = {
      ...this.state,
      doc: {
        ...this.state.doc,
        assets,
      },
    };
    this.notify();
  }

  public updateTrack(trackId: string, updates: UpdateTrackProperties): void {
    this.dispatch(new UpdateTrackCommand(trackId, updates));
  }

  public setTrackMuted(trackId: string, muted: boolean): void {
    const track = this.state.doc.tracks.find((t) => t.id === trackId);
    if (track) {
      track.muted = muted;
      this.notify();
      this.recompile();
    }
  }

  public setTrackVisible(trackId: string, visible: boolean): void {
    const track = this.state.doc.tracks.find((t) => t.id === trackId);
    if (track) {
      track.visible = visible;
      this.notify();
      this.recompile();
    }
  }

  public setTrackLocked(trackId: string, locked: boolean): void {
    const track = this.state.doc.tracks.find((t) => t.id === trackId);
    if (track) {
      track.locked = locked;
      this.notify();
      this.recompile();
    }
  }

  public updateTrackStyle(trackId: string, styleUpdates: Record<string, unknown>): void {
    this.dispatch(new UpdateTrackCommand(trackId, { style: styleUpdates }));
  }

  public updateTrackRouting(trackId: string, routeTo: string): void {
    this.dispatch(new UpdateTrackCommand(trackId, { routeTo }));
  }

  public reorderTrack(trackId: string, direction: 'up' | 'down'): void {
    this.dispatch(new ReorderTrackCommand(trackId, direction));
  }

  /**
   * Evaluates if adding a track is permitted under current quota policies.
   */
  public checkCanAddTrack(
    type: TrackType = 'video',
    role?: SemanticTrackRole,
    isManualOverride: boolean = false
  ): CanAddTrackResult {
    const resolvedRole = role ?? (type === 'audio' ? 'audio' : type === 'timed_text' ? 'text' : 'overlay');
    return VideoIRAuthoringEngine.canAddTrack(
      this.state.doc,
      resolvedRole,
      DEFAULT_TRACK_AUTHORING_POLICY,
      isManualOverride
    );
  }

  /**
   * Returns current track quota telemetry across all semantic roles.
   */
  public getTrackQuotas(): Record<SemanticTrackRole, TrackQuotaStatus> {
    return VideoIRAuthoringEngine.evaluateTrackQuotas(this.state.doc);
  }

  /**
   * Adds a new track to the document after validating authoring quotas.
   * If a hard cap is reached and isManualOverride is false, rejects the addition.
   */
  public addTrack(
    type: TrackType = 'video',
    role?: SemanticTrackRole,
    isManualOverride: boolean = false
  ): CanAddTrackResult & { trackId?: string } {
    const currentDoc = this.state.doc;
    const resolvedRole = role ?? (type === 'audio' ? 'audio' : type === 'timed_text' ? 'text' : 'overlay');

    const check = VideoIRAuthoringEngine.canAddTrack(
      currentDoc,
      resolvedRole,
      DEFAULT_TRACK_AUTHORING_POLICY,
      isManualOverride
    );

    if (!check.allowed) {
      return { ...check };
    }

    const newTrackId = VideoIRAuthoringEngine.generateNextTrackId(currentDoc, type, resolvedRole);
    const roleCapitalized = resolvedRole.charAt(0).toUpperCase() + resolvedRole.slice(1);
    const trackSuffix = newTrackId.split('_').pop() || '1';

    const newTrack: IRTrack = {
      id: newTrackId,
      type,
      name: `${roleCapitalized} Track ${trackSuffix}`.trim(),
      sequences: [],
    };

    this.dispatch(new AddTrackCommand(newTrack));
    this.setSelectedTrackId(newTrackId);

    return { ...check, trackId: newTrackId };
  }

  public updateSequenceProps(sequenceId: string, updates: UpdateSequenceProperties): void {
    this.dispatch(new UpdateSequencePropsCommand(sequenceId, updates));
  }

  public updateProjectMeta(updates: UpdateProjectMetaProperties): void {
    this.dispatch(new UpdateProjectMetaCommand(updates));
  }
}

