import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRSequence } from '@acc/ir/client';

export class MoveSequenceCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private targetTrackId: string;
  private targetStartFrame: number;

  private previousTrackId: string | null = null;
  private previousStartFrame: number | null = null;

  constructor(sequenceId: string, targetTrackId: string, targetStartFrame: number) {
    this.id = `move_${sequenceId}_${Date.now()}`;
    this.description = `Move sequence ${sequenceId} to track ${targetTrackId} at frame ${targetStartFrame}`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
    this.targetTrackId = targetTrackId;
    this.targetStartFrame = Math.max(0, targetStartFrame);
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    let sourceTrack: any = null;
    let seqIndex = -1;
    let sequenceToMove: IRSequence | null = null;

    for (const track of copy.tracks) {
      const idx = track.sequences.findIndex((s) => s.id === this.sequenceId);
      if (idx !== -1) {
        sourceTrack = track;
        seqIndex = idx;
        sequenceToMove = track.sequences[idx];
        break;
      }
    }

    if (!sequenceToMove || !sourceTrack) {
      return copy;
    }

    // Capture initial location for undo
    if (this.previousTrackId === null) {
      this.previousTrackId = sourceTrack.id;
    }
    if (this.previousStartFrame === null) {
      if (typeof sequenceToMove.time.start === 'number') {
        this.previousStartFrame = sequenceToMove.time.start;
      } else if (sequenceToMove.time.start && typeof sequenceToMove.time.start === 'object') {
        this.previousStartFrame = sequenceToMove.time.start.offsetFrames ?? 0;
      } else {
        this.previousStartFrame = 0;
      }
    }

    // Update start frame
    if (typeof sequenceToMove.time.start === 'number') {
      sequenceToMove.time.start = this.targetStartFrame;
    } else if (sequenceToMove.time.start && typeof sequenceToMove.time.start === 'object') {
      sequenceToMove.time.start.offsetFrames = this.targetStartFrame;
    } else {
      sequenceToMove.time.start = this.targetStartFrame;
    }

    // If changing track
    if (sourceTrack.id !== this.targetTrackId) {
      const targetTrack = copy.tracks.find((t) => t.id === this.targetTrackId);
      if (targetTrack) {
        sourceTrack.sequences.splice(seqIndex, 1);
        targetTrack.sequences.push(sequenceToMove);
      }
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (this.previousTrackId === null || this.previousStartFrame === null) {
      return doc;
    }

    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    let currentTrack: any = null;
    let seqIndex = -1;
    let sequenceToRestore: IRSequence | null = null;

    for (const track of copy.tracks) {
      const idx = track.sequences.findIndex((s) => s.id === this.sequenceId);
      if (idx !== -1) {
        currentTrack = track;
        seqIndex = idx;
        sequenceToRestore = track.sequences[idx];
        break;
      }
    }

    if (!sequenceToRestore || !currentTrack) {
      return copy;
    }

    // Restore start frame
    if (typeof sequenceToRestore.time.start === 'number') {
      sequenceToRestore.time.start = this.previousStartFrame;
    } else if (sequenceToRestore.time.start && typeof sequenceToRestore.time.start === 'object') {
      sequenceToRestore.time.start.offsetFrames = this.previousStartFrame;
    } else {
      sequenceToRestore.time.start = this.previousStartFrame;
    }

    // Restore track if changed
    if (currentTrack.id !== this.previousTrackId) {
      const originalTrack = copy.tracks.find((t) => t.id === this.previousTrackId);
      if (originalTrack) {
        currentTrack.sequences.splice(seqIndex, 1);
        originalTrack.sequences.push(sequenceToRestore);
      }
    }

    return copy;
  }

  public tryMerge(next: ICommand): boolean {
    if (next instanceof MoveSequenceCommand && next.sequenceId === this.sequenceId) {
      this.targetTrackId = next.targetTrackId;
      this.targetStartFrame = next.targetStartFrame;
      return true;
    }
    return false;
  }
}
