import { createCanvas, loadImage, Image, Canvas } from '@napi-rs/canvas';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';
import type { ResolvedStoryConfig, ResolvedSceneConfig, Depth3DConfig } from '../types';
import { buildFfmpegEncodingFlags } from '../platforms';
import { drawFrameBreakerFrame, drawImageCover } from './frame-breaker';
import { drawParallaxFrame } from './parallax';
import { drawSandwichFrame } from './sandwich';
import { drawDepthMeshFrame } from './depth-mesh';
import { drawWigglegramFrame } from './wigglegram';

export interface Depth3DSceneOptions {
  scene: ResolvedSceneConfig;
  duration: number;
  assPath: string | null;
  config: ResolvedStoryConfig;
  outputPath: string;
  fallbackAudioPath?: string;
  paddingTime?: number;
  useHighQualityIntermediate?: boolean;
}

/**
 * Unified Runner for all 3D Depth & Visual Pop-Out rendering engines.
 * Supports: 'frame_breaker', 'parallax_25d', 'volumetric_sandwich', 'depth_map_3d', 'wigglegram'.
 */
export async function renderDepth3DScene(options: Depth3DSceneOptions): Promise<{ path: string; duration: number }> {
  const { scene, duration, assPath, config, outputPath, fallbackAudioPath, paddingTime = 0, useHighQualityIntermediate = false } = options;
  const { width, height, fps, captions, container } = config.settings;
  const depthConfig: Depth3DConfig = scene.depth3d || config.settings.depth3d || { enabled: true, mode: 'frame_breaker' };
  const mode = depthConfig.mode || 'frame_breaker';

  const totalDuration = duration + paddingTime;
  const totalFrames = Math.ceil(fps * totalDuration);

  // 1. Load primary image and optional subject cutout
  const img = await loadImage(scene.resolvedImage);
  let subjectImg: Image | null = null;
  if (depthConfig.subjectImage && fs.existsSync(depthConfig.subjectImage)) {
    try {
      subjectImg = await loadImage(depthConfig.subjectImage);
    } catch {}
  }

  // 2. Setup Mode-Specific Pre-Allocated Data Structures
  let bgImg: Image | null = null;
  let particles: any[] = [];
  let dustParticles: any[] = [];
  let srcCanvas: Canvas | null = null;
  let depthData: Uint8ClampedArray | null = null;
  let gridX = 32;
  let gridY = 18;
  let cellW = width / gridX;
  let cellH = height / gridY;
  let baseCanvas: Canvas | null = null;

  if (mode === 'parallax_25d' || mode === 'parallax_dolly') {
    if (depthConfig.parallax?.backgroundImage && fs.existsSync(depthConfig.parallax.backgroundImage)) {
      try {
        bgImg = await loadImage(depthConfig.parallax.backgroundImage);
      } catch {}
    }
    particles = Array.from({ length: 28 }, (_, i) => ({
      x: (Math.sin(i * 99) * 0.5 + 0.5) * width,
      y: (Math.cos(i * 33) * 0.5 + 0.5) * height,
      size: 3 + (i % 6) * 3,
      speedX: (0.4 + (i % 3) * 0.3) * (i % 2 === 0 ? 1 : -1),
      speedY: -0.5 - (i % 4) * 0.4,
      opacity: 0.2 + ((i % 5) * 0.12),
      pulseSpeed: 1.5 + (i % 3),
    }));
  } else if (mode === 'volumetric_sandwich' || mode === 'sandwich') {
    dustParticles = Array.from({ length: 35 }, (_, i) => ({
      x: (Math.sin(i * 47) * 0.5 + 0.5) * width,
      y: (Math.cos(i * 83) * 0.5 + 0.5) * height,
      size: 2 + (i % 4) * 2,
      speedX: (0.2 + (i % 3) * 0.2) * (i % 2 === 0 ? 1 : -1),
      speedY: -0.3 - (i % 3) * 0.2,
      opacity: 0.15 + (i % 4) * 0.1,
    }));
  } else if (mode === 'depth_map_3d' || mode === 'mesh_displacement') {
    srcCanvas = createCanvas(width, height);
    const sCtx = srcCanvas.getContext('2d');
    drawImageCover(sCtx, img, 0, 0, width, height);

    const dCanvas = createCanvas(width, height);
    const dCtx = dCanvas.getContext('2d');
    if (depthConfig.depthMesh?.depthMapPath && fs.existsSync(depthConfig.depthMesh.depthMapPath)) {
      try {
        const dm = await loadImage(depthConfig.depthMesh.depthMapPath);
        drawImageCover(dCtx, dm, 0, 0, width, height);
      } catch {}
    } else {
      const radGrad = dCtx.createRadialGradient(
        width / 2, height * 0.52, width * 0.05,
        width / 2, height * 0.52, width * 0.65
      );
      radGrad.addColorStop(0, 'rgb(255, 255, 255)');
      radGrad.addColorStop(0.5, 'rgb(180, 180, 180)');
      radGrad.addColorStop(1, 'rgb(30, 30, 30)');
      dCtx.fillStyle = radGrad;
      dCtx.fillRect(0, 0, width, height);
    }

    const sampleCanvas = createCanvas(gridX, gridY);
    const sampleCtx = sampleCanvas.getContext('2d');
    sampleCtx.drawImage(dCanvas, 0, 0, gridX, gridY);
    depthData = sampleCtx.getImageData(0, 0, gridX, gridY).data;
  } else if (mode === 'wigglegram') {
    baseCanvas = createCanvas(width, height);
    const bCtx = baseCanvas.getContext('2d');
    drawImageCover(bCtx, img, 0, 0, width, height);
  }

  // 3. Setup Canvas and FFmpeg Raw Pipe
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const inputStream = new PassThrough();
  const command = ffmpeg(inputStream as any)
    .inputFormat('rawvideo')
    .inputOptions([
      '-pix_fmt rgba',
      `-s ${width}x${height}`,
      `-r ${fps}`
    ]);

  const hasAudio = !!(scene.resolvedAudio && fs.existsSync(scene.resolvedAudio));
  const audioInput = hasAudio ? scene.resolvedAudio : fallbackAudioPath;
  const hasValidAudio = !!(audioInput && fs.existsSync(audioInput));

  if (hasValidAudio) {
    command.input(audioInput);
  }

  const subtitleMode = captions?.subtitleMode || 'burn';
  // Note: For volumetric_sandwich, subtitles can be rendered directly into the 3D layer behind the subject
  const hasSubtitle = !!(assPath && fs.existsSync(assPath));
  const videoFilters: string[] = [];

  if (hasSubtitle && mode !== 'volumetric_sandwich' && mode !== 'sandwich') {
    if (subtitleMode === 'burn') {
      const escapedAss = assPath!
        .replace(/\\/g, '/')
        .replace(/:/g, '\\:');
      videoFilters.push(`subtitles='${escapedAss}'`);
    }
  }

  if (videoFilters.length > 0) {
    command.videoFilters(videoFilters);
  }

  const outputOptions: string[] = [];
  const encoding = buildFfmpegEncodingFlags(config.settings, totalDuration);
  outputOptions.push(...encoding.outputOptions);

  if (paddingTime > 0 && hasValidAudio) {
    outputOptions.push('-af', `apad=pad_dur=${paddingTime.toFixed(3)}`);
  } else if (hasValidAudio) {
    outputOptions.push('-c:a', config.settings.audioCodec);
    outputOptions.push('-b:a', config.settings.audioBitrate);
  }

  outputOptions.push('-t', totalDuration.toFixed(3));

  if (hasSubtitle && subtitleMode === 'soft' && container !== 'webm') {
    command.input(assPath!);
    outputOptions.push('-c:s', container === 'mp4' ? 'mov_text' : 'ass');
  }

  const renderPromise = new Promise<{ path: string; duration: number }>((resolve, reject) => {
    let stderr = '';
    command
      .outputOptions(outputOptions)
      .output(outputPath)
      .on('start', (cmdLine) => {})
      .on('stderr', (stderrLine) => {
        stderr += stderrLine + '\n';
      })
      .on('error', (err) => {
        reject(new Error(`Render 3D Depth (${mode}) failed: ${err.message}\nFFmpeg log:\n${stderr}`));
      })
      .on('end', () => {
        resolve({ path: outputPath, duration: totalDuration });
      })
      .run();
  });

  // 4. Render and stream frames
  for (let frame = 0; frame < totalFrames; frame++) {
    const progress = frame / totalFrames;
    const timeSec = frame / fps;

    ctx.clearRect(0, 0, width, height);

    switch (mode) {
      case 'parallax_25d':
      case 'parallax_dolly':
        drawParallaxFrame(ctx, {
          img,
          subjectImg,
          bgImg,
          width,
          height,
          frame,
          totalFrames,
          timeSec,
          progress,
          depthConfig,
          particles
        });
        break;

      case 'volumetric_sandwich':
      case 'sandwich':
        drawSandwichFrame(ctx, {
          img,
          subjectImg,
          width,
          height,
          frame,
          totalFrames,
          timeSec,
          progress,
          depthConfig,
          captions: scene.captions,
          dustParticles
        });
        break;

      case 'depth_map_3d':
      case 'mesh_displacement':
        if (srcCanvas && depthData) {
          drawDepthMeshFrame(ctx, {
            srcCanvas,
            depthData,
            gridX,
            gridY,
            cellW,
            cellH,
            width,
            height,
            frame,
            totalFrames,
            timeSec,
            progress,
            depthConfig
          });
        }
        break;

      case 'wigglegram':
        if (baseCanvas) {
          drawWigglegramFrame(ctx, {
            baseCanvas,
            subjectImg,
            width,
            height,
            frame,
            totalFrames,
            timeSec,
            progress,
            depthConfig
          });
        }
        break;

      case 'frame_breaker':
      default:
        drawFrameBreakerFrame(ctx, {
          img,
          subjectImg,
          width,
          height,
          frame,
          totalFrames,
          timeSec,
          progress,
          depthConfig
        });
        break;
    }

    const buffer = canvas.data();
    inputStream.write(buffer);
  }

  inputStream.end();
  return renderPromise;
}
