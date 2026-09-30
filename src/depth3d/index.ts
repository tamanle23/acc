import { createCanvas, loadImage, Image, Canvas } from '@napi-rs/canvas';
import fs from 'fs';
import path from 'path';
import type { ResolvedStoryConfig, ResolvedSceneConfig, Depth3DConfig } from '../types';
import { buildFfmpegEncodingFlags } from '../platforms';
import { drawFrameBreakerFrame, drawImageCover } from './frame-breaker';
import { drawParallaxFrame } from './parallax';
import { drawSandwichFrame } from './sandwich';
import { drawDepthMeshFrame } from './depth-mesh';
import { drawWigglegramFrame } from './wigglegram';
import { drawCanvasCaptions } from '../core/captions-canvas';

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
  const shouldAutoSegment = depthConfig.autoSegment !== undefined
    ? depthConfig.autoSegment
    : (mode === 'frame_breaker' || mode === 'volumetric_sandwich' || mode === 'sandwich');

  if (depthConfig.subjectImage && fs.existsSync(depthConfig.subjectImage)) {
    try {
      subjectImg = await loadImage(depthConfig.subjectImage);
    } catch {}
  } else if (shouldAutoSegment && scene.resolvedImage) {
    try {
      const { defaultIPCFacade } = await import('../../packages/core/src/ipc/IPCFacade');
      const segRes = await defaultIPCFacade.segmentSubject(scene.resolvedImage);
      if (segRes && segRes.maskBuffer && segRes.maskBuffer.length > 0) {
        subjectImg = await loadImage(segRes.maskBuffer);
      }
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
  let bgCanvas: Canvas | null = null;

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
    } else if (depthConfig.autoDepth && scene.resolvedImage) {
      try {
        const { defaultIPCFacade } = await import('../../packages/core/src/ipc/IPCFacade');
        const depthRes = await defaultIPCFacade.estimateDepth(scene.resolvedImage);
        if (depthRes && depthRes.depthMapBuffer && depthRes.depthMapBuffer.length > 0) {
          const dm = await loadImage(depthRes.depthMapBuffer);
          drawImageCover(dCtx, dm, 0, 0, width, height);
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
      } catch {
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
  } else if (mode === 'frame_breaker') {
    bgCanvas = createCanvas(width, height);
    const bgCtx = bgCanvas.getContext('2d');
    drawImageCover(bgCtx, img, 0, 0, width, height);
    bgCtx.fillStyle = 'rgba(10, 10, 18, 0.65)';
    bgCtx.fillRect(0, 0, width, height);
  }

  // 3. Setup Canvas and Zero-Copy FFIVideoEncoder Pipeline
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  const { FFIVideoEncoder } = await import('../core/ffmpeg-ffi/FFIVideoEncoder');
  const audioInput = scene.resolvedAudio || fallbackAudioPath;
  const encoder = new FFIVideoEncoder(width, height, fps, outputPath, 20, audioInput);
  
  const renderPromise = new Promise<{ path: string; duration: number }>(async (resolve, reject) => {
    try {
      encoder.initialize();

      // 4. Render and stream frames via FFI
      for (let frame = 0; frame < totalFrames; frame++) {
        const progress = frame / totalFrames;
        const timeSec = frame / fps;

        ctx.clearRect(0, 0, width, height);

        switch (mode) {
          case 'parallax_25d':
          case 'parallax_dolly':
            drawParallaxFrame(ctx, {
              img, subjectImg, bgImg, width, height, frame, totalFrames, timeSec, progress, depthConfig, particles
            });
            break;
          case 'volumetric_sandwich':
          case 'sandwich':
            drawSandwichFrame(ctx, {
              img, subjectImg, width, height, frame, totalFrames, timeSec, progress, depthConfig, captions: scene.captions, dustParticles
            });
            break;
          case 'depth_map_3d':
          case 'mesh_displacement':
            if (srcCanvas && depthData) {
              drawDepthMeshFrame(ctx, {
                srcCanvas, depthData, gridX, gridY, cellW, cellH, width, height, frame, totalFrames, timeSec, progress, depthConfig
              });
            }
            break;
          case 'wigglegram':
            if (baseCanvas) {
              drawWigglegramFrame(ctx, {
                baseCanvas, subjectImg, width, height, frame, totalFrames, timeSec, progress, depthConfig
              });
            }
            break;
          case 'frame_breaker':
          default:
            drawFrameBreakerFrame(ctx, {
              img, subjectImg, bgCanvas, width, height, frame, totalFrames, timeSec, progress, depthConfig
            });
            break;
        }

        // Draw Canvas Subtitles / Captions
        drawCanvasCaptions(ctx, scene.captions, timeSec, config.settings.captions, width, height);

        // ZERO-COPY FFI INGESTION
        const buffer = canvas.data();
        encoder.encodeRgbaFrame(buffer);

        // Periodic yield to allow event loop & GC reclamation of dereferenced frames
        if (frame % 15 === 0) {
          if (typeof Bun !== 'undefined' && (Bun as any).gc) {
            (Bun as any).gc(true);
          }
          await new Promise(r => setTimeout(r, 0));
        }
      }

      encoder.close();
      
      // Note: In Phase 4/5, audio remuxing would happen here via FFI Muxer
      // For now, video is fully encoded without spawn or fluent-ffmpeg!
      
      resolve({ path: outputPath, duration: totalDuration });
    } catch (err: any) {
      reject(new Error(`FFI Render 3D Depth (${mode}) failed: ${err.message}`));
    }
  });

  return renderPromise;
}

