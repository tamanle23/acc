// Defensive worker environment polyfill to avoid runtime errors from Vite HMR / React Refresh
if (typeof self !== 'undefined' && typeof (self as any).window === 'undefined') {
  (self as any).window = self;
}

import {
  registerCoreModifierPlugins,
  ModifierPluginRegistry,
  type ModifierContext,
  type ResolvedTimeline,
  TemporalCadenceResolver,
} from '@acc/ir';
import { IRPreviewEngine } from '../IRPreviewEngine';
import {
  UniversalCanvasProvider,
  ContentCacheRegistry,
  CacheNamespace,
  NativeResourceManager,
  VisionEngineRegistry,
} from '@acc/core-isomorphic';
import { WebCanvasAdapter, bootstrapCoreWeb } from '@acc/core-web';
import type { PreviewWorkerMessage, PreviewWorkerResponse } from '../SidecarTypes';
import { MediabunnyWorkerReader } from './MediabunnyWorkerReader';
import { PreviewFrameMemoryManager } from './PreviewFrameMemoryManager';
import { WorkerClipPrewarmer } from './WorkerClipPrewarmer';
import { ContentHashTextureCache } from './ContentHashTextureCache';
import { WebCodecsDecoderPool } from './WebCodecsDecoderPool';

// Centralized WebCodecs hardware decoder lease pool
const decoderPool = WebCodecsDecoderPool.getInstance();

// Register isomorphic canvas adapter and canonical core modifiers for the dedicated worker thread
bootstrapCoreWeb();
UniversalCanvasProvider.registerAdapter(new WebCanvasAdapter(), true);
const modifierPluginRegistry = registerCoreModifierPlugins(ModifierPluginRegistry.createIsolated());
registerCoreModifierPlugins();

const canceledSidecarTaskIds = new Set<string>();

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
const MAX_WORKER_TEXTURES = 8;
const textureDisposalQueue: any[] = [];

function drainDisposalQueue(): void {
  while (textureDisposalQueue.length > 0) {
    const old = textureDisposalQueue.pop();
    if (old && typeof old.close === 'function') {
      try {
        old.close();
      } catch { }
    }
  }
}

