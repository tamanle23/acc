import type {
  AssetDefinition,
  IRSequence,
  IRTrack,
  ModifierNode,
  ResolvedSequence,
  ResolvedTrack,
} from '@acc/ir';

/**
 * Union representing either a compiled ResolvedSequence (from timeline)
 * or a raw IRSequence (from VideoIRDocument).
 */
export type StudioSequence = ResolvedSequence | IRSequence;

/**
 * Union representing either a compiled ResolvedTrack (from timeline)
 * or a raw IRTrack (from VideoIRDocument).
 */
export type StudioTrack = ResolvedTrack | IRTrack;

/**
 * Extended asset definition record stored in IRState.doc.assets
 * with optional UI metadata populated when importing local files or presets.
 */
export interface StudioAssetRecord extends AssetDefinition {
  id?: string;
  name?: string;
  durationSec?: number;
  size?: number;
  hasAudio?: boolean;
  category?: string;
}

/**
 * Preset drag item payload from LeftSidebar.
 */
export interface PresetDragItem {
  id: string;
  name: string;
  category?: string;
  durationFrames?: number;
  modifiers?: ModifierNode[];
  trackType?: 'video' | 'audio' | 'overlay' | 'subtitle' | 'data';
}

/**
 * Discriminated union for @dnd-kit active.data.current payloads across Studio.
 */
export type StudioDragPayload =
  | {
      type: 'preset';
      item: PresetDragItem;
    }
  | {
      type: 'asset';
      asset: StudioAssetRecord;
    }
  | {
      type: 'clip';
      sequenceId: string;
      sourceTrackId: string;
      sequence: StudioSequence;
      startFrame: number;
      durationFrames: number;
      pxPerFrame: number;
    }
  | {
      type: 'trim';
      sequenceId: string;
      edge: 'left' | 'right';
      pxPerFrame: number;
    }
  | {
      type: 'track';
      trackId: string;
      track?: StudioTrack;
    };

/**
 * Type guard checking if a sequence has compiled ResolvedSequence frame bounds.
 */
export function isResolvedSequence(seq: StudioSequence | null | undefined): seq is ResolvedSequence {
  return Boolean(seq && typeof (seq as ResolvedSequence).startFrame === 'number');
}

/**
 * Pure helper extracting the start frame from either a ResolvedSequence or IRSequence.
 */
export function getSequenceStartFrame(seq: StudioSequence | null | undefined): number {
  if (!seq) return 0;
  if ('startFrame' in seq && typeof seq.startFrame === 'number') {
    return seq.startFrame;
  }
  const timeStart = seq.time?.start;
  return typeof timeStart === 'number' ? timeStart : 0;
}

/**
 * Pure helper extracting the duration in frames from either a ResolvedSequence or IRSequence.
 */
export function getSequenceDurationFrames(
  seq: StudioSequence | null | undefined,
  fallback = 90
): number {
  if (!seq) return fallback;
  if ('durationFrames' in seq && typeof seq.durationFrames === 'number') {
    return seq.durationFrames;
  }
  const timeDuration = seq.time?.duration;
  return typeof timeDuration === 'number' ? timeDuration : fallback;
}

/**
 * Pure helper extracting the end frame from either a ResolvedSequence or IRSequence.
 */
export function getSequenceEndFrame(
  seq: StudioSequence | null | undefined,
  fallbackDuration = 90
): number {
  if (!seq) return fallbackDuration;
  if ('endFrame' in seq && typeof seq.endFrame === 'number') {
    return seq.endFrame;
  }
  return getSequenceStartFrame(seq) + getSequenceDurationFrames(seq, fallbackDuration);
}

/**
 * Normalizes a track collection (Map<string, ResolvedTrack> or Track[]) into an array.
 */
export function normalizeTracksList<T extends StudioTrack = StudioTrack>(
  tracks: Map<string, T> | T[] | null | undefined
): T[] {
  if (!tracks) return [];
  if (tracks instanceof Map) {
    return Array.from(tracks.values());
  }
  if (Array.isArray(tracks)) {
    return tracks;
  }
  return [];
}

/**
 * Deep-clones a plain IR object using native structuredClone with JSON fallback.
 */
export function cloneIR<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fallback if object contains non-cloneable properties
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Safely extracts a human-readable error message from an unknown catch value.
 */
export function getErrorMessage(err: unknown, fallback = 'Unknown error'): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (typeof err === 'string' && err.length > 0) {
    return err;
  }
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}
