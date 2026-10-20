export interface ClipLayoutEntry {
  id: string;
  trackId: string;
  startFrame: number;
  durationFrames: number;
  endFrame: number;
  trackIndex: number;
  type: 'video' | 'audio' | 'overlay';
  color: string;
  name: string;
  peaks?: number[];
  thumbnailUrl?: string;
}

export interface TimelineRenderModel {
  tracks: Array<{
    id: string;
    type: 'video' | 'audio' | 'overlay';
    name?: string;
    isLocked?: boolean;
    isMuted?: boolean;
  }>;
  clips: ClipLayoutEntry[];
  totalFrames: number;
  fps: number;
  mode?: 'dom' | 'canvas';
  selectedClipId?: string | null;
  ghostDrag?: {
    seqId: string;
    startFrame: number;
    durationFrames: number;
    trackIndex: number;
    isValid: boolean;
  } | null;
}

export interface TimelineViewportState {
  scrollLeft: number;
  scrollTop: number;
  viewportWidth: number;
  viewportHeight: number;
  pixelsPerFrame: number;
  dpr: number;
}
