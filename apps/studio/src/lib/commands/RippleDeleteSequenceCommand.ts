import type { ICommand } from './ICommand';
import type { VideoIRDocument, IRSequence } from '@acc/ir';

interface DeletedSequenceEntry {
  sequence: IRSequence;
  trackId: string;
  originalIndex: number;
}

interface ShiftedSequenceEntry {
  trackId: string;
  sequenceId: string;
  originalStart: number | { offsetFrames?: number; [key: string]: unknown };
}

/**
 * RippleDeleteSequenceCommand:
 * Deletes target sequence and any linked A/V companion sequences, closing the timeline gap
 * by shifting downstream sequences backward by the deleted duration.
 *
 * Invariants:
 * 1. Linked A/V Deletion: Companion clips linked via editorial/av_link or linkId are removed simultaneously.
 * 2. Multi-Track Ripple: If rippleAllUnlocked is true, shifts all downstream clips across all unlocked tracks.
 * 3. Locked Track Immunity: Tracks with locked === true or isLocked === true are strictly preserved.
 * 4. State Inversion: Stores full snapshots of deleted and shifted items for bit-identical undo/redo.
 */
export class RippleDeleteSequenceCommand implements ICommand {
  public readonly id: string;
  public readonly description: string;
  public readonly timestamp: number;

  private sequenceId: string;
  private rippleAllUnlocked: boolean;
  private deletedEntries: DeletedSequenceEntry[] = [];
  private shiftedEntries: ShiftedSequenceEntry[] = [];
  private shiftFrames: number = 0;

  constructor(sequenceId: string, rippleAllUnlocked = false) {
    this.id = `ripple_del_${sequenceId}_${Date.now()}`;
    this.description = `Ripple delete sequence ${sequenceId}${rippleAllUnlocked ? ' (all unlocked tracks)' : ''}`;
    this.timestamp = Date.now();
    this.sequenceId = sequenceId;
    this.rippleAllUnlocked = rippleAllUnlocked;
  }

  public getDeletedEntries(): readonly DeletedSequenceEntry[] {
    return this.deletedEntries;
  }

  public getShiftedEntries(): readonly ShiftedSequenceEntry[] {
    return this.shiftedEntries;
  }

  public execute(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;
    this.deletedEntries = [];
    this.shiftedEntries = [];

    // 1. Locate primary target sequence
    let targetSeq: IRSequence | null = null;
    let primaryTrackId: string | null = null;

    for (const track of copy.tracks) {
      const found = track.sequences.find((s) => s.id === this.sequenceId);
      if (found) {
        targetSeq = found;
        primaryTrackId = track.id;
        break;
      }
    }

    if (!targetSeq || !primaryTrackId) {
      return copy;
    }

    const targetStart = typeof targetSeq.time.start === 'number'
      ? targetSeq.time.start
      : (targetSeq.time.start?.offsetFrames ?? 0);

    const targetDuration = typeof targetSeq.time.duration === 'number'
      ? targetSeq.time.duration
      : (targetSeq.time.duration?.frames ?? 0);

    this.shiftFrames = targetDuration;

    // 2. Discover linked sequences (via editorial/av_link modifier or linkId)
    const sequencesToDeleteIds = new Set<string>([this.sequenceId]);

    // Check targetSeq modifiers
    const avLinkMod = targetSeq.modifiers?.find((m) => m.type === 'editorial/av_link');
    if (avLinkMod?.params?.linkedSequenceId) {
      sequencesToDeleteIds.add(String(avLinkMod.params.linkedSequenceId));
    }
    const targetLinkId = (targetSeq as unknown as { linkId?: string }).linkId;
    if (targetLinkId) {
      for (const track of copy.tracks) {
        for (const s of track.sequences) {
          if ((s as unknown as { linkId?: string }).linkId === targetLinkId) {
            sequencesToDeleteIds.add(s.id);
          }
        }
      }
    }

    // Check reciprocal links across other tracks
    for (const track of copy.tracks) {
      for (const s of track.sequences) {
        const link = s.modifiers?.find((m) => m.type === 'editorial/av_link');
        if (link?.params?.linkedSequenceId === this.sequenceId) {
          sequencesToDeleteIds.add(s.id);
        }
      }
    }

    // 3. Remove target and linked sequences from tracks & record original positions
    const deletedTrackIds = new Set<string>();

    for (const track of copy.tracks) {
      // Find all sequences to remove in this track
      const toRemove: { seq: IRSequence; index: number }[] = [];
      for (let i = 0; i < track.sequences.length; i++) {
        const s = track.sequences[i];
        if (s && sequencesToDeleteIds.has(s.id)) {
          toRemove.push({ seq: s, index: i });
        }
      }

      // Sort descending to splice without index drift
      toRemove.sort((a, b) => b.index - a.index);
      for (const item of toRemove) {
        this.deletedEntries.push({
          sequence: JSON.parse(JSON.stringify(item.seq)),
          trackId: track.id,
          originalIndex: item.index,
        });
        track.sequences.splice(item.index, 1);
        deletedTrackIds.add(track.id);
      }
    }

    // 4. Determine affected tracks for downstream ripple
    const affectedTracks = copy.tracks.filter((track) => {
      // Locked track immunity
      const isLocked = Boolean(track.locked || (track as unknown as { isLocked?: boolean }).isLocked);
      if (isLocked) {
        return false;
      }

      if (this.rippleAllUnlocked) {
        return true;
      }
      return deletedTrackIds.has(track.id);
    });

    // 5. Shift downstream sequences backward
    if (this.shiftFrames > 0) {
      for (const track of affectedTracks) {
        for (const remainingSeq of track.sequences) {
          const startVal = typeof remainingSeq.time.start === 'number'
            ? remainingSeq.time.start
            : (remainingSeq.time.start?.offsetFrames ?? 0);

          if (startVal >= targetStart) {
            this.shiftedEntries.push({
              trackId: track.id,
              sequenceId: remainingSeq.id,
              originalStart: JSON.parse(JSON.stringify(remainingSeq.time.start)),
            });

            if (typeof remainingSeq.time.start === 'number') {
              remainingSeq.time.start = Math.max(targetStart, remainingSeq.time.start - this.shiftFrames);
            } else if (remainingSeq.time.start && typeof remainingSeq.time.start === 'object') {
              const cur = remainingSeq.time.start.offsetFrames ?? 0;
              remainingSeq.time.start.offsetFrames = cur - this.shiftFrames;
            }
          }
        }
      }
    }

    return copy;
  }

  public undo(doc: VideoIRDocument): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;

    // 1. Restore shifted sequence positions
    for (const shift of this.shiftedEntries) {
      const track = copy.tracks.find((t) => t.id === shift.trackId);
      if (track) {
        const seq = track.sequences.find((s) => s.id === shift.sequenceId);
        if (seq) {
          seq.time.start = JSON.parse(JSON.stringify(shift.originalStart));
        }
      }
    }

    // 2. Re-insert deleted sequences at their original indices (sorted ascending by index)
    const restoreEntries = [...this.deletedEntries].sort((a, b) => a.originalIndex - b.originalIndex);
    for (const entry of restoreEntries) {
      const track = copy.tracks.find((t) => t.id === entry.trackId);
      if (track) {
        const insertIdx = Math.min(entry.originalIndex, track.sequences.length);
        track.sequences.splice(insertIdx, 0, JSON.parse(JSON.stringify(entry.sequence)));
      }
    }

    return copy;
  }

  public tryMerge(_next: ICommand): boolean {
    return false;
  }
}
