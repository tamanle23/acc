import {
  type VideoIRDocument,
  type ResolvedTimeline,
  type ResolvedSequence,
  type ModifierNode,
  RelationalDAGCompiler,
  IntervalTreeIndex,
  VideoIRSchemaValidator,
  type ValidationResult,
} from '@acc/ir';
import { complexSciFiDemoIR } from './complexSciFiDemoIR';
import { defaultDemoIR } from './defaultDemoIR';
import { BrowserAssetMetadataProber } from './BrowserAssetMetadataProber';
import { HistoryManager } from '../commands/HistoryManager';
import type { ICommand } from '../commands/ICommand';
import { TrimSequenceCommand } from '../commands/TrimSequenceCommand';
import { MoveSequenceCommand } from '../commands/MoveSequenceCommand';
import { SplitSequenceCommand } from '../commands/SplitSequenceCommand';
import { UpdateModifierCommand } from '../commands/UpdateModifierCommand';
import { RemoveModifierCommand } from '../commands/RemoveModifierCommand';
import { AddSequenceCommand, type AddSequenceOptions } from '../commands/AddSequenceCommand';
import { DuplicateSequenceCommand } from '../commands/DuplicateSequenceCommand';
import { DeleteSequenceCommand } from '../commands/DeleteSequenceCommand';
import { UpdateTextCueCommand } from '../commands/UpdateTextCueCommand';
import { UpdateSequenceTimeCommand } from '../commands/UpdateSequenceTimeCommand';
import { UpdateTrackCommand, type UpdateTrackProperties } from '../commands/UpdateTrackCommand';
import { ReorderTrackCommand } from '../commands/ReorderTrackCommand';
import { UpdateSequencePropsCommand, type UpdateSequenceProperties } from '../commands/UpdateSequencePropsCommand';
import { UpdateProjectMetaCommand, type UpdateProjectMetaProperties } from '../commands/UpdateProjectMetaCommand';
import { ReplaceDocumentCommand } from '../commands/ReplaceDocumentCommand';
import type { IRSequence, SequenceTime } from '@acc/ir';

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
  activeTemplate: 'scifi' | 'default';
}

export type IRStateSubscriber = (state: IRState) => void;

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
    doc: JSON.parse(JSON.stringify(complexSciFiDemoIR)),
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

  public getState(): IRState {
    return this.state;
  }

  public subscribe(callback: IRStateSubscriber): () => void {
    this.subscribers.add(callback);
    callback(this.state);
    return () => {
      this.subscribers.delete(callback);
    };
  }

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
    } catch (err: any) {
      this.state = {
        ...this.state,
        error: err.message || 'DAG Compilation error',
      };
      this.notify();
    }
  }

  public dispatch(command: ICommand): void {
    const newDoc = this.historyManager.execute(command, this.state.doc);
    this.state.doc = newDoc;
    this.state.canUndo = this.historyManager.canUndo();
    this.state.canRedo = this.historyManager.canRedo();
    this.recompile();
  }

  public undo(): void {
    const rolledBackDoc = this.historyManager.undo(this.state.doc);
    if (rolledBackDoc) {
      this.state.doc = rolledBackDoc;
      this.state.canUndo = this.historyManager.canUndo();
      this.state.canRedo = this.historyManager.canRedo();
      this.recompile();
    }
  }

  public redo(): void {
    const replayedDoc = this.historyManager.redo(this.state.doc);
    if (replayedDoc) {
      this.state.doc = replayedDoc;
      this.state.canUndo = this.historyManager.canUndo();
      this.state.canRedo = this.historyManager.canRedo();
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

  public async switchTemplate(template: 'scifi' | 'default'): Promise<void> {
    this.historyManager.clear();
    const targetDoc = template === 'scifi' ? complexSciFiDemoIR : defaultDemoIR;
    this.state = {
      ...this.state,
      doc: JSON.parse(JSON.stringify(targetDoc)),
      activeTemplate: template,
      selectedSequenceId: targetDoc.tracks[0]?.sequences[0]?.id || null,
    };
    await this.recompile();
  }

  public loadFromJSON(jsonString: string): ValidationResult {
    try {
      const parsed = JSON.parse(jsonString);
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
      this.state.doc = parsed;
      this.recompile();
      return { valid: true, errors: [] };
    } catch (e: any) {
      const err = e.message || 'Invalid JSON';
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
      const parsed = JSON.parse(jsonString);
      const val = VideoIRSchemaValidator.validate(parsed);
      if (!val.valid) {
        return val;
      }
      this.dispatch(new ReplaceDocumentCommand(parsed));
      return { valid: true, errors: [] };
    } catch (e: any) {
      const err = e.message || 'Invalid JSON';
      return { valid: false, errors: [`JSON parse error: ${err}`] };
    }
  }

  public exportJSON(): string {
    return JSON.stringify(this.state.doc, null, 2);
  }

  public trimSequence(sequenceId: string, deltaStart: number, deltaDuration: number): void {
    this.dispatch(new TrimSequenceCommand(sequenceId, deltaStart, deltaDuration));
  }

  public moveSequence(sequenceId: string, targetTrackId: string, targetStartFrame: number): void {
    this.dispatch(new MoveSequenceCommand(sequenceId, targetTrackId, targetStartFrame));
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

  public updateModifier(sequenceId: string, modifierType: string, params: Record<string, unknown>): void {
    this.dispatch(new UpdateModifierCommand(sequenceId, modifierType, params));
  }

  public addModifier(
    sequenceId: string,
    modifierOrType: string | { type: string; params?: Record<string, unknown> },
    params?: Record<string, unknown>
  ): void {
    if (typeof modifierOrType === 'string') {
      this.updateModifier(sequenceId, modifierOrType, params || {});
    } else {
      this.updateModifier(sequenceId, modifierOrType.type, modifierOrType.params || {});
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

  public addAsset(assetId: string, asset: any): void {
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

  public reorderTrack(trackId: string, direction: 'up' | 'down'): void {
    this.dispatch(new ReorderTrackCommand(trackId, direction));
  }

  public updateSequenceProps(sequenceId: string, updates: UpdateSequenceProperties): void {
    this.dispatch(new UpdateSequencePropsCommand(sequenceId, updates));
  }

  public updateProjectMeta(updates: UpdateProjectMetaProperties): void {
    this.dispatch(new UpdateProjectMetaCommand(updates));
  }
}