function safeSetTexture(id: string, bmp: any): void {
  const existing = textureCache.get(id);
  if (existing && existing !== bmp) {
    if (typeof existing.close === 'function') {
      if (isRendering) {
        textureDisposalQueue.push(existing);
      } else {
        try {
          existing.close();
        } catch { }
      }
    }
  }

  if (textureCache.size >= MAX_WORKER_TEXTURES && !textureCache.has(id)) {
    const oldestKey = textureCache.keys().next().value;
    if (oldestKey) {
      const oldBmp = textureCache.get(oldestKey);
      if (oldBmp && typeof oldBmp.close === 'function') {
        if (isRendering) {
          textureDisposalQueue.push(oldBmp);
        } else {
          try {
            oldBmp.close();
          } catch { }
        }
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
  isSequentialPlayback?: boolean;
} | null = null;

// Playback state
let isPlaying = false;
let currentClearColor = '#000000';

// Double-buffering: Private offscreen back-buffer eliminates front-canvas black flashes
let backCanvas: OffscreenCanvas | null = null;
let backCtx: OffscreenCanvasRenderingContext2D | null = null;

function ensureBackBuffer(w: number, h: number): void {
  if (!backCanvas || backCanvas.width !== w || backCanvas.height !== h) {
    backCanvas = new OffscreenCanvas(w, h);
    backCtx = backCanvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D;
  }
}

async function renderCurrentFrame(
  frame: number,
  lod = 1.0,
  isScrubbing = false,
  clearColor = '#000000',
  debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha',
  isSequentialPlayback = false
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
    pendingRender = { frame, lod, isScrubbing, clearColor, debugMode, isSequentialPlayback };
    return;
  }

  isRendering = true;
  const renderStart = performance.now();
  const w = currentWidth;
  const h = currentHeight;
  const frameScope = NativeResourceManager.getInstance().createFrameScope();

  // 2. Lookahead Pre-warming of upcoming clips within 1.5s & active 4-frame sequential lookahead
  const activePlaying = isPlaying || isSequentialPlayback;
  clipPrewarmer.prewarmUpcomingClips(frame, currentFps, activePlaying);

  // 3. Resolve active video frames from Mediabunny readers or MemoryManager using clip-local frames
  const activeSeqs = engine.seek(frame).activeSequences;
  const activeVideoAssetIds = new Set<string>();
  for (const seq of activeSeqs) {
    if (seq.assetId && videoReaders.has(seq.assetId)) {
      activeVideoAssetIds.add(seq.assetId);
    }
  }

  // Update hardware decoder lease priorities based on active timeline sequences
  decoderPool.updatePriorities({
    playheadFrame: frame,
    fps: currentFps,
    activeAssetIds: activeVideoAssetIds,
    timeline: currentTimeline || undefined,
  });

  const frameResolutions = activeSeqs.map(async (seq) => {
    if (!seq.assetId) return;
    const reader = videoReaders.get(seq.assetId);
    if (!reader) return;

    const cadence = TemporalCadenceResolver.resolve({
      timelineFrame: frame,
      timelineFps: currentFps,
      sequenceStartFrame: seq.startFrame ?? 0,
      trimInSec: seq.trimInSec,
      speed: seq.speed,
    });
    const localFrame = cadence.sourceFrameIndex;
    const assetId = seq.assetId;

    const useSequential = isPlaying || isSequentialPlayback;
    if (useSequential) {
      // 1. Zero-Alloc Sequential Playback Path via Circular Ping-Pong Buffer:
      await decoderPool.acquireLease(assetId, 1000);
      const canvasSlot = await reader.requestSequentialFrame(localFrame, currentFps);
      if (canvasSlot) {
        safeSetTexture(assetId, canvasSlot);
      }
    } else {
      // 2. Scrubbing / Paused Path:
      // Cache in strict LRU scrub cache
      const cachedBmp = memoryManager.get(seq.assetId, localFrame);
      if (cachedBmp && (cachedBmp.width === undefined || cachedBmp.width > 0)) {
        safeSetTexture(seq.assetId, cachedBmp);
      } else {
        await decoderPool.acquireLease(assetId, 1000);
        const bmp = await reader.requestFrame(localFrame, currentFps, isScrubbing);
        if (bmp && (bmp.width === undefined || bmp.width > 0)) {
          memoryManager.set(assetId, localFrame, bmp);
          safeSetTexture(assetId, bmp);
        }
      }
    }
  });

  await Promise.all(frameResolutions);

  ensureBackBuffer(w, h);
  if (!backCtx) return;

  backCtx.save();
  if (lod < 1.0) {
    backCtx.imageSmoothingEnabled = true;
    backCtx.imageSmoothingQuality = 'low';
  }

  const workerAssetResolver = {
    has: (id: string) => textureCache.has(id),
    get: (id: string) => textureCache.get(id),
    onAssetDrawn: (assetId: string, asset: any) => {
      // Only close transient one-off textures (e.g. scratch canvases) that are not shared ping-pong slots
      if (
        asset &&
        (asset as any)._isTransient &&
        !(asset as any)._isShared &&
        typeof (asset as any).close === 'function'
      ) {
        try {
          (asset as any).close();
        } catch { }
        if (textureCache.get(assetId) === asset) {
          textureCache.delete(assetId);
        }
      }
    },
  };

  try {
    await engine.renderFrameAsync(frame, backCtx as any, {
      textureCache: workerAssetResolver as any,
      clearColor,
      debugMode,
    });

    // ATOMIC FRONT-BUFFER FLIP:
    // Blit completed frame from private back-buffer to transferred onscreen canvas in a single draw call.
    // If an active playing video clip was on the timeline but missed its texture (decode latency),
    // retain the existing front-buffer to guarantee zero black frame flashes.
    let hasMissingActiveTexture = false;
    if (activePlaying && activeVideoAssetIds.size > 0) {
      for (const assetId of activeVideoAssetIds) {
        if (!textureCache.has(assetId) || !textureCache.get(assetId)) {
          hasMissingActiveTexture = true;
          break;
        }
      }
    }

    if (!hasMissingActiveTexture) {
      ctx.drawImage(backCanvas!, 0, 0);
    }
  } catch (err) {
    console.error('[preview.worker] Render error at frame', frame, err);
  } finally {
    frameScope.dispose();
    backCtx.restore();
    drainDisposalQueue();
    // Synchronously close any remaining unshared transient bitmaps in disposal queue
    for (const [id, val] of textureCache.entries()) {
      if (
        val &&
        (val as any)._isTransient &&
        !(val as any)._isShared &&
        typeof (val as any).close === 'function'
      ) {
        try {
          (val as any).close();
        } catch { }
        textureCache.delete(id);
      }
    }
    isRendering = false;
  }

  texturesDirty = false;
  lastRenderedFrame = frame;
  lastRenderedLOD = lod;
  lastDebugMode = debugMode ?? null;

  // Post back actual frameRendered telemetry with real hardware render latency
  self.postMessage({
    type: 'frameRendered',
    frame,
    renderLatencyMs: Math.round((performance.now() - renderStart) * 10) / 10,
  });

  if (pendingRender) {
    const next = pendingRender;
    pendingRender = null;
    void renderCurrentFrame(
      next.frame,
      next.lod,
      next.isScrubbing,
      next.clearColor ?? clearColor,
      next.debugMode,
      next.isSequentialPlayback
    );
  }
}



function syncAssetSources(assets: Record<string, { src?: string; type?: string }>) {
  const activeIds = new Set(Object.keys(assets));

  // 1. Evict and dispose stale video readers to free hardware decoders
  for (const [id, reader] of videoReaders.entries()) {
    if (!activeIds.has(id)) {
      decoderPool.unregister(id);
      reader.dispose();
      videoReaders.delete(id);
      const oldBmp = textureCache.get(id);
      if (oldBmp && typeof oldBmp.close === 'function') {
        try {
          oldBmp.close();
        } catch { }
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
        decoderPool.register(id, reader);
        // Note: Hardware leases are assigned on-demand via decoderPool.acquireLease()
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
            const cache = ContentCacheRegistry.namespace(CacheNamespace.Assets);
            const cached = (await cache.get(assetId)) || (await cache.get(url));
            if (cached) return cached;
          } catch { }
          if (typeof fetch === 'function') {
            const res = await fetch(url);
            const blob = await res.blob();
            // Store to cache asynchronously
            try {
              const cache = ContentCacheRegistry.namespace(CacheNamespace.Assets);
              cache.set(assetId, blob).catch(() => { });
            } catch { }
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
                void renderCurrentFrame(currentFrame, 1.0, false, currentClearColor);
              }
            }
          })
          .catch(() => { });
      }
    }
  }
}

