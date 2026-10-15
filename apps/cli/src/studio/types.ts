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

/**
 * RFC 6902 JSON Patch operation definition.
 */
export type JsonPatchOpType = 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';

export interface JsonPatchOperation {
  op: JsonPatchOpType;
  path: string;
  value?: any;
  from?: string;
}

export interface TimelinePlayheadState {
  currentFrame: number;
  currentTime: number;
  isPlaying: boolean;
  fps: number;
  totalFrames: number;
  durationSeconds: number;
}

export interface ActiveClipInfo {
  sequenceId: string;
  trackId: string;
  trackType: string;
  assetId?: string;
  localFrame: number;
  startFrame: number;
  endFrame: number;
  durationFrames: number;
  modifiers: ModifierNode[];
  activeCues: TimedTextCue[];
}

export interface ResolvedFramePreview {
  frame: number;
  timeSeconds: number;
  totalFrames: number;
  fps: number;
  canvasSize: {
    w: number;
    h: number;
  };
  activeClips: ActiveClipInfo[];
  activeTextCues: Array<{
    text: string;
    startOffsetMs: number;
    endOffsetMs: number | 'end';
    sequenceId: string;
    trackId: string;
  }>;
  activeModifiers: Array<{
    type: string;
    params: Record<string, unknown>;
    sequenceId: string;
    trackId: string;
  }>;
}

export interface StudioRenderOptions {
  outputPath?: string;
  crf?: number;
  dryRun?: boolean;
  concurrency?: number;
  chunkStart?: number;
  chunkEnd?: number;
}

export interface StudioRenderResult {
  success: boolean;
  outputPath?: string;
  totalFrames: number;
  durationSeconds: number;
  fps: number;
  renderTimeMs: number;
  error?: string;
}
