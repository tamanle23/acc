import type { TimelineRenderModel, TimelineViewportState, ClipLayoutEntry } from './timelineTypes';
import { WaveformLODPyramid } from '../lib/timeline/WaveformLODPyramid';
import { ThumbnailLRUCache } from '../lib/timeline/ThumbnailLRUCache';

/**
 * 1D Interval Tree Entry for O(log N) horizontal timeline culling.
 */
interface IntervalNode {
  clip: ClipLayoutEntry;
  low: number;
  high: number;
  max: number;
  left?: IntervalNode;
  right?: IntervalNode;
}

class TimelineIntervalTree {
  private root?: IntervalNode;

  public build(clips: ClipLayoutEntry[]): void {
    const sorted = [...clips].sort((a, b) => a.startFrame - b.startFrame);
    this.root = this.buildSubtree(sorted);
  }

  private buildSubtree(clips: ClipLayoutEntry[]): IntervalNode | undefined {
    if (clips.length === 0) return undefined;
    const mid = Math.floor(clips.length / 2);
    const clip = clips[mid];
    const node: IntervalNode = {
      clip,
      low: clip.startFrame,
      high: clip.endFrame,
      max: clip.endFrame,
    };
    node.left = this.buildSubtree(clips.slice(0, mid));
    node.right = this.buildSubtree(clips.slice(mid + 1));
    if (node.left && node.left.max > node.max) node.max = node.left.max;
    if (node.right && node.right.max > node.max) node.max = node.right.max;
    return node;
  }

  public queryRange(startFrame: number, endFrame: number, results: ClipLayoutEntry[]): void {
    this.searchNode(this.root, startFrame, endFrame, results);
  }

  private searchNode(
    node: IntervalNode | undefined,
    startFrame: number,
    endFrame: number,
    results: ClipLayoutEntry[]
  ): void {
    if (!node) return;
    if (node.low <= endFrame && node.high >= startFrame) {
      results.push(node.clip);
    }
    if (node.left && node.left.max >= startFrame) {
      this.searchNode(node.left, startFrame, endFrame, results);
    }
    if (node.right && node.low <= endFrame) {
      this.searchNode(node.right, startFrame, endFrame, results);
    }
  }
}

/**
 * Timeline Worker state
 */
let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let model: TimelineRenderModel | null = null;
let viewport: TimelineViewportState = {
  scrollLeft: 0,
  scrollTop: 0,
  viewportWidth: 800,
  viewportHeight: 300,
  pixelsPerFrame: 4,
  dpr: 1.0,
};

const intervalTree = new TimelineIntervalTree();
// Pre-allocated array to eliminate GC allocation during horizontal queries
const visibleClipsScratch: ClipLayoutEntry[] = [];

// Pre-allocated Float32Array coordinate buffer: [x, y, w, h] per clip
let clipCoordsBuffer = new Float32Array(1024 * 4);

// Waveform LOD Pyramid cache: clipId -> WaveformLODPyramid
const waveformPyramidCache = new Map<string, WaveformLODPyramid>();

// Thumbnail LRU cache: bitmapUrl -> ImageBitmap
const thumbnailCache = new ThumbnailLRUCache<ImageBitmap>(64);

function ensureCoordsBufferSize(requiredClips: number): void {
  if (clipCoordsBuffer.length < requiredClips * 4) {
    clipCoordsBuffer = new Float32Array(Math.max(clipCoordsBuffer.length * 2, requiredClips * 4));
  }
}

