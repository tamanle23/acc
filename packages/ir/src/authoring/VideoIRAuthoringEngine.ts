import type { VideoIRDocument, IRSequence, TrackType, SequenceType } from '../types/VideoIR';

export interface AllocateSequenceIdOptions {
  type: SequenceType;
  nameOrSlug?: string;
}

export interface AllocatedSequenceId {
  id: string;
  nextIndex: number;
}

export interface AllocatedSplitSequenceIds {
  part1Id: string;
  part2Id: string;
  nextIndex: number;
}

export interface CreateSequenceOptions {
  type: SequenceType;
  name?: string;
  assetId?: string;
  start: number | IRSequence['time']['start'];
  duration?: number | IRSequence['time']['duration'];
  blendMode?: IRSequence['blendMode'];
  modifiers?: IRSequence['modifiers'];
  cues?: IRSequence['cues'];
}

const MODALITY_SHORT_MAP: Record<SequenceType, string> = {
  video: 'video',
  audio: 'audio',
  image: 'image',
  text: 'text',
  overlay: 'overlay',
};

const TRACK_PREFIX_MAP: Record<TrackType, string> = {
  video: 'track_v',
  audio: 'track_a',
  timed_text: 'track_tt',
  data: 'track_d',
};

/**
 * Universal VideoIR Authoring Engine.
 * Provides deterministic, collision-resistant, track-move immune sequential ID generation,
 * high-water mark document metadata synchronization, and strict lifecycle operations (split, duplicate).
 */
export class VideoIRAuthoringEngine {
  /**
   * Sanitizes arbitrary string or clip name into a clean, lowercase URL/ID safe slug.
   * e.g., "Cyberpunk Highway Scene 01.mp4" -> "cyberpunk_highway_scene_01"
   */
  public static toSlug(input?: string): string {
    if (!input || typeof input !== 'string') {
      return '';
    }
    // Remove file extension if present (e.g., .mp4, .png)
    const withoutExt = input.replace(/\.[a-zA-Z0-9]{2,4}$/, '');
    const sanitized = withoutExt
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return sanitized;
  }

  /**
   * Resolves the current global high-water mark counter from doc.meta.nextSequenceIndex
   * or falls back to scanning all existing sequences across all tracks.
   */
  public static resolveNextSequenceIndex(doc: VideoIRDocument): number {
    if (
      doc.meta &&
      typeof doc.meta.nextSequenceIndex === 'number' &&
      Number.isInteger(doc.meta.nextSequenceIndex) &&
      doc.meta.nextSequenceIndex >= 1
    ) {
      return doc.meta.nextSequenceIndex;
    }

    // Fallback scan: find max trailing numerical index across all sequences
    let maxFound = 0;
    if (Array.isArray(doc.tracks)) {
      for (const track of doc.tracks) {
        if (Array.isArray(track.sequences)) {
          for (const seq of track.sequences) {
            if (seq && typeof seq.id === 'string') {
              const match = seq.id.match(/_(\d+)$/);
              if (match && match[1]) {
                const parsed = parseInt(match[1], 10);
                if (!isNaN(parsed) && parsed > maxFound) {
                  maxFound = parsed;
                }
              }
            }
          }
        }
      }
    }

    return maxFound + 1;
  }

  /**
   * Generates next unique sequence ID formatted as `seq_<modality>_<slug>_<globalIndex>`
   * and advances doc.meta.nextSequenceIndex.
   * 
   * Immune to track moves and track reordering.
   */
  public static allocateNextSequenceId(
    doc: VideoIRDocument,
    options: AllocateSequenceIdOptions
  ): AllocatedSequenceId {
    const currentIndex = this.resolveNextSequenceIndex(doc);
    const modality = MODALITY_SHORT_MAP[options.type] || 'clip';
    const slug = this.toSlug(options.nameOrSlug);

    const id = slug ? `seq_${modality}_${slug}_${currentIndex}` : `seq_${modality}_${currentIndex}`;
    const nextIndex = currentIndex + 1;

    // Mutate document metadata high-water mark monotonically
    if (!doc.meta) {
      doc.meta = {} as any;
    }
    doc.meta.nextSequenceIndex = nextIndex;

    return { id, nextIndex };
  }

  /**
   * Allocates IDs for a razor-split sequence:
   * - Part 1 keeps the original sequence ID (preserving existing inward relations)
   * - Part 2 is allocated the next global index with (Part 2) naming and advances counter
   */
  public static allocateSplitSequenceId(
    doc: VideoIRDocument,
    originalSeq: IRSequence
  ): AllocatedSplitSequenceIds {
    const allocated = this.allocateNextSequenceId(doc, {
      type: originalSeq.type,
      nameOrSlug: originalSeq.name || originalSeq.id,
    });

    return {
      part1Id: originalSeq.id,
      part2Id: allocated.id,
      nextIndex: allocated.nextIndex,
    };
  }

  /**
   * Allocates ID for a duplicated sequence and advances counter.
   */
  public static allocateDuplicateSequenceId(
    doc: VideoIRDocument,
    originalSeq: IRSequence
  ): AllocatedSequenceId {
    return this.allocateNextSequenceId(doc, {
      type: originalSeq.type,
      nameOrSlug: originalSeq.name || originalSeq.id,
    });
  }

  /**
   * Creates a complete IRSequence entity conforming to VideoIR specifications.
   */
  public static createSequence(
    doc: VideoIRDocument,
    options: CreateSequenceOptions
  ): IRSequence {
    const allocated = this.allocateNextSequenceId(doc, {
      type: options.type,
      nameOrSlug: options.name,
    });

    const sequence: IRSequence = {
      id: allocated.id,
      type: options.type,
      time: {
        start: options.start,
        duration: options.duration,
      },
    };

    if (options.name) {
      sequence.name = options.name;
    }
    if (options.assetId) {
      sequence.assetId = options.assetId;
    }
    if (options.blendMode) {
      sequence.blendMode = options.blendMode;
    }
    if (options.modifiers && options.modifiers.length > 0) {
      sequence.modifiers = JSON.parse(JSON.stringify(options.modifiers));
    }
    if (options.cues && options.cues.length > 0) {
      sequence.cues = JSON.parse(JSON.stringify(options.cues));
    }

    return sequence;
  }

  /**
   * Generates a deterministic, sequential track ID based on track type
   * (e.g. `track_v1`, `track_v2`, `track_a1`, `track_tt1`, `track_d1`).
   */
  public static generateNextTrackId(doc: VideoIRDocument, type: TrackType): string {
    const prefix = TRACK_PREFIX_MAP[type] || 'track_';
    let maxTrackNum = 0;

    if (Array.isArray(doc.tracks)) {
      for (const track of doc.tracks) {
        if (track && typeof track.id === 'string' && track.id.startsWith(prefix)) {
          const numStr = track.id.slice(prefix.length);
          const parsed = parseInt(numStr, 10);
          if (!isNaN(parsed) && parsed > maxTrackNum) {
            maxTrackNum = parsed;
          }
        }
      }
    }

    return `${prefix}${maxTrackNum + 1}`;
  }
}
