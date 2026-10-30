import type { VideoIRDocument, IRSequence, IRTrack, TrackType, SequenceType } from '../types/VideoIR';

export type SemanticTrackRole =
  | 'main'
  | 'overlay'
  | 'audio'
  | 'text'
  | 'effects'
  | 'stickers';

export type TrackModalityGroup = 'timed_text' | 'video' | 'audio' | 'data';

export interface GroupedTracks<T extends IRTrack = IRTrack> {
  timed_text: T[];
  video: T[];
  audio: T[];
  data: T[];
}

export interface TrackQuotaLimit {
  softCap: number;
  hardCap: number;
}

export interface TrackAuthoringPolicy {
  limits: Record<SemanticTrackRole, TrackQuotaLimit>;
  allowHardCapOverride: boolean;
}

export const DEFAULT_TRACK_AUTHORING_POLICY: TrackAuthoringPolicy = {
  limits: {
    main: { softCap: 1, hardCap: 1 },
    overlay: { softCap: 6, hardCap: 10 },
    text: { softCap: 3, hardCap: 6 },
    effects: { softCap: 2, hardCap: 4 },
    stickers: { softCap: 2, hardCap: 4 },
    audio: { softCap: 4, hardCap: 8 },
  },
  allowHardCapOverride: true,
};

export interface TrackQuotaStatus {
  role: SemanticTrackRole;
  currentCount: number;
  softCap: number;
  hardCap: number;
  isSoftCapExceeded: boolean;
  isHardCapReached: boolean;
  message?: string;
}

