// ============================================================================
// KINETIX STUDIO v6.0 - STORYBOARD DUAL-BUFFER COMPOSITOR (ECMA-429)
// Dual-buffer ping-pong rendering orchestrator for seamless multi-act narrative transitions.
// ============================================================================

import type { StudioState } from '@/types/studio';
import type { StoryboardSequence } from '@/core/domain/storyboard/storyboard-sequence.entity';
import { SafeCanvas2D, type AnyCanvas2DContext } from '@/lib/safe-canvas-2d';
import { renderPosterComposition, type PosterCompositionOptions } from '@/engine/composition-engine';
import { computeChoreography } from '@/core/domain/motion/choreography';
import { TransitionRegistry } from '@/engine/transitions/transition-strategy';
import { BRAND_ARCHETYPES } from '@/constants/archetypes';

export interface StoryboardRenderOptions {
  readonly sequence: StoryboardSequence;
  readonly globalTimeSec: number;
  readonly baseState: StudioState;
  readonly width: number;
  readonly height: number;
  readonly totalFrames?: number;
  readonly audioTelemetry?: PosterCompositionOptions['audioTelemetry'];
  readonly scale?: number;
}

export class StoryboardCompositor {
  private bufferA: HTMLCanvasElement | null = null;
  private bufferB: HTMLCanvasElement | null = null;
  private ctxA: CanvasRenderingContext2D | null = null;
  private ctxB: CanvasRenderingContext2D | null = null;
  private disposed = false;

  private ensureBuffers(width: number, height: number): {
    bufA: HTMLCanvasElement;
    bufB: HTMLCanvasElement;
    cA: CanvasRenderingContext2D;
    cB: CanvasRenderingContext2D;
  } {
    if (this.disposed) {
      throw new Error('StoryboardCompositor has been disposed.');
    }

    if (!this.bufferA || this.bufferA.width !== width || this.bufferA.height !== height) {
      this.bufferA = document.createElement('canvas');
      this.bufferA.width = width;
      this.bufferA.height = height;
      this.ctxA = this.bufferA.getContext('2d');
    }

    if (!this.bufferB || this.bufferB.width !== width || this.bufferB.height !== height) {
      this.bufferB = document.createElement('canvas');
      this.bufferB.width = width;
      this.bufferB.height = height;
      this.ctxB = this.bufferB.getContext('2d');
    }

    if (!this.ctxA || !this.ctxB) {
      throw new Error('Failed to acquire 2D context for offscreen storyboard buffers.');
    }

    return {
      bufA: this.bufferA,
      bufB: this.bufferB,
      cA: this.ctxA,
      cB: this.ctxB,
    };
  }