function renderTimeline(): void {
  if (!canvas || !ctx || !model) return;

  const dpr = viewport.dpr || 1.0;
  const targetW = Math.max(1, Math.round(viewport.viewportWidth * dpr));
  const targetH = Math.max(1, Math.round(viewport.viewportHeight * dpr));

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  // If in DOM mode, clear canvas to transparent so it doesn't double-render beneath DOM
  if (model.mode === 'dom') {
    ctx.clearRect(0, 0, viewport.viewportWidth, viewport.viewportHeight);
    return;
  }

  // Clear timeline background for Canvas mode
  ctx.fillStyle = '#0f172a'; // slate-900
  ctx.fillRect(0, 0, viewport.viewportWidth, viewport.viewportHeight);

  const pixelsPerFrame = viewport.pixelsPerFrame;
  const scrollLeft = viewport.scrollLeft;
  const scrollTop = viewport.scrollTop;

  // Viewport bounds in frames
  const startFrame = Math.max(0, Math.floor(scrollLeft / pixelsPerFrame));
  const endFrame = Math.ceil((scrollLeft + viewport.viewportWidth) / pixelsPerFrame);

  // Query visible clips via Interval Tree
  visibleClipsScratch.length = 0;
  intervalTree.queryRange(startFrame, endFrame, visibleClipsScratch);

  const rowHeight = 44;

  // Draw Track Lanes
  ctx.save();
  ctx.translate(-scrollLeft, -scrollTop);

  const numTracks = model.tracks.length;
  for (let t = 0; t < numTracks; t++) {
    const y = t * rowHeight;
    ctx.fillStyle = t % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'rgba(15, 23, 42, 0.6)';
    ctx.fillRect(scrollLeft, y, viewport.viewportWidth, rowHeight - 2);

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(scrollLeft, y + rowHeight - 2);
    ctx.lineTo(scrollLeft + viewport.viewportWidth, y + rowHeight - 2);
    ctx.stroke();
  }

  // Draw Visible Clips
  ensureCoordsBufferSize(visibleClipsScratch.length);

  for (let i = 0; i < visibleClipsScratch.length; i++) {
    const clip = visibleClipsScratch[i];
    const x = clip.startFrame * pixelsPerFrame;
    const w = Math.max(8, clip.durationFrames * pixelsPerFrame);
    const y = clip.trackIndex * rowHeight + 2;
    const h = rowHeight - 6;

    // Clip body
    ctx.fillStyle = clip.color || '#3b82f6';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();

    // 1. Audio Waveform LOD rendering
    if (clip.type === 'audio' && clip.peaks && clip.peaks.length > 0) {
      let pyramid = waveformPyramidCache.get(clip.id);
      if (!pyramid) {
        pyramid = new WaveformLODPyramid(clip.peaks);
        waveformPyramidCache.set(clip.id, pyramid);
      }

      const lod = pyramid.selectLOD(pixelsPerFrame);
      const peaks = lod.peaks;
      const numBars = peaks.length;
      if (numBars > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 2, y + 2, Math.max(0, w - 4), h - 4);
        ctx.clip();

        const barWidth = Math.max(1, (w - 4) / numBars);
        const centerY = y + h / 2;
        const maxAmp = (h - 8) / 2;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        for (let b = 0; b < numBars; b++) {
          const amp = Math.max(0.05, Math.min(1.0, peaks[b])) * maxAmp;
          const bx = x + 2 + b * barWidth;
          ctx.fillRect(bx, centerY - amp, Math.max(1, barWidth - 1), amp * 2);
        }
        ctx.restore();
      }
    }

    // 2. Video Thumbnail Filmstrip rendering
    if (clip.type === 'video' && clip.thumbnailUrl) {
      const cachedBmp = thumbnailCache.get(clip.thumbnailUrl);
      if (cachedBmp) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, Math.max(0, w - 2), h - 2, 3);
        ctx.clip();
        ctx.globalAlpha = 0.35;
        const thumbW = 60;
        const count = Math.max(1, Math.floor(w / thumbW));
        for (let t = 0; t < count; t++) {
          ctx.drawImage(cachedBmp, x + t * thumbW, y, thumbW, h);
        }
        ctx.restore();
      }
    }

    // Clip border & Selection highlight
    const isSelected = model.selectedClipId === clip.id;
    if (isSelected) {
      ctx.strokeStyle = '#22d3ee'; // cyan-400
      ctx.lineWidth = 2;
      ctx.stroke();

      // Trim handle grips
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(x + 1, y + h / 2 - 6, 2, 12);
      ctx.fillRect(x + w - 3, y + h / 2 - 6, 2, 12);
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px ui-monospace, SFMono-Regular, monospace';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 4, y, Math.max(0, w - 8), h);
    ctx.clip();
    ctx.fillText(clip.name || clip.id, x + 8, y + h / 2);
    ctx.restore();
  }

  // Draw Ghost Drag preview if dragging
  if (model.ghostDrag) {
    const gx = model.ghostDrag.startFrame * pixelsPerFrame;
    const gw = Math.max(8, model.ghostDrag.durationFrames * pixelsPerFrame);
    const gy = model.ghostDrag.trackIndex * rowHeight + 2;
    const gh = rowHeight - 6;

    ctx.save();
    ctx.fillStyle = model.ghostDrag.isValid ? 'rgba(34, 211, 238, 0.25)' : 'rgba(239, 68, 68, 0.25)';
    ctx.strokeStyle = model.ghostDrag.isValid ? '#22d3ee' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.roundRect(gx, gy, gw, gh, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

self.onmessage = (e: MessageEvent) => {
  const data = e.data;
  if (!data) return;

  switch (data.type) {
    case 'init': {
      canvas = data.canvas;
      if (canvas) {
        ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
      }
      if (data.viewport) {
        viewport = { ...viewport, ...data.viewport };
      }
      if (data.model) {
        model = data.model;
        intervalTree.build(model?.clips || []);
      }
      renderTimeline();
      self.postMessage({ type: 'ready' });
      break;
    }
    case 'updateViewport': {
      viewport = { ...viewport, ...data.viewport };
      renderTimeline();
      break;
    }
    case 'updateModel': {
      model = data.model;
      intervalTree.build(model?.clips || []);
      renderTimeline();
      break;
    }
    case 'render': {
      renderTimeline();
      break;
    }
  }
};