export interface CanAddTrackResult {
  allowed: boolean;
  isWarning: boolean;
  role: SemanticTrackRole;
  currentCount: number;
  softCap: number;
  hardCap: number;
  reason?: string;
}

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
   * Generates a deterministic, sequential track ID based on track type and optional semantic role.
   * If a semantic role is provided, generates role-specific prefixes:
   * - main -> `track_v_main_1`
   * - overlay -> `track_v_overlay_1`
   * - effects -> `track_v_fx_1`
   * - stickers -> `track_v_sticker_1`
   * - audio -> `track_a_1`
   * - text -> `track_tt_1`
   *
   * If role is omitted, preserves backward compatibility with `track_v1`, `track_a1`, `track_tt1`.
   */
  public static generateNextTrackId(
    doc: VideoIRDocument,
    type: TrackType,
    role?: SemanticTrackRole
  ): string {
    if (role) {
      let prefix = 'track_';
      if (role === 'main') {
        prefix = 'track_v_main_';
      } else if (role === 'overlay') {
        prefix = 'track_v_overlay_';
      } else if (role === 'effects') {
        prefix = 'track_v_fx_';
      } else if (role === 'stickers') {
        prefix = 'track_v_sticker_';
      } else if (role === 'audio') {
        prefix = 'track_a_';
      } else if (role === 'text') {
        prefix = 'track_tt_';
      }

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

  /**
   * Classifies an IRTrack into a SemanticTrackRole without mutating its schema.
   *
   * Dynamic Semantic Role Classification Algorithm:
   * 1. If track.type === 'audio' -> 'audio'
   * 2. If track.type === 'timed_text' -> 'text'
   * 3. If name or id matches 'sticker' or 'emoji' -> 'stickers'
   * 4. If name or id matches 'effect', 'filter', 'adjustment', or has track-level modifiers -> 'effects'
   * 5. If index === 0, or id matches 'main'/'track_v_1'/'track-v1', or name matches 'main' -> 'main'
   * 6. Otherwise -> 'overlay'
   */
  public static classifyTrackRole(track: IRTrack, index?: number): SemanticTrackRole {
    if (!track) {
      return 'overlay';
    }

    if (track.type === 'audio') {
      return 'audio';
    }

    if (track.type === 'timed_text') {
      return 'text';
    }

    const idLower = (track.id || '').toLowerCase();
    const nameLower = (track.name || '').toLowerCase();

    // 3. Stickers / emojis
    if (
      idLower.includes('sticker') ||
      idLower.includes('emoji') ||
      nameLower.includes('sticker') ||
      nameLower.includes('emoji')
    ) {
      return 'stickers';
    }

    // 4. Effects / filters / adjustment
    if (
      idLower.includes('effect') ||
      idLower.includes('filter') ||
      idLower.includes('adjustment') ||
      nameLower.includes('effect') ||
      nameLower.includes('filter') ||
      nameLower.includes('adjustment') ||
      (Array.isArray(track.modifiers) && track.modifiers.length > 0)
    ) {
      return 'effects';
    }

    // 5. Main track check
    if (
      index === 0 ||
      idLower === 'track_v_main' ||
      idLower === 'track_v_1' ||
      idLower === 'track-v1' ||
      idLower.includes('main') ||
      nameLower.includes('main')
    ) {
      return 'main';
    }

    // 6. Default video track role is overlay
    return 'overlay';
  }

  /**
   * Evaluates current track counts against configured soft and hard cap policies.
   */
  public static evaluateTrackQuotas(
    doc: VideoIRDocument,
    policy: TrackAuthoringPolicy = DEFAULT_TRACK_AUTHORING_POLICY
  ): Record<SemanticTrackRole, TrackQuotaStatus> {
    const counts: Record<SemanticTrackRole, number> = {
      main: 0,
      overlay: 0,
      audio: 0,
      text: 0,
      effects: 0,
      stickers: 0,
    };

    if (Array.isArray(doc.tracks)) {
      doc.tracks.forEach((track, idx) => {
        const role = this.classifyTrackRole(track, idx);
        counts[role] = (counts[role] || 0) + 1;
      });
    }

    const roles: SemanticTrackRole[] = ['main', 'overlay', 'audio', 'text', 'effects', 'stickers'];
    const result = {} as Record<SemanticTrackRole, TrackQuotaStatus>;

    for (const role of roles) {
      const limit = policy.limits[role] ?? { softCap: 10, hardCap: 20 };
      const currentCount = counts[role] || 0;
      const isSoftCapExceeded = currentCount >= limit.softCap;
      const isHardCapReached = currentCount >= limit.hardCap;

      let message: string | undefined;
      if (isHardCapReached) {
        message = `Hard cap reached for ${role} tracks (${currentCount}/${limit.hardCap}). Compositing performance may degrade significantly.`;
      } else if (isSoftCapExceeded) {
        message = `Soft cap reached for ${role} tracks (${currentCount}/${limit.softCap}).`;
      }

      result[role] = {
        role,
        currentCount,
        softCap: limit.softCap,
        hardCap: limit.hardCap,
        isSoftCapExceeded,
        isHardCapReached,
        message,
      };
    }

    return result;
  }

  /**
   * Evaluates whether adding a new track with the given role or type is permissible
   * under current authoring policy limits, and whether a soft-warning or hard-block applies.
   */
  public static canAddTrack(
    doc: VideoIRDocument,
    roleOrType: SemanticTrackRole | TrackType,
    policy: TrackAuthoringPolicy = DEFAULT_TRACK_AUTHORING_POLICY,
    isManualOverride: boolean = false
  ): CanAddTrackResult {
    let targetRole: SemanticTrackRole;

    const validRoles: SemanticTrackRole[] = ['main', 'overlay', 'audio', 'text', 'effects', 'stickers'];
    if (validRoles.includes(roleOrType as SemanticTrackRole)) {
      targetRole = roleOrType as SemanticTrackRole;
    } else if (roleOrType === 'audio') {
      targetRole = 'audio';
    } else if (roleOrType === 'timed_text') {
      targetRole = 'text';
    } else if (roleOrType === 'video') {
      // If doc has no main track, this will become main; otherwise overlay
      const quotas = this.evaluateTrackQuotas(doc, policy);
      targetRole = quotas.main.currentCount === 0 ? 'main' : 'overlay';
    } else {
      targetRole = 'overlay';
    }

    const quotas = this.evaluateTrackQuotas(doc, policy);
    const quota = quotas[targetRole];
    const nextCount = quota.currentCount + 1;

    // Check hard cap
    if (quota.currentCount >= quota.hardCap) {
      if (isManualOverride && policy.allowHardCapOverride) {
        return {
          allowed: true,
          isWarning: true,
          role: targetRole,
          currentCount: quota.currentCount,
          softCap: quota.softCap,
          hardCap: quota.hardCap,
          reason: `Hard cap reached for role '${targetRole}' (${quota.currentCount}/${quota.hardCap}) - allowed via manual user override.`,
        };
      } else {
        return {
          allowed: false,
          isWarning: true,
          role: targetRole,
          currentCount: quota.currentCount,
          softCap: quota.softCap,
          hardCap: quota.hardCap,
          reason: `Cannot add track: Hard cap of ${quota.hardCap} reached for role '${targetRole}'.`,
        };
      }
    }

    // Check soft cap warning
    const isWarning = nextCount >= quota.softCap;
    return {
      allowed: true,
      isWarning,
      role: targetRole,
      currentCount: quota.currentCount,
      softCap: quota.softCap,
      hardCap: quota.hardCap,
      reason: isWarning
        ? `Soft cap reached for role '${targetRole}' (${nextCount}/${quota.softCap}).`
        : undefined,
    };
  }

  /**
   * Evaluates if a candidate sequence can be placed on an existing track without overlapping
   * any existing sequence on that track (temporal whitespace reuse).
   */
  public static canPlaceSequenceOnTrack(
    track: IRTrack,
    candidateStartFrame: number,
    candidateDurationFrames: number
  ): boolean {
    if (!Array.isArray(track.sequences) || track.sequences.length === 0) {
      return true;
    }

    const candidateEnd = candidateStartFrame + candidateDurationFrames;

    for (const seq of track.sequences) {
      if (typeof seq.time.start === 'number' && typeof seq.time.duration === 'number') {
        const seqStart = seq.time.start;
        const seqEnd = seqStart + seq.time.duration;
        // Check temporal overlap: [start1, end1) overlaps [start2, end2)
        if (Math.max(seqStart, candidateStartFrame) < Math.min(seqEnd, candidateEnd)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Finds an existing track matching the semantic role that has temporal whitespace
   * to accommodate the candidate sequence without overlapping, avoiding new track allocation.
   */
  public static findWhitespaceTrack(
    doc: VideoIRDocument,
    role: SemanticTrackRole,
    candidateStartFrame: number,
    candidateDurationFrames: number
  ): IRTrack | null {
    if (!Array.isArray(doc.tracks)) return null;

    for (let idx = 0; idx < doc.tracks.length; idx++) {
      const track = doc.tracks[idx];
      const trackRole = this.classifyTrackRole(track, idx);
      if (trackRole === role) {
        if (this.canPlaceSequenceOnTrack(track, candidateStartFrame, candidateDurationFrames)) {
          return track;
        }
      }
    }

    return null;
  }

  /**
   * Resolves the primary modality group for a track type.
   */
  public static getTrackModalityGroup(type: TrackType): TrackModalityGroup {
    if (type === 'timed_text') return 'timed_text';
    if (type === 'audio') return 'audio';
    if (type === 'data') return 'data';
    return 'video';
  }

  /**
   * Groups a collection of tracks by their modality (timed_text, video, audio, data)
   * while preserving custom intra-group ordering via groupOrder (with document index fallback).
   */
  public static groupTracksByType<T extends IRTrack = IRTrack>(tracks: T[]): GroupedTracks<T> {
    const grouped: GroupedTracks<T> = {
      timed_text: [],
      video: [],
      audio: [],
      data: [],
    };

    if (!Array.isArray(tracks)) return grouped;

    tracks.forEach((track, originalIndex) => {
      const modality = this.getTrackModalityGroup(track.type);
      grouped[modality].push({
        ...track,
        __originalIndex: originalIndex,
      } as any);
    });

    const sortGroup = (list: (T & { __originalIndex?: number })[]) => {
      list.sort((a, b) => {
        const orderA = typeof a.groupOrder === 'number' ? a.groupOrder : (a.__originalIndex ?? 0);
        const orderB = typeof b.groupOrder === 'number' ? b.groupOrder : (b.__originalIndex ?? 0);
        return orderA - orderB;
      });
      list.forEach((t, idx) => {
        delete t.__originalIndex;
        t.groupOrder = idx;
      });
    };

    sortGroup(grouped.timed_text as any);
    sortGroup(grouped.video as any);
    sortGroup(grouped.audio as any);
    sortGroup(grouped.data as any);

    return grouped;
  }

  /**
   * Reorders a track strictly within its own modality group (e.g. moving a video track
   * never crosses into timed_text or audio). Normalizes groupOrders and maintains
   * clean document track structure.
   */
  public static reorderTrackInGroup(
    doc: VideoIRDocument,
    trackId: string,
    direction: 'up' | 'down'
  ): VideoIRDocument {
    const copy = JSON.parse(JSON.stringify(doc)) as VideoIRDocument;
    if (!Array.isArray(copy.tracks)) return copy;

    const targetTrack = copy.tracks.find((t) => t.id === trackId);
    if (!targetTrack) return copy;

    const modality = this.getTrackModalityGroup(targetTrack.type);
    const grouped = this.groupTracksByType(copy.tracks);
    const list = grouped[modality];
    const currentIndex = list.findIndex((t) => t.id === trackId);

    if (currentIndex === -1) return copy;

    if (direction === 'up' && currentIndex > 0) {
      const targetIndex = currentIndex - 1;
      const [moved] = list.splice(currentIndex, 1);
      list.splice(targetIndex, 0, moved);
    } else if (direction === 'down' && currentIndex < list.length - 1) {
      const targetIndex = currentIndex + 1;
      const [moved] = list.splice(currentIndex, 1);
      list.splice(targetIndex, 0, moved);
    } else {
      // Cannot move beyond group boundaries
      return copy;
    }

    // Normalize groupOrder on the reordered group
    list.forEach((t, idx) => {
      t.groupOrder = idx;
    });

    // Reconstruct canonical track layout: timed_text -> video -> audio -> data
    copy.tracks = [
      ...grouped.timed_text,
      ...grouped.video,
      ...grouped.audio,
      ...grouped.data,
    ];

    return copy;
  }
}