self.onmessage = async (e: MessageEvent) => {
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
        willReadFrequently: true,
      }) as OffscreenCanvasRenderingContext2D;

      if (data.timeline) {
        currentTimeline = data.timeline;
        engine = new IRPreviewEngine(data.timeline, undefined, undefined, 48000, {
          sidecarCoordinator: null,
          autoPreflight: false,
        });
        clipPrewarmer.setTimeline(data.timeline);
      }

      if (data.assets) {
        syncAssetSources(data.assets);
      }

      self.postMessage({ type: 'ready' });
      texturesDirty = true;
      if (!isPlaying) {
        renderCurrentFrame(currentFrame, 1.0, false);
      }
      break;
    }

    case 'updateTimeline': {
      if (currentTimeline?.sequences) {
        const resourceManager = NativeResourceManager.getInstance();
        for (const seq of currentTimeline.sequences.values()) {
          if (seq?.id) {
            resourceManager.disposeSequenceScope(seq.id);
          }
        }
      }
      if (data.timeline) {
        currentTimeline = data.timeline;
        engine = new IRPreviewEngine(data.timeline, undefined, undefined, 48000, {
          sidecarCoordinator: null,
          autoPreflight: false,
        });
        clipPrewarmer.setTimeline(data.timeline);
      }
      if (data.totalFrames) currentTotalFrames = data.totalFrames;
      if (data.fps) currentFps = data.fps;
      if (data.assets) {
        syncAssetSources(data.assets);
      }
      texturesDirty = true;
      if (!isPlaying) {
        renderCurrentFrame(currentFrame, 1.0, false);
      }
      break;
    }

    case 'syncAssets': {
      if (data.assets) {
        syncAssetSources(data.assets);
      }
      break;
    }

    case 'resize': {
      const newWidth = data.width || currentWidth;
      const newHeight = data.height || currentHeight;
      if (newWidth !== currentWidth || newHeight !== currentHeight) {
        currentWidth = newWidth;
        currentHeight = newHeight;
        if (canvas && (canvas.width !== currentWidth || canvas.height !== currentHeight)) {
          canvas.width = currentWidth;
          canvas.height = currentHeight;
        }
        ensureBackBuffer(currentWidth, currentHeight);
        texturesDirty = true;
        renderCurrentFrame(currentFrame, 1.0, false);
      }
      break;
    }

    case 'renderFrame': {
      if (typeof data.frame === 'number') {
        currentFrame = data.frame;
      }
      if (data.clearColor) {
        currentClearColor = data.clearColor;
      }
      const isScrub = Boolean(data.isScrubbing);
      const isPlay = Boolean(data.isPlaying);
      isPlaying = isPlay;
      void renderCurrentFrame(
        currentFrame,
        data.lod ?? 1.0,
        isScrub,
        data.clearColor ?? currentClearColor,
        data.debugMode,
        isPlay
      );
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

    // --- Sidecar & Background Modifier Preflight Protocol ---
    case 'WARMUP': {
      try {
        const depthStrategy = VisionEngineRegistry.getDepthStrategy();
        if (depthStrategy && !(depthStrategy as any).modelId && typeof (depthStrategy as any).init === 'function') {
          await (depthStrategy as any).init();
        }
        const segStrategy = VisionEngineRegistry.getSegmentationStrategy();
        if (segStrategy && !(segStrategy as any).modelId && typeof (segStrategy as any).init === 'function') {
          await (segStrategy as any).init();
        }
        self.postMessage({ type: 'WARMED_UP' } satisfies PreviewWorkerResponse);
      } catch (err: any) {
        self.postMessage({
          type: 'ERROR',
          error: `[PreviewWorker:Warmup] ${err?.message || err}`,
        } satisfies PreviewWorkerResponse);
      }
      break;
    }

    case 'CANCEL_TASK': {
      canceledSidecarTaskIds.add(data.taskId);
      self.postMessage({
        type: 'TASK_CANCELED',
        taskId: data.taskId,
        targetId: data.targetId,
      } satisfies PreviewWorkerResponse);
      break;
    }

    case 'RESET': {
      canceledSidecarTaskIds.clear();
      break;
    }

    case 'EXECUTE_MODIFIER': {
      const { payload } = data;
      if (!payload) return;

      if (canceledSidecarTaskIds.has(payload.taskId)) {
        canceledSidecarTaskIds.delete(payload.taskId);
        self.postMessage({
          type: 'TASK_CANCELED',
          taskId: payload.taskId,
          targetId: payload.targetId,
        } satisfies PreviewWorkerResponse);
        return;
      }

      try {
        const plugin = modifierPluginRegistry.get(payload.modifier.type);
        const context: ModifierContext = {
          targetType: payload.targetType,
          targetEntity: payload.targetEntity,
          timeline: new Map(),
          fps: payload.fps,
          canvas: payload.canvas,
          assets: payload.assets,
        };

        if (plugin && typeof plugin.execute === 'function') {
          await plugin.execute(context, payload.modifier.params);
        }

        if (canceledSidecarTaskIds.has(payload.taskId)) {
          canceledSidecarTaskIds.delete(payload.taskId);
          self.postMessage({
            type: 'TASK_CANCELED',
            taskId: payload.taskId,
            targetId: payload.targetId,
          } satisfies PreviewWorkerResponse);
          return;
        }

        self.postMessage({
          type: 'MODIFIER_EXECUTED',
          taskId: payload.taskId,
          targetId: payload.targetId,
          modifierType: payload.modifier.type,
          state: context.state,
        } satisfies PreviewWorkerResponse);
      } catch (err: any) {
        self.postMessage({
          type: 'ERROR',
          taskId: payload.taskId,
          targetId: payload.targetId,
          error: `[PreviewWorker:Execute] ${err?.message || err}`,
        } satisfies PreviewWorkerResponse);
      }
      break;
    }
  }
};
