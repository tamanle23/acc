import { registerCoreModifierPlugins, type ResolvedTimeline } from '@acc/ir';
import { IRPreviewEngine } from '../../renderer';
import { DeterministicTimelineClock, UniversalCanvasProvider } from '@acc/core-isomorphic';
import { WebCanvasAdapter } from '@acc/core-web';
import { MediabunnyWorkerReader } from '../../renderer/workers/MediabunnyWorkerReader';
import { PreviewFrameMemoryManager } from '../../renderer/workers/PreviewFrameMemoryManager';
import { WorkerClipPrewarmer } from '../../renderer/workers/WorkerClipPrewarmer';
import { ContentHashTextureCache } from '../../renderer/workers/ContentHashTextureCache';

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
const videoReaders = new Map<string, MediabunnyWorkerReader>();
const clipPrewarmer = new WorkerClipPrewarmer(videoReaders);
const memoryManager = PreviewFrameMemoryManager.getInstance();
const textTextureCache = ContentHashTextureCache.getInstance();

// Dirty-Frame & Refresh Optimization state
let lastRenderedFrame: number | null = null;
let lastRenderedLOD: number | null = null;
let lastPopOutIntensity: number | null | undefined = null;
let lastDebugMode: string | null = null;
let texturesDirty = false;

// Frame coalescing state
let isRendering = false;
let pendingRender: { frame: number; lod: number; popOutIntensity?: number; isScrubbing?: boolean; debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha' } | null = null;

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
  popOutIntensity?: number,
  isScrubbing = false,
  clearColor = '#000000',
  debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha'
) {
  if (!canvas || !ctx || !engine) return;

  // 1. Dirty-Frame Optimization: Skip redraw if frame, LOD, and popOutIntensity haven't changed
  if (
    !texturesDirty &&
    !isScrubbing &&
    frame === lastRenderedFrame &&
    lod === lastRenderedLOD &&
    popOutIntensity === lastPopOutIntensity &&
    debugMode === lastDebugMode
  ) {
    return;
  }

  if (isRendering) {
    // Coalesce latest requested frame to avoid worker message queue pileup
    pendingRender = { frame, lod, popOutIntensity, isScrubbing, debugMode };
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
    const cachedBmp = memoryManager.get(seq.assetId, localFrame);
    if (cachedBmp && (cachedBmp.width === undefined || cachedBmp.width > 0)) {
      textureCache.set(seq.assetId, cachedBmp);
    } else {
      // Cache miss: Hold last rendered canvas frame (do not clear or replace with detached proxy)
      // and issue deduplicated request through MediabunnyWorkerReader's concurrency gate
      const assetId = seq.assetId;
      reader.requestFrame(localFrame, currentFps, isScrubbing).then((bmp) => {
        if (bmp && (bmp.width === undefined || bmp.width > 0)) {
          memoryManager.set(assetId, localFrame, bmp);
          textureCache.set(assetId, bmp);
          // Only trigger immediate repaint if paused / parked at this exact frame.
          // During active playback, this frame will be naturally painted on the next RAF tick.
          if (!isPlaying && currentFrame === frame) {
            texturesDirty = true;
            renderCurrentFrame(currentFrame, lod, popOutIntensity, false, clearColor);
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

  if (clearColor === 'transparent') {
    ctx.clearRect(0, 0, w, h);
  } else {
    ctx.fillStyle = clearColor || '#000000';
    ctx.fillRect(0, 0, w, h);
  }

  try {
    engine.renderFrame(frame, ctx as any, {
      textureCache,
      popOutIntensity,
      clearColor,
      debugMode,
    });
  } catch (err) {
    console.error('[preview.worker] Render error at frame', frame, err);
  } finally {
    ctx.restore();
    // Post-render drain: safely close evicted frames, protecting any frame actively drawn
    const protectedBitmaps = new Set<ImageBitmap>();
    for (const val of textureCache.values()) {
      if (val && typeof val.close === 'function') {
        protectedBitmaps.add(val);
      }
    }
    memoryManager.drainDisposalQueue(protectedBitmaps);
  }

  isRendering = false;
  texturesDirty = false;
  lastRenderedFrame = frame;
  lastRenderedLOD = lod;
  lastPopOutIntensity = popOutIntensity;
  lastDebugMode = debugMode ?? null;

  // Drain coalesced pending frame if one arrived during this draw pass
  if (pendingRender) {
    const next = pendingRender;
    pendingRender = null;
    renderCurrentFrame(next.frame, next.lod, next.popOutIntensity, next.isScrubbing, clearColor, next.debugMode);
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
      def.src.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i);

    if (isVideo) {
      if (!videoReaders.has(id)) {
        const reader = new MediabunnyWorkerReader(def.src, { ringBufferSize: 8 });
        videoReaders.set(id, reader);
        reader.init().catch(() => { });
      }
    } else {
      // Image asset fallback loading directly in worker
      if (!textureCache.has(id) && typeof fetch === 'function' && typeof createImageBitmap === 'function') {
        const url = def.src;
        const assetId = id;
        fetch(url)
          .then((res) => res.blob())
          .then((blob) => createImageBitmap(blob))
          .then((bmp) => {
            textureCache.set(assetId, bmp);
            texturesDirty = true;
            if (!isPlaying) {
              renderCurrentFrame(currentFrame, 1.0, 1.0, false);
            }
          })
          .catch(() => { });
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
      renderCurrentFrame(currentFrame, 1.0, data.popOutIntensity, false);
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
      renderCurrentFrame(
        currentFrame,
        data.lod ?? 1.0,
        data.popOutIntensity,
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
