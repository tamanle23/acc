import {
  UniversalCanvasProvider,
  MediaEngineRegistry,
  type IMediaFrameSink,
} from '@acc/core-isomorphic';
import type { Depth3DSceneOptions } from './index';
import { DepthScenePreprocessor, type PreprocessedDepthScene } from './DepthScenePreprocessor';
import { DepthCanvasCompositor } from './DepthCanvasCompositor';

export class MediaSinkStreamer {
  public static async streamScene(
    options: Depth3DSceneOptions,
    preprocessed: PreprocessedDepthScene,
    compositor: DepthCanvasCompositor
  ): Promise<{ path: string; duration: number }> {
    const { scene, duration, config, outputPath, fallbackAudioPath, paddingTime = 0 } = options;
    const width = config.settings.width || 1080;
    const height = config.settings.height || 1920;
    const fps = config.settings.fps || 30;

    const depthConfig = scene.depth3d || config.settings.depth3d || { enabled: true, mode: 'frame_breaker' };
    const totalDuration = duration + paddingTime;
    const totalFrames = Math.ceil(fps * totalDuration);

    const canvas = UniversalCanvasProvider.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    let sink: IMediaFrameSink = options.sink!;
    if (!sink) {
      const rawEngine =
        options.engine ||
        depthConfig.engine ||
        (config.settings as any)?.mediaEngine ||
        (config.settings as any)?.engine;

      const strategy = rawEngine && MediaEngineRegistry.has(rawEngine)
        ? MediaEngineRegistry.get(rawEngine)
        : MediaEngineRegistry.get();

      sink = strategy.createVideoSink({
        width,
        height,
        fps,
        totalFrames,
        durationSeconds: totalDuration,
        outputPath,
        audioPath: scene.resolvedAudio || fallbackAudioPath,
      });
    }

    await sink.initialize({
      width,
      height,
      fps,
      totalFrames,
      durationSeconds: totalDuration,
      outputPath,
      audioPath: scene.resolvedAudio || fallbackAudioPath,
    });

    try {
      for (let frame = 0; frame < totalFrames; frame++) {
        compositor.renderFrame(ctx, {
          frame,
          totalFrames,
          fps,
          width,
          height,
          scene,
          config,
          depthConfig,
          preprocessed,
        });

        const frameData = canvas.data();
        await sink.consumeFrame(frame, frameData);

        if (frame % 15 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    } finally {
      preprocessed.dispose();
    }

    await sink.finalize();
    return { path: outputPath, duration: totalDuration };
  }
}
