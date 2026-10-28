// Defensive worker environment polyfill to avoid runtime errors from Vite HMR / React Refresh
if (typeof self !== 'undefined' && typeof (self as any).window === 'undefined') {
  (self as any).window = self;
}

import { registerCoreModifierPlugins, type ResolvedTimeline } from '@acc/ir';
import { IRPreviewEngine } from '../IRPreviewEngine';
import { DeterministicTimelineClock, UniversalCanvasProvider, ContentCacheRegistry } from '@acc/core-isomorphic';
import { WebCanvasAdapter } from '@acc/core-web';
import { MediabunnyWorkerReader } from './MediabunnyWorkerReader';
import { PreviewFrameMemoryManager } from './PreviewFrameMemoryManager';
import { WorkerClipPrewarmer } from './WorkerClipPrewarmer';
import { ContentHashTextureCache } from './ContentHashTextureCache';

// Register isomorphic canvas adapter and canonical core modifiers for the dedicated worker thread
UniversalCanvasProvider.registerAdapter(new WebCanvasAdapter(), true);
registerCoreModifierPlugins();

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
const MAX_WORKER_TEXTURES = 32;

function safeSetTexture(id: string, bmp: any): void {
  const existing = textureCache.get(id);
  if (existing && existing !== bmp) {
    if (typeof existing.close === 'function') {
      try {
        existing.close();
      } catch {}
    }
  }

  if (textureCache.size >= MAX_WORKER_TEXTURES && !textureCache.has(id)) {
    const oldestKey = textureCache.keys().next().value;
    if (oldestKey) {
      const oldBmp = textureCache.get(oldestKey);
      if (oldBmp && typeof oldBmp.close === 'function') {
        try {
          oldBmp.close();
        } catch {}
      }
      textureCache.delete(oldestKey);
    }
  }

  textureCache.set(id, bmp);
}

const videoReaders = new Map<string, MediabunnyWorkerReader>();
const clipPrewarmer = new WorkerClipPrewarmer(videoReaders);
const memoryManager = PreviewFrameMemoryManager.getInstance();
const textTextureCache = ContentHashTextureCache.getInstance();
void textTextureCache;


// Dirty-Frame & Refresh Optimization state
let lastRenderedFrame: number | null = null;
let lastRenderedLOD: number | null = null;
let lastDebugMode: string | null = null;
let texturesDirty = false;

// Frame coalescing state
let isRendering = false;
let pendingRender: {
  frame: number;
  lod: number;
  isScrubbing?: boolean;
  clearColor?: string;
  debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha';
} | null = null;

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
  isScrubbing = false,
  clearColor = '#000000',
  debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha'
) {
  if (!canvas || !ctx || !engine) return;

  // 1. Dirty-Frame Optimization: Skip redraw if frame, LOD, and debugMode haven't changed
  if (
    !texturesDirty &&
    !isScrubbing &&
    frame === lastRenderedFrame &&
    lod === lastRenderedLOD &&
    debugMode === lastDebugMode
  ) {
    return;
  }

  if (isRendering) {
    // Coalesce latest requested frame to avoid worker message queue pileup
    pendingRender = { frame, lod, isScrubbing, clearColor, debugMode };
    return;
  }

  isRendering = true;
  const w = currentWidth;
  const h = currentHeight;

  // 2. Lookahead Pre-warming of upcoming clips within 1.5s & active 4-frame sequential lookahead
  clipPrewarmer.prewarmUpcomingClips(frame, currentFps, isPlaying);

  // 3. Resolve active video frames from Mediabunny readers or MemoryManager using clip-local frames
  const activeSeqs = engine.seek(frame).activeSequences;
  for (const seq of activeSeqs) {
    if (!seq.assetId) continue;
    const reader = videoReaders.get(seq.assetId);
    if (!reader) continue;

    const localFrame = Math.max(0, frame - (seq.startFrame ?? 0));
    if (isPlaying) {
      // 1. Sequential Playback Path:
      // Consume frame from lookahead memory manager so it does not linger in memory
      const cachedBmp = memoryManager.take(seq.assetId, localFrame);
      if (cachedBmp && (cachedBmp.width === undefined || cachedBmp.width > 0)) {
        (cachedBmp as any)._isTransient = true;
        safeSetTexture(seq.assetId, cachedBmp);
      } else {
        const assetId = seq.assetId;
        reader.requestFrame(localFrame, currentFps, false).then((bmp) => {
          if (bmp && (bmp.width === undefined || bmp.width > 0)) {
            (bmp as any)._isTransient = true;
            safeSetTexture(assetId, bmp);
          }
        });
      }
    } else {
      // 2. Scrubbing / Paused Path:
      // Cache in strict LRU scrub cache
      const cachedBmp = memoryManager.get(seq.assetId, localFrame);
      if (cachedBmp && (cachedBmp.width === undefined || cachedBmp.width > 0)) {
        safeSetTexture(seq.assetId, cachedBmp);
      } else {
        const assetId = seq.assetId;
        reader.requestFrame(localFrame, currentFps, isScrubbing).then((bmp) => {
          if (bmp && (bmp.width === undefined || bmp.width > 0)) {
            memoryManager.set(assetId, localFrame, bmp);
            safeSetTexture(assetId, bmp);
            if (!isPlaying && currentFrame === frame) {
              texturesDirty = true;
              renderCurrentFrame(currentFrame, lod, false, clearColor, debugMode);
            }
          }
        });
      }
    }
  }

  ctx.save();
  if (lod < 1.0) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'low';
  }

  if (clearColor === 'transparent') {
    ctx.clearRect(0, 0, w, h);
  } else {
    ctx.fillStyle = clearColor || '#000000';
    ctx.fillRect(0, 0, w, h);
  }

  const workerAssetResolver = {
    has: (id: string) => textureCache.has(id),
    get: (id: string) => textureCache.get(id),
    onAssetDrawn: (assetId: string, asset: any) => {
      if (asset && (asset as any)._isTransient && typeof (asset as any).close === 'function') {
        try {
          (asset as any).close();
        } catch {}
        if (textureCache.get(assetId) === asset) {
          textureCache.delete(assetId);
        }
      }
    },
  };

  try {
    engine.renderFrame(frame, ctx as any, {
      textureCache: workerAssetResolver as any,
      clearColor,
      debugMode,
    });
  } catch (err) {
    console.error('[preview.worker] Render error at frame', frame, err);
  } finally {
    ctx.restore();
    // Synchronously close any remaining playback transient bitmaps in textureCache
    for (const [id, val] of textureCache.entries()) {
      if (val && (val as any)._isTransient && typeof (val as any).close === 'function') {
        try {
          (val as any).close();
        } catch {}
        textureCache.delete(id);
      }
    }
  }

  isRendering = false;
  texturesDirty = false;
  lastRenderedFrame = frame;
  lastRenderedLOD = lod;
  lastDebugMode = debugMode ?? null;

  if (pendingRender) {
    const next = pendingRender;
    pendingRender = null;
    renderCurrentFrame(
      next.frame,
      next.lod,
      next.isScrubbing,
      next.clearColor ?? clearColor,
      next.debugMode
    );
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
  renderCurrentFrame(currentFrame, 0.5, false);

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
  renderCurrentFrame(currentFrame, 1.0, false);
}

