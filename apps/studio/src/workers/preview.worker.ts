import { IRPreviewEngine, type ResolvedTimeline } from '@acc/ir';
import { DeterministicTimelineClock } from '@acc/core-isomorphic';
import { MediabunnyWorkerReader } from './MediabunnyWorkerReader';
import { PreviewFrameMemoryManager } from './PreviewFrameMemoryManager';
import { WorkerClipPrewarmer } from './WorkerClipPrewarmer';
import { ContentHashTextureCache } from './ContentHashTextureCache';

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let engine: IRPreviewEngine | null = null;
let currentTimeline: ResolvedTimeline | null = null;
let currentWidth = 1920;
let currentHeight = 1080;
let currentFps = 30;
let currentTotalFrames = 300;
let currentFrame = 0;

// Texture and video reader registries
const textureCache = new Map<string, any>();
const videoReaders = new Map<string, MediabunnyWorkerReader>();
const clipPrewarmer = new WorkerClipPrewarmer(videoReaders);
const memoryManager = PreviewFrameMemoryManager.getInstance();
const textTextureCache = ContentHashTextureCache.getInstance();

// Dirty-Frame & Refresh Optimization state
let lastRenderedFrame: number | null = null;
let lastRenderedLOD: number | null = null;
let lastPopOutIntensity: number | null = null;
let texturesDirty = false;

// Frame coalescing state
let isRendering = false;
let pendingRender: { frame: number; lod: number; popOutIntensity: number; isScrubbing?: boolean } | null = null;

// Playback state
let isPlaying = false;
let shuttleSpeed = 0;
let rafId: number | null = null;
let lastRafTime = 0;
let lastUiSyncTime = 0;
let workerClock: DeterministicTimelineClock | null = null;

function renderCurrentFrame(
  frame: number,
  lod = 1.0,
  popOutIntensity = 1.0,
  isScrubbing = false
) {
  if (!canvas || !ctx || !engine) return;

  // 1. Dirty-Frame Optimization: Skip redraw if frame, LOD, and popOutIntensity haven't changed
  if (
    !texturesDirty &&
    !isScrubbing &&
    frame === lastRenderedFrame &&
    lod === lastRenderedLOD &&
    popOutIntensity === lastPopOutIntensity
  ) {
    return;
  }

  if (isRendering) {
    // Coalesce latest requested frame to avoid worker message queue pileup
    pendingRender = { frame, lod, popOutIntensity, isScrubbing };
    return;
  }

  isRendering = true;
  const w = currentWidth;
  const h = currentHeight;

  // 2. Lookahead Pre-warming of upcoming clips within 1.5s
  clipPrewarmer.prewarmUpcomingClips(frame, currentFps);

  // 3. Resolve active video frames from Mediabunny readers or MemoryManager
  for (const [assetId, reader] of videoReaders) {
    const cachedBmp = memoryManager.get(assetId, frame) || reader.getFrame(frame);
    if (cachedBmp) {
      textureCache.set(assetId, cachedBmp);
    } else {
      // Async decode requested if not in buffer
      reader.requestFrame(frame, currentFps, isScrubbing).then((bmp) => {
        if (bmp) {
          textureCache.set(assetId, bmp);
          memoryManager.set(assetId, frame, bmp);
          // If paused or idling, trigger immediate repaint with new frame
          if (!isPlaying) {
            texturesDirty = true;
            renderCurrentFrame(currentFrame, lod, popOutIntensity, false);
          }
        }
      });
    }
  }

  ctx.save();
  if (lod < 1.0) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
  }

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  try {
    engine.renderFrame(frame, ctx as any, {
      textureCache,
      popOutIntensity,
    });
  } catch (err) {
    // Graceful render error suppression during fast scrubs
  }

  ctx.restore();
  isRendering = false;
  texturesDirty = false;
  lastRenderedFrame = frame;
  lastRenderedLOD = lod;
  lastPopOutIntensity = popOutIntensity;

  // Drain coalesced pending frame if one arrived during this draw pass
  if (pendingRender) {
    const next = pendingRender;
    pendingRender = null;
    renderCurrentFrame(next.frame, next.lod, next.popOutIntensity, next.isScrubbing);
  }
}

