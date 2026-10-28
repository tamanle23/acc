import { useRef, useEffect, useState } from 'react';
import type { ResolvedTimeline } from '@acc/ir';
import {
  createPreviewRenderStrategy,
  type IPreviewRenderStrategy,
} from '../../renderer/strategies';
import { PreviewWorkerCoordinator } from '../../renderer/PreviewWorkerCoordinator';
import { StudioPlayheadController } from '../../lib/playhead/StudioPlayheadController';
import { AssetTextureCache } from '../../lib/textures/AssetTextureCache';
import type { WorkerRenderOptions } from '../../renderer/workers/PreviewWorkerBridge';

export interface UseViewportRenderStrategyOptions {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  timeline: ResolvedTimeline | null;
  assetsMap: Record<string, any>;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  currentFrame: number;
  isPlaying: boolean;
  clearColor: string;
  debugMode?: 'none' | 'depth_heatmap' | 'normals' | 'alpha';
  activeSeqs: any[];
}

export function useViewportRenderStrategy({
  canvasRef,
  overlayCanvasRef,
  timeline,
  assetsMap,
  width,
  height,
  fps,
  totalFrames,
  currentFrame,
  isPlaying,
  clearColor,
  debugMode = 'none',
  activeSeqs,
}: UseViewportRenderStrategyOptions) {
  const strategyRef = useRef<IPreviewRenderStrategy | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [assetTick, setAssetTick] = useState(0);

  // Initialize strategy singleton instance
  if (!strategyRef.current) {
    strategyRef.current = createPreviewRenderStrategy();
  }

  // Subscribe to AssetTextureCache readiness
  useEffect(() => {
    return AssetTextureCache.getInstance().subscribe(() => {
      setAssetTick((t) => t + 1);
    });
  }, []);

  // Strategy canvas mount & timeline configuration lifecycle
  useEffect(() => {
    if (!timeline) return;

    const baseCanvas = canvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const strategy = strategyRef.current;
    if (!strategy) return;

    if (baseCanvas && strategy.id === 'main-thread') {
      baseCanvas.width = width;
      baseCanvas.height = height;
    }
    if (overlayCanvas) {
      overlayCanvas.width = width;
      overlayCanvas.height = height;
    }

    strategy.resize(width, height);
    strategy.updateTimeline(timeline, totalFrames, fps, assetsMap);

    if (baseCanvas && !strategy.isReady) {
      const initialized = strategy.init(baseCanvas);
      if (initialized) {
        strategy.onReady(() => {
          setIsReady(true);
          setAssetTick((t) => t + 1);
        });
      }
    }

    PreviewWorkerCoordinator.getInstance().preflightTimeline(timeline, {
      prioritizedFrame: currentFrame,
    });

    const unsubWarmed = PreviewWorkerCoordinator.getInstance().onModifierWarmed(() => {
      setAssetTick((t) => t + 1);
      strategyRef.current?.renderFrame(currentFrame);
    });

    return () => {
      unsubWarmed();
    };
  }, [timeline, assetsMap, width, height, fps, totalFrames]);

  // Teardown strategy on unmount
  useEffect(() => {
    return () => {
      strategyRef.current?.dispose();
      strategyRef.current = null;
    };
  }, []);

  // Frame render pass
  useEffect(() => {
    const strategy = strategyRef.current;
    if (!strategy) return;

    const renderOptions: WorkerRenderOptions = {
      lod: isPlaying ? 0.5 : 1.0,
      clearColor,
      debugMode,
    };

    strategy
      .syncTextures(activeSeqs, assetsMap, currentFrame, fps)
      .then(() => {
        strategy.renderFrame(currentFrame, renderOptions);
      })
      .catch(() => {
        strategy.renderFrame(currentFrame, renderOptions);
      });
  }, [currentFrame, fps, isPlaying, clearColor, debugMode, activeSeqs, assetsMap, assetTick]);

  // High-frequency subscription for smooth 60fps playhead animation without React rerenders
  useEffect(() => {
    return StudioPlayheadController.getInstance().subscribeHighFrequency((frame, playing) => {
      const strategy = strategyRef.current;
      if (strategy && strategy.isReady) {
        strategy.renderFrame(frame, {
          lod: playing ? 0.5 : 1.0,
          isScrubbing: !playing,
        });
      }
    });
  }, []);

  return {
    strategy: strategyRef.current,
    isReady,
    assetTick,
    renderFrame: (frame: number, options?: WorkerRenderOptions) => {
      strategyRef.current?.renderFrame(frame, options);
    },
  };
}
