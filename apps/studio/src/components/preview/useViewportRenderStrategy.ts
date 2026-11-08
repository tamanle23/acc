import { createSignal, createEffect, onCleanup, untrack } from 'solid-js';
import { withTargetCanvasSize, type AssetDefinition, type ResolvedSequence, type ResolvedTimeline } from '@acc/ir';
import {
  createPreviewRenderStrategy,
  type IPreviewRenderStrategy,
} from '../../renderer/strategies';
import { PreviewWorkerCoordinator } from '../../renderer/PreviewWorkerCoordinator';
import { PlayheadController } from '../../lib/playhead/PlayheadController';
import { AssetTextureCache } from '../../lib/textures/AssetTextureCache';
import { StudioBootController } from '../../lib/boot/StudioBootController';
import type { WorkerRenderOptions } from '../../renderer/workers/PreviewWorkerBridge';

function resolveCanvas(ref: any): HTMLCanvasElement | null {
  if (!ref) return null;
  if (typeof ref === 'function') return ref();
  if ('current' in ref) return ref.current;
  return ref;
}

export interface UseViewportRenderStrategyOptions {
  canvasRef: any;
  overlayCanvasRef: any;
  timeline: ResolvedTimeline | null;
  assetsMap: Record<string, AssetDefinition>;
  width: number;
  height: number;
  timelineWidth?: number;
  timelineHeight?: number;
  fps: number;
  totalFrames: number;
  currentFrame: number;
  isPlaying: boolean;
  clearColor: string;
  debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha';
  activeSeqs: ResolvedSequence[];
}

export function useViewportRenderStrategy(options: UseViewportRenderStrategyOptions) {
  let strategy: IPreviewRenderStrategy | null = createPreviewRenderStrategy();
  const [isReady, setIsReady] = createSignal(false);
  const [assetTick, setAssetTick] = createSignal(0);

  // Subscribe to AssetTextureCache readiness
  const unsubTexture = AssetTextureCache.getInstance().subscribe(() => {
    setAssetTick((t) => t + 1);
  });
  onCleanup(unsubTexture);

  // Strategy canvas mount & timeline configuration lifecycle
  createEffect(() => {
    const timeline = options.timeline;
    if (!timeline || !strategy) return;

    const baseCanvas = resolveCanvas(options.canvasRef);
    const overlayCanvas = resolveCanvas(options.overlayCanvasRef);

    if (baseCanvas && strategy.id === 'main-thread') {
      baseCanvas.width = options.width;
      baseCanvas.height = options.height;
    }
    if (overlayCanvas) {
      // Downscale overlay canvas backing store to match active viewport virtual resolution (e.g. 960x540)
      if (overlayCanvas.width !== options.width || overlayCanvas.height !== options.height) {
        overlayCanvas.width = options.width;
        overlayCanvas.height = options.height;
      }
    }

    const targetTimeline = withTargetCanvasSize(timeline, options.width, options.height);

    strategy.resize(options.width, options.height);
    strategy.updateTimeline(targetTimeline, options.totalFrames, options.fps, options.assetsMap);

    if (baseCanvas && !strategy.isReady) {
      const initialized = strategy.init(baseCanvas);
      if (initialized) {
        strategy.onReady(() => {
          setIsReady(true);
          setAssetTick((t) => t + 1);
          StudioBootController.notifyCanvasReady();
        });
      }
    }

    // Run preflight only when the project timeline structure changes,
    // avoiding aggressive background tasks on every single playhead tick.
    const lastPreflightTimeline = (useViewportRenderStrategy as any)._lastPreflight;
    if (lastPreflightTimeline !== targetTimeline) {
      (useViewportRenderStrategy as any)._lastPreflight = targetTimeline;
      const initialFrame = untrack(() => options.currentFrame);
      PreviewWorkerCoordinator.getInstance().preflightTimeline(targetTimeline, {
        prioritizedFrame: initialFrame,
      });
    }
  });

  const unsubWarmed = PreviewWorkerCoordinator.getInstance().onModifierWarmed(() => {
    setAssetTick((t) => t + 1);
    if (!options.isPlaying) {
      strategy?.renderFrame(untrack(() => options.currentFrame));
    }
  });
  onCleanup(unsubWarmed);

  // Teardown strategy on unmount
  onCleanup(() => {
    strategy?.dispose();
    strategy = null;
  });

  // Frame render pass
  createEffect(() => {
    if (!strategy) return;

    // Depend on reactive ticks/dimensions and readiness
    assetTick();
    isReady();
    const frame = options.currentFrame;
    const playing = options.isPlaying;
    const fps = options.fps;
    const clearColor = options.clearColor;
    const debugMode = options.debugMode || 'none';
    const activeSeqs = options.activeSeqs;
    const assetsMap = options.assetsMap;

    if (!strategy.isReady) return;

    if (playing) {
      // During active playback, frame rendering is driven exclusively by high-frequency playhead ticks.
      return;
    }

    const renderOptions: WorkerRenderOptions = {
      lod: playing ? 0.5 : 1.0,
      isScrubbing: !playing,
      isPlaying: playing,
      clearColor,
      debugMode,
    };

    strategy
      .syncTextures(activeSeqs, assetsMap, frame, fps)
      .then(() => {
        strategy?.renderFrame(frame, renderOptions);
      })
      .catch(() => {
        strategy?.renderFrame(frame, renderOptions);
      });
  });

  // High-frequency subscription for smooth 60fps playhead animation without Solid rerenders
  let lastDispatchedFrame = -1;
  const unsubPlayhead = PlayheadController.getInstance().subscribeHighFrequency((frame, playing) => {
    if (strategy && strategy.isReady) {
      if (playing && frame === lastDispatchedFrame) return;
      lastDispatchedFrame = playing ? frame : -1;
      strategy.renderFrame(frame, {
        lod: playing ? 0.5 : 1.0,
        isScrubbing: !playing,
        isPlaying: playing,
      });
    }
  });
  onCleanup(unsubPlayhead);

  // Subscribe to real hardware frame render completions to feed live telemetry
  createEffect(() => {
    if (!isReady() || !strategy?.onFrameRendered) return;
    const unsub = strategy.onFrameRendered((frame, latencyMs) => {
      PlayheadController.getInstance().recordFrameRendered(frame, latencyMs);
    });
    onCleanup(unsub);
  });

  return {
    strategy,
    get previewEngine() {
      return strategy?.getEngine?.() ?? null;
    },
    get isReady() {
      return isReady();
    },
    isReadySignal: isReady,
    get assetTick() {
      return assetTick();
    },
    assetTickSignal: assetTick,
    renderFrame: (frame: number, renderOpts?: WorkerRenderOptions) => {
      strategy?.renderFrame(frame, renderOpts);
    },
  };
}
