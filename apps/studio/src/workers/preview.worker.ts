import { IRPreviewEngine, type ResolvedTimeline } from '@acc/ir';

let canvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;
let engine: IRPreviewEngine | null = null;
let currentWidth = 1920;
let currentHeight = 1080;
let currentFps = 30;
let currentTotalFrames = 300;
let currentFrame = 0;
let textureCache = new Map<string, any>();

// Playback state
let isPlaying = false;
let shuttleSpeed = 0;
let rafId: number | null = null;
let lastRafTime = 0;
let accumulatedMs = 0;
let lastUiSyncTime = 0;

function renderCurrentFrame(frame: number, lod = 1.0, popOutIntensity = 1.0) {
  if (!canvas || !ctx || !engine) return;

  const w = currentWidth;
  const h = currentHeight;

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
}

function playbackLoop(now: number) {
  if (!isPlaying || shuttleSpeed === 0) return;

  const deltaMs = now - lastRafTime;
  lastRafTime = now;

  const frameDurationMs = 1000 / currentFps;
  accumulatedMs += deltaMs * shuttleSpeed;

  if (Math.abs(accumulatedMs) >= frameDurationMs) {
    const framesToAdvance = Math.trunc(accumulatedMs / frameDurationMs);
    accumulatedMs -= framesToAdvance * frameDurationMs;

    currentFrame += framesToAdvance;

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
    renderCurrentFrame(currentFrame, 0.5, 1.0);

    // Throttle React UI state synchronization to 15 Hz (~66ms) to eliminate React lag
    if (now - lastUiSyncTime >= 66) {
      lastUiSyncTime = now;
      self.postMessage({ type: 'frameUpdate', frame: currentFrame });
    }
  }

  rafId = requestAnimationFrame(playbackLoop);
}

function stopPlayback() {
  isPlaying = false;
  shuttleSpeed = 0;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  // Parked hero frame: Render crystal-clear 1.0x full LOD
  renderCurrentFrame(currentFrame, 1.0, 1.0);
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
        engine = new IRPreviewEngine(data.timeline);
      }
      self.postMessage({ type: 'ready' });
      break;
    }

    case 'updateTimeline': {
      if (data.timeline) {
        engine = new IRPreviewEngine(data.timeline);
      }
      if (data.totalFrames) currentTotalFrames = data.totalFrames;
      if (data.fps) currentFps = data.fps;
      renderCurrentFrame(currentFrame, 1.0, data.popOutIntensity ?? 1.0);
      break;
    }

    case 'renderFrame': {
      currentFrame = data.frame;
      renderCurrentFrame(currentFrame, data.lod ?? 1.0, data.popOutIntensity ?? 1.0);
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
      accumulatedMs = 0;
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
      }
      break;
    }
  }
};