function syncAssetSources(assets: Record<string, { src?: string; type?: string }>) {
  const activeIds = new Set(Object.keys(assets));

  // 1. Evict and dispose stale video readers to free hardware decoders
  for (const [id, reader] of videoReaders.entries()) {
    if (!activeIds.has(id)) {
      reader.dispose();
      videoReaders.delete(id);
      const oldBmp = textureCache.get(id);
      if (oldBmp && typeof oldBmp.close === 'function') {
        try {
          oldBmp.close();
        } catch {}
      }
      textureCache.delete(id);
    }
  }

  // 2. Sync incoming assets
  for (const [id, def] of Object.entries(assets)) {
    if (!def.src) continue;
    const isVideo =
      def.type === 'video' || Boolean(def.src.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i));

    if (isVideo) {
      if (!videoReaders.has(id)) {
        const reader = new MediabunnyWorkerReader(def.src, { assetId: id });
        videoReaders.set(id, reader);
        reader.init().catch(() => {});
      }
    } else {
      if (
        !textureCache.has(id) &&
        typeof createImageBitmap === 'function'
      ) {
        const url = def.src;
        const assetId = id;

        // Attempt zero-copy retrieval from ContentCacheRegistry before network fetch
        const resolveBlob = async (): Promise<Blob | null> => {
          try {
            const cache = ContentCacheRegistry.get();
            const cached = (await cache.get(assetId)) || (await cache.get(url));
            if (cached) return cached;
          } catch {}
          if (typeof fetch === 'function') {
            const res = await fetch(url);
            const blob = await res.blob();
            // Store to cache asynchronously
            try {
              const cache = ContentCacheRegistry.get();
              cache.set(assetId, blob).catch(() => {});
            } catch {}
            return blob;
          }
          return null;
        };

        resolveBlob()
          .then((blob) => (blob ? createImageBitmap(blob) : null))
          .then((bmp) => {
            if (bmp) {
              safeSetTexture(assetId, bmp);
              texturesDirty = true;
              if (!isPlaying) {
                renderCurrentFrame(currentFrame, 1.0, false);
              }
            }
          })
          .catch(() => {});
      }
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
      ctx = canvas.getContext('2d', {
        willReadFrequently: false,
      }) as OffscreenCanvasRenderingContext2D;

      if (data.timeline) {
        currentTimeline = data.timeline;
        engine = new IRPreviewEngine(data.timeline);
        clipPrewarmer.setTimeline(data.timeline);
      }

      if (data.assets) {
        syncAssetSources(data.assets);
      }

      self.postMessage({ type: 'ready' });
      texturesDirty = true;
      renderCurrentFrame(currentFrame, 1.0, false);
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
      renderCurrentFrame(currentFrame, 1.0, false);
      break;
    }

    case 'syncAssets': {
      if (data.assets) {
        syncAssetSources(data.assets);
      }
      break;
    }

    case 'resize': {
      if (data.width) currentWidth = data.width;
      if (data.height) currentHeight = data.height;
      if (canvas) {
        canvas.width = currentWidth;
        canvas.height = currentHeight;
      }
      texturesDirty = true;
      renderCurrentFrame(currentFrame, 1.0, false);
      break;
    }

    case 'renderFrame': {
      currentFrame = data.frame;
      const isScrub = Boolean(data.isScrubbing);
      renderCurrentFrame(
        currentFrame,
        data.lod ?? 1.0,
        isScrub,
        data.clearColor ?? '#000000',
        data.debugMode
      );
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
          safeSetTexture(id, bmp);
        }
        texturesDirty = true;
        if (!isPlaying) {
          renderCurrentFrame(currentFrame, 1.0, false);
        }
      }
      break;
    }
  }
};
