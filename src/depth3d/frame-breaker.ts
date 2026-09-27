import { createCanvas, loadImage, Image } from '@napi-rs/canvas';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';
import fs from 'fs';
import path from 'path';
import type { ResolvedStoryConfig, ResolvedSceneConfig, Depth3DConfig } from '../types';
import { buildFfmpegEncodingFlags } from '../platforms';

export interface FrameBreakerOptions {
  scene: ResolvedSceneConfig;
  duration: number;
  assPath: string | null;
  config: ResolvedStoryConfig;
  outputPath: string;
  paddingTime?: number;
  useHighQualityIntermediate?: boolean;
}

export async function renderFrameBreakerScene(options: FrameBreakerOptions): Promise<{ path: string; duration: number }> {
  const { scene, duration, assPath, config, outputPath, paddingTime = 0, useHighQualityIntermediate = false } = options;
  const { width, height, fps, captions, container } = config.settings;
  const depthConfig: Depth3DConfig = scene.depth3d || config.settings.depth3d || { enabled: true, mode: 'frame_breaker' };

  const totalDuration = duration + paddingTime;
  const totalFrames = Math.ceil(fps * totalDuration);

  // Load scene image
  const img = await loadImage(scene.resolvedImage);
  let subjectImg: Image | null = null;
  if (depthConfig.subjectImage && fs.existsSync(depthConfig.subjectImage)) {
    subjectImg = await loadImage(depthConfig.subjectImage);
  }

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

  const hasAudio = fs.existsSync(scene.resolvedAudio);
  if (hasAudio) {
    command.input(scene.resolvedAudio);
  }

  const subtitleMode = captions?.subtitleMode || 'burn';
  const hasSubtitle = !!(assPath && fs.existsSync(assPath));
  const videoFilters: string[] = [];

  if (hasSubtitle) {
    if (subtitleMode === 'burn') {
      const escapedAss = assPath!
        .replace(/\\/g, '/')
        .replace(/:/g, '\\:');
      videoFilters.push(`subtitles='${escapedAss}'`);
    } else {
      command.input(assPath!);
    }
  }

  const encodingFlags = buildFfmpegEncodingFlags(config.settings, totalDuration);
  const outputOptions = [...encodingFlags.outputOptions];

  if (useHighQualityIntermediate) {
    if (config.settings.fastIntermediate) {
      const encoderIndex = outputOptions.findIndex(o => o.startsWith('-c:v'));
      if (encoderIndex !== -1 && !outputOptions[encoderIndex].includes('nvenc')) {
        const presetIndex = outputOptions.findIndex(o => o.startsWith('-preset'));
        if (presetIndex !== -1) {
          outputOptions[presetIndex] = '-preset ultrafast';
        } else {
          outputOptions.push('-preset ultrafast');
        }
      }
      for (let i = 0; i < outputOptions.length; i++) {
        if (outputOptions[i].startsWith('-crf ')) {
          outputOptions[i] = '-crf 12';
        } else if (outputOptions[i].startsWith('-cq ')) {
          outputOptions[i] = '-cq 12';
        }
      }
    }
  }

  if (paddingTime > 0) {
    outputOptions.push('-af', `apad=pad_dur=${paddingTime}`);
  }

  if (hasSubtitle && subtitleMode === 'soft') {
    if (container === 'mkv') {
      outputOptions.push('-c:s ass');
    } else if (container === 'mp4' || container === 'mov') {
      outputOptions.push('-c:s mov_text');
    } else if (container === 'webm') {
      outputOptions.push('-c:s webvtt');
    }
  }

  if (videoFilters.length > 0) {
    command.videoFilters(videoFilters);
  }

  command
    .outputOptions(outputOptions)
    .output(outputPath);

  const renderPromise = new Promise<{ path: string; duration: number }>((resolve, reject) => {
    command.on('end', () => resolve({ path: outputPath, duration: totalDuration }));
    command.on('error', (err) => reject(err));
  });

  command.run();

  // Style parameters
  const frameStyle = depthConfig.frameStyle || 'card';
  const popOutIntensity = depthConfig.popOutIntensity || 1.15;
  const shadowEnabled = depthConfig.shadow !== false;
  const shadowBlur = depthConfig.shadowBlur || 30;
  const shadowColor = depthConfig.shadowColor || 'rgba(0, 0, 0, 0.65)';
  const floatMotion = depthConfig.floatMotion !== false;

  // Compute framing geometry based on frameStyle
  let frameWidthRatio = 0.72;
  let frameHeightRatio = 0.78;
  let cornerRadius = 24;
  let borderWidth = 10;
  let borderColor = '#FFFFFF';
  let bottomExtraPadding = 0;

  if (frameStyle === 'polaroid') {
    frameWidthRatio = 0.68;
    frameHeightRatio = 0.82;
    cornerRadius = 8;
    borderWidth = 16;
    borderColor = '#FDFCFA';
    bottomExtraPadding = height * 0.12; // Extra white bottom area
  } else if (frameStyle === 'cinema') {
    frameWidthRatio = 0.88;
    frameHeightRatio = 0.65;
    cornerRadius = 12;
    borderWidth = 8;
    borderColor = '#E5E5E5';
  } else if (frameStyle === 'comic') {
    frameWidthRatio = 0.75;
    frameHeightRatio = 0.80;
    cornerRadius = 0;
    borderWidth = 14;
    borderColor = '#000000';
  }

  const baseFrameW = width * frameWidthRatio;
  const baseFrameH = height * frameHeightRatio;

  // Frame rendering loop
  for (let frame = 0; frame < totalFrames; frame++) {
    const timeSec = frame / fps;

    // Clear background
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Blurred Backdrop
    // Draw scaled-up dimmed background to create beautiful depth
    ctx.drawImage(img, -width * 0.1, -height * 0.1, width * 1.2, height * 1.2);
    ctx.fillStyle = 'rgba(10, 10, 18, 0.65)';
    ctx.fillRect(0, 0, width, height);

    // 2. Compute Floating Motion (Oscillation)
    let floatY = 0;
    let floatTilt = 0;
    let floatScale = 1.0;

    if (floatMotion) {
      floatY = Math.sin(timeSec * Math.PI * 1.2) * 12;
      floatTilt = Math.sin(timeSec * Math.PI * 0.8) * 0.012; // ~0.7 degrees tilt
      floatScale = 1.0 + Math.sin(timeSec * Math.PI * 0.6) * 0.015;
    }

    const frameW = baseFrameW * floatScale;
    const frameH = baseFrameH * floatScale;
    const frameX = (width - frameW) / 2;
    const frameY = (height - frameH) / 2 + floatY;

    ctx.save();
    ctx.translate(width / 2, height / 2 + floatY);
    ctx.rotate(floatTilt);
    ctx.translate(-width / 2, -(height / 2 + floatY));

    // 3. Draw Outer Card Drop Shadow & Card Body
    if (shadowEnabled) {
      ctx.shadowColor = shadowColor;
      ctx.shadowBlur = shadowBlur;
      ctx.shadowOffsetY = 16;
      ctx.shadowOffsetX = 0;
    }

    ctx.fillStyle = borderColor;
    roundRect(ctx, frameX, frameY, frameW, frameH, cornerRadius);
    ctx.fill();

    // Reset shadow for inner content
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 4. Draw Inner Scene (Clipped inside the frame)
    const innerPadding = borderWidth;
    const innerX = frameX + innerPadding;
    const innerY = frameY + innerPadding;
    const innerW = frameW - (innerPadding * 2);
    const innerH = frameH - (innerPadding * 2) - bottomExtraPadding;

    ctx.save();
    roundRect(ctx, innerX, innerY, innerW, innerH, Math.max(0, cornerRadius - 4));
    ctx.clip();

    // Draw inner image centered and fitted nicely
    drawImageCover(ctx, img, innerX, innerY, innerW, innerH);
    ctx.restore();

    // 5. Draw Frame Border Stroke
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    roundRect(ctx, frameX, frameY, frameW, frameH, cornerRadius);
    ctx.stroke();

    // 6. Draw Out-of-Bounds Pop-Out Subject (Breaking outside the top frame)
    // We render the upper subject portion or cutout scaled up to create the 3D elevation
    const popScale = popOutIntensity;
    const popW = innerW * popScale;
    const popH = innerH * popScale;
    const popX = innerX - (popW - innerW) / 2;
    const popY = innerY - (popH - innerH); // elevated upwards

    ctx.save();
    if (subjectImg) {
      // If a dedicated cutout subject was provided
      if (shadowEnabled) {
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = shadowBlur * 0.8;
        ctx.shadowOffsetY = 12;
      }
      drawImageCover(ctx, subjectImg, popX, popY, popW, popH);
    } else {
      // Dynamic Pop-out: Extract upper 60% of image with feathered bottom and pop out of top edge
      ctx.save();
      // Clip mask only allowing the top region (outside and upper inside of frame)
      ctx.beginPath();
      ctx.rect(0, 0, width, innerY + innerH * 0.5);
      ctx.clip();

      if (shadowEnabled) {
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = shadowBlur * 0.7;
        ctx.shadowOffsetY = 14;
      }

      drawImageCover(ctx, img, popX, popY, popW, popH);
      ctx.restore();
    }
    ctx.restore();

    // Restore rotation transformation
    ctx.restore();

    // Pipe raw RGBA frame to FFmpeg
    const buffer = canvas.data();
    inputStream.write(buffer);
  }

  inputStream.end();
  return renderPromise;
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawImageCover(ctx: any, img: any, x: number, y: number, w: number, h: number) {
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
  let sw, sh, sx, sy;

  if (imgRatio > targetRatio) {
    sh = img.height;
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = img.width / targetRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
