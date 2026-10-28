import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRSequence, IRTrack } from '@acc/ir';

export interface DisplacedClipRecord {
  sequenceId: string;
  originalStart: number;
  displacedStart: number;
}

/**
 * RippleMoveSequenceCommand:
 * Moves a sequence to a target track at targetStartFrame.
 * Downstream sequences on the target track (where startFrame >= targetStartFrame)
 * are pushed forward (rippled) by the moved sequence's duration, creating an exact opening.
 * If the sequence has an active editorial/av_link modifier, its paired sequence is moved by the identical deltaShift.
 * Fully undoable and redoable with exact displacement restoration.
 */
export class RippleMoveSequenceCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private targetTrackId: string;
  private targetStartFrame: number;

  private previousTrackId: string | null = null;
  private previousStartFrame: number | null = null;
  private displacedClips: DisplacedClipRecord[] = [];
  private linkedDisplacement: { linkedId: string; originalStart: number; newStart: number } | null = null;

  constructor(sequenceId: string, targetTrackId: string, targetStartFrame: number) {
    this.id = `ripple_move_${sequenceId}_${Date.now()}`;
    this.description = `Ripple move sequence ${sequenceId} to track ${targetTrackId} at frame ${targetStartFrame}`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
    this.targetTrackId = targetTrackId;
    this.targetStartFrame = Math.max(0, targetStartFrame);
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    let sourceTrack: IRTrack | null = null;
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

    const targetTrack = copy.tracks.find((t) => t.id === this.targetTrackId);
    if (!targetTrack) {
      return copy;
    }

    // Verify track type compatibility (audio must stay in audio, visual in visual)
    const isSourceAudio = sourceTrack.type === 'audio';
    const isTargetAudio = targetTrack.type === 'audio';
    if (isSourceAudio !== isTargetAudio) {
      // Incompatible track type drop rejected
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

    const durationFrames =
      typeof sequenceToMove.time.duration === 'number'
        ? sequenceToMove.time.duration
        : sequenceToMove.time.duration && typeof sequenceToMove.time.duration === 'object'
          ? sequenceToMove.time.duration.frames ?? 90
          : 90;

    // Remove sequence from source track before calculating ripple shift on target track
    sourceTrack.sequences.splice(seqIndex, 1);

    // Compute ripple push for downstream clips on target track
    this.displacedClips = [];
    for (const s of targetTrack.sequences) {
      const sStart =
        typeof s.time.start === 'number'
          ? s.time.start
          : s.time.start && typeof s.time.start === 'object'
            ? s.time.start.offsetFrames ?? 0
            : 0;

      // If downstream clip starts at or after our target start, push it forward by durationFrames
      if (sStart >= this.targetStartFrame) {
        const newStart = sStart + durationFrames;
        this.displacedClips.push({
          sequenceId: s.id,
          originalStart: sStart,
          displacedStart: newStart,
        });

        if (typeof s.time.start === 'number') {
          s.time.start = newStart;
        } else if (s.time.start && typeof s.time.start === 'object') {
          s.time.start.offsetFrames = newStart;
        }
      }
    }

    // Set target start on moved sequence
    if (typeof sequenceToMove.time.start === 'number') {
      sequenceToMove.time.start = this.targetStartFrame;
    } else if (sequenceToMove.time.start && typeof sequenceToMove.time.start === 'object') {
      sequenceToMove.time.start.offsetFrames = this.targetStartFrame;
    } else {
      sequenceToMove.time.start = this.targetStartFrame;
    }

    // Insert into target track
    targetTrack.sequences.push(sequenceToMove);

    // Sort target track sequences by start frame
    targetTrack.sequences.sort((a: IRSequence, b: IRSequence) => {
      const aStart = typeof a.time.start === 'number' ? a.time.start : a.time.start?.offsetFrames ?? 0;
      const bStart = typeof b.time.start === 'number' ? b.time.start : b.time.start?.offsetFrames ?? 0;
      return aStart - bStart;
    });

    // Synchronize linked A/V sequence if editorial/av_link is active
    const deltaShift = this.targetStartFrame - (this.previousStartFrame ?? 0);
    const avLink = sequenceToMove.modifiers?.find((m) => m.type === 'editorial/av_link');
    if (avLink && avLink.params?.enabled !== false && avLink.params?.linkedSequenceId) {
      const linkedId = avLink.params.linkedSequenceId as string;
      for (const t of copy.tracks) {
        const linkedSeq = t.sequences.find((s) => s.id === linkedId);
        if (linkedSeq) {
          const orig =
            typeof linkedSeq.time.start === 'number'
              ? linkedSeq.time.start
              : linkedSeq.time.start?.offsetFrames ?? 0;
          const nextStart = Math.max(0, orig + deltaShift);
          this.linkedDisplacement = {
            linkedId,
            originalStart: orig,
            newStart: nextStart,
          };

          if (typeof linkedSeq.time.start === 'number') {
            linkedSeq.time.start = nextStart;
          } else if (linkedSeq.time.start && typeof linkedSeq.time.start === 'object') {
            linkedSeq.time.start.offsetFrames = nextStart;
          }
          break;
        }
      }
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    if (this.previousTrackId === null || this.previousStartFrame === null) {
      return doc;
    }

    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    // 1. Find moved sequence on current target track
    let currentTrack: IRTrack | null = null;
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
      return doc;
    }

    // 2. Remove sequence from target track
    currentTrack.sequences.splice(seqIndex, 1);

    // 3. Restore displaced downstream clips back to original positions
    for (const record of this.displacedClips) {
      const targetSeq = currentTrack.sequences.find((s: IRSequence) => s.id === record.sequenceId);
      if (targetSeq) {
        if (typeof targetSeq.time.start === 'number') {
          targetSeq.time.start = record.originalStart;
        } else if (targetSeq.time.start && typeof targetSeq.time.start === 'object') {
          targetSeq.time.start.offsetFrames = record.originalStart;
        }
      }
    }

    // 4. Restore sequence to previous track & previous start frame
    const sourceTrack = copy.tracks.find((t) => t.id === this.previousTrackId);
    if (!sourceTrack) {
      return doc;
    }

    if (typeof sequenceToRestore.time.start === 'number') {
      sequenceToRestore.time.start = this.previousStartFrame;
    } else if (sequenceToRestore.time.start && typeof sequenceToRestore.time.start === 'object') {
      sequenceToRestore.time.start.offsetFrames = this.previousStartFrame;
    } else {
      sequenceToRestore.time.start = this.previousStartFrame;
    }

    sourceTrack.sequences.push(sequenceToRestore);
    sourceTrack.sequences.sort((a: IRSequence, b: IRSequence) => {
      const aStart = typeof a.time.start === 'number' ? a.time.start : a.time.start?.offsetFrames ?? 0;
      const bStart = typeof b.time.start === 'number' ? b.time.start : b.time.start?.offsetFrames ?? 0;
      return aStart - bStart;
    });

    // 5. Restore linked sequence if was displaced
    if (this.linkedDisplacement) {
      for (const t of copy.tracks) {
        const linkedSeq = t.sequences.find((s) => s.id === this.linkedDisplacement!.linkedId);
        if (linkedSeq) {
          if (typeof linkedSeq.time.start === 'number') {
            linkedSeq.time.start = this.linkedDisplacement.originalStart;
          } else if (linkedSeq.time.start && typeof linkedSeq.time.start === 'object') {
            linkedSeq.time.start.offsetFrames = this.linkedDisplacement.originalStart;
          }
          break;
        }
      }
    }

    return copy;
  }
}