function playbackLoop(now: number) {
  if (!isPlaying || shuttleSpeed === 0 || !workerClock) return;

  const deltaMs = now - lastRafTime;
  lastRafTime = now;

  const clockState = workerClock.tick(deltaMs / 1000);
  currentFrame = clockState.currentFrame;

  if (currentFrame >= currentTotalFrames) {
    currentFrame = currentTotalFrames;
    stopPlayback();
    self.postMessage({ type: 'frameUpdate', frame: currentFrame, ended: true });
    return;
  } else if (currentFrame <= 0) {
    currentFrame = 0;
    stopPlayback();
    self.postMessage({ type: 'frameUpdate', frame: currentFrame, ended: true });
    return;
  }

  // Active playback renders at 0.5x Dynamic LOD for maximum smoothness
  renderCurrentFrame(currentFrame, 0.5, 1.0, false);

  // Throttle React UI state synchronization to 15 Hz (~66ms) to eliminate React lag
  if (now - lastUiSyncTime >= 66) {
    lastUiSyncTime = now;
    self.postMessage({ type: 'frameUpdate', frame: currentFrame });
  }

  rafId = requestAnimationFrame(playbackLoop);
}

function stopPlayback() {
  isPlaying = false;
  shuttleSpeed = 0;
  if (workerClock) {
    workerClock.pause();
  }
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  // Parked hero frame: Render crystal-clear 1.0x full LOD
  texturesDirty = true;
  renderCurrentFrame(currentFrame, 1.0, 1.0, false);
}

function syncAssetSources(assets: Record<string, { src?: string; type?: string }>) {
  for (const [id, def] of Object.entries(assets)) {
    if (!def.src) continue;
    const isVideo =
      def.type === 'video' ||
      def.type === 'media' ||
      def.src.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i);

    if (isVideo && !videoReaders.has(id)) {
      const reader = new MediabunnyWorkerReader(def.src, { ringBufferSize: 8 });
      videoReaders.set(id, reader);
      reader.init().catch(() => {});
    }
  }
}

self.onmessage = (e: MessageEvent) => {
  const data = e.data;
  if (!data || !data.type) return;

  switch (data.type) {
    case 'init': {
      canvas = data.canvas as OffscreenCanvas;
      currentWidth = data.width || 1920;
      currentHeight = data.height || 1080;
      currentFps = data.fps || 30;
      currentTotalFrames = data.totalFrames || 300;
      canvas.width = currentWidth;
      canvas.height = currentHeight;
      ctx = canvas.getContext('2d', { willReadFrequently: false }) as OffscreenCanvasRenderingContext2D;

      if (data.timeline) {
        currentTimeline = data.timeline;
        engine = new IRPreviewEngine(data.timeline);
        clipPrewarmer.setTimeline(data.timeline);
      }

      if (data.assets) {
        syncAssetSources(data.assets);
      }

      self.postMessage({ type: 'ready' });
      // Render initial hero frame immediately upon worker initialization
      texturesDirty = true;
      renderCurrentFrame(currentFrame, 1.0, 1.0, false);
      break;
    }

    case 'updateTimeline': {
      if (data.timeline) {
        currentTimeline = data.timeline;
        engine = new IRPreviewEngine(data.timeline);
        clipPrewarmer.setTimeline(data.timeline);
      }
      if (data.totalFrames) currentTotalFrames = data.totalFrames;
      if (data.fps) currentFps = data.fps;
      if (data.assets) {
        syncAssetSources(data.assets);
      }
      texturesDirty = true;
      renderCurrentFrame(currentFrame, 1.0, data.popOutIntensity ?? 1.0, false);
      break;
    }

    case 'syncAssets': {
      if (data.assets) {
        syncAssetSources(data.assets);
      }
      break;
    }

    case 'renderFrame': {
      currentFrame = data.frame;
      const isScrub = !!data.isScrubbing;
      renderCurrentFrame(currentFrame, data.lod ?? 1.0, data.popOutIntensity ?? 1.0, isScrub);
      break;
    }

    case 'startPlayback': {
      shuttleSpeed = data.speed ?? 1;
      currentFrame = data.startFrame ?? currentFrame;
      currentFps = data.fps ?? currentFps;
      currentTotalFrames = data.totalFrames ?? currentTotalFrames;
      isPlaying = true;
      lastRafTime = performance.now();
      lastUiSyncTime = performance.now();

      workerClock = new DeterministicTimelineClock({
        fps: currentFps,
        totalFrames: currentTotalFrames,
        mode: 'monotonic_worker',
      });
      workerClock.play(currentFrame, shuttleSpeed);

      rafId = requestAnimationFrame(playbackLoop);
      break;
    }

    case 'stopPlayback': {
      stopPlayback();
      break;
    }

    case 'updateTextures': {
      if (data.textures) {
        for (const [id, bmp] of Object.entries(data.textures)) {
          textureCache.set(id, bmp);
        }
        texturesDirty = true;
        // If parked/paused, re-render immediately with newly synchronized textures
        if (!isPlaying) {
          renderCurrentFrame(currentFrame, 1.0, 1.0, false);
        }
      }
      break;
    }
  }
};
