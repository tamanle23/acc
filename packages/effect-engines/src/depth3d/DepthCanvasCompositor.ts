import {
  type ICanvasContext2D,
} from '@acc/core-isomorphic';
import type {
  ResolvedSceneConfig,
  ResolvedStoryConfig,
  Depth3DConfig,
  CaptionTrackSnapshot,
} from '../types';
import { Depth3DFactory } from './factory';
import { drawCanvasCaptionsFromSnapshot, BoundedAcousticCaptionStrategy } from '../subtitles';
import type { PreprocessedDepthScene } from './DepthScenePreprocessor';

export interface DepthRenderFrameOptions {
  frame: number;
  totalFrames: number;
  fps: number;
  width: number;
  height: number;
  scene: ResolvedSceneConfig;
  config: ResolvedStoryConfig;
  depthConfig: Depth3DConfig;
  preprocessed: PreprocessedDepthScene;
}

export class DepthCanvasCompositor {
  private captionStrategy = new BoundedAcousticCaptionStrategy();

  public renderFrame(
    ctx: ICanvasContext2D,
    options: DepthRenderFrameOptions
  ): void {
    const { frame, totalFrames, fps, width, height, scene, config, depthConfig, preprocessed } = options;
    const progress = totalFrames > 0 ? frame / totalFrames : 0;
    const timeSec = fps > 0 ? frame / fps : 0;
    const mode = depthConfig.mode || 'frame_breaker';

    ctx.clearRect(0, 0, width, height);

    const renderer = Depth3DFactory.getRenderer(mode);

    renderer.renderFrame(ctx as any, {
      img: preprocessed.img,
      subjectImg: preprocessed.subjectImg,
      subjectBBox: preprocessed.subjectBBox,
      bgImg: preprocessed.bgImg,
      srcCanvas: preprocessed.sCanvas,
      depthLayers: preprocessed.depthLayers,
      width,
      height,
      frame,
      totalFrames,
      timeSec,
      progress,
      depthConfig,
      captions: scene.captions,
      particles: preprocessed.particles,
      dustParticles: preprocessed.dustParticles,
    });

    // Draw Subtitles / Captions
    if (scene.captions && scene.captions.length > 0) {
      const snapshot: CaptionTrackSnapshot = this.captionStrategy.evaluate(
        scene.captions,
        timeSec,
        config.settings.captions
      );
      drawCanvasCaptionsFromSnapshot(
        ctx as any,
        snapshot,
        config.settings.captions,
        width,
        height,
        config.settings.platform as any
      );
    }
  }
}