  /**
   * Renders a frame of the storyboard sequence to the target canvas context.
   */
  public renderSequenceFrame(
    targetCtx: AnyCanvas2DContext | SafeCanvas2D,
    options: StoryboardRenderOptions
  ): void {
    if (this.disposed) {
      throw new Error('StoryboardCompositor has been disposed.');
    }
    const { sequence, globalTimeSec, baseState, width, height, totalFrames = 120, audioTelemetry, scale = 1 } = options;
    const resolution = sequence.resolveAtGlobalTime(globalTimeSec);
    const { currentScene, nextScene, localProgress, transitionProgress, transition } = resolution;

    const targetArchetypeId =
      currentScene.archetypeId ?? currentScene.statePatch.archetypeId ?? baseState.archetypeId;
    const archPatch = BRAND_ARCHETYPES.find((a) => a.id === targetArchetypeId)?.patch ?? {};

    const is3dActive = Boolean(currentScene.choreo3d?.enabled);
    const currentMergedState: StudioState = {
      ...baseState,
      ...archPatch,
      ...currentScene.statePatch,
      bpm: currentScene.statePatch.bpm ?? archPatch.bpm ?? sequence.masterBpm,
      archetypeId: targetArchetypeId,
      choreo3d: currentScene.choreo3d,
      heroId: is3dActive ? 'custom-glb' : (currentScene.statePatch.heroId ?? archPatch.heroId ?? baseState.heroId),
    };

    const currentLocalFrame = Math.floor(localProgress * totalFrames);
    const choreoCurrent = computeChoreography(
      localProgress,
      currentMergedState.timelineMode ?? 'studio3',
      currentMergedState.hicksLawDisclosure ?? true,
      currentMergedState.customKeyframes,
      currentMergedState.choreoMode ?? 'procedural-3phase'
    );

    // If not in a transition or no next scene, render directly into target
    if (transitionProgress === null || !nextScene || !transition) {
      renderPosterComposition(targetCtx, {
        width,
        height,
        state: currentMergedState,
        frame: currentLocalFrame,
        totalFrames,
        choreo: choreoCurrent,
        scale,
        audioTelemetry,
      });
      return;
    }

    // During transition: Dual-buffer ping-pong composite at full physical resolution
    const scaleFactor = typeof scale === 'number' && scale > 0 ? scale : 1;
    const pixelW = Math.round(width * scaleFactor);
    const pixelH = Math.round(height * scaleFactor);

    const { bufA, bufB, cA, cB } = this.ensureBuffers(pixelW, pixelH);

    // Clear ping-pong buffers
    cA.clearRect(0, 0, pixelW, pixelH);
    cB.clearRect(0, 0, pixelW, pixelH);

    // 1. Render Current Scene to Buffer A with DPI scale
    renderPosterComposition(cA, {
      width,
      height,
      state: currentMergedState,
      frame: currentLocalFrame,
      totalFrames,
      choreo: choreoCurrent,
      scale: scaleFactor,
      audioTelemetry,
    });

    // 2. Render Incoming Scene to Buffer B (at its entrance, progress near 0) with DPI scale
    const nextArchetypeId =
      nextScene.archetypeId ?? nextScene.statePatch.archetypeId ?? baseState.archetypeId;
    const nextArchPatch = BRAND_ARCHETYPES.find((a) => a.id === nextArchetypeId)?.patch ?? {};

    const isNext3dActive = Boolean(nextScene.choreo3d?.enabled);
    const nextMergedState: StudioState = {
      ...baseState,
      ...nextArchPatch,
      ...nextScene.statePatch,
      bpm: nextScene.statePatch.bpm ?? nextArchPatch.bpm ?? sequence.masterBpm,
      archetypeId: nextArchetypeId,
      choreo3d: nextScene.choreo3d,
      heroId: isNext3dActive ? 'custom-glb' : (nextScene.statePatch.heroId ?? nextArchPatch.heroId ?? baseState.heroId),
    };

    const choreoNext = computeChoreography(
      0,
      nextMergedState.timelineMode ?? 'studio3',
      nextMergedState.hicksLawDisclosure ?? true,
      nextMergedState.customKeyframes,
      nextMergedState.choreoMode ?? 'procedural-3phase'
    );

    renderPosterComposition(cB, {
      width,
      height,
      state: nextMergedState,
      frame: 0,
      totalFrames,
      choreo: choreoNext,
      scale: scaleFactor,
      audioTelemetry,
    });

    // 3. Blend buffers onto target context using transition strategy
    const rawTargetCtx =
      targetCtx instanceof SafeCanvas2D
        ? (targetCtx.raw as unknown as CanvasRenderingContext2D)
        : 'raw' in targetCtx && (targetCtx as any).raw
        ? ((targetCtx as any).raw as CanvasRenderingContext2D)
        : 'nativeContext' in targetCtx && (targetCtx as any).nativeContext
        ? ((targetCtx as any).nativeContext as CanvasRenderingContext2D)
        : (targetCtx as unknown as CanvasRenderingContext2D);

    const strategy = TransitionRegistry.get(transition.type);
    strategy.render({
      fromCanvas: bufA,
      toCanvas: bufB,
      targetCtx: rawTargetCtx,
      progress: transitionProgress,
      width: pixelW,
      height: pixelH,
      direction: transition.direction,
    });
  }

  /**
   * Releases allocated offscreen canvas buffers. Conforms to WinterTC / ECMA-429 disposable.
   */
  public dispose(): void {
    this.bufferA = null;
    this.bufferB = null;
    this.ctxA = null;
    this.ctxB = null;
    this.disposed = true;
  }

  public [Symbol.dispose](): void {
    this.dispose();
  }
}
