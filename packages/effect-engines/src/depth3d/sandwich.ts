import { Image } from '@napi-rs/canvas';
import type { Depth3DConfig, CaptionConfig } from '../types';
import { drawImageCover } from './frame-breaker';

export interface SandwichState {
  img: Image;
  subjectImg: Image | null;
  width: number;
  height: number;
  frame: number;
  totalFrames: number;
  timeSec: number;
  progress: number;
  depthConfig: Depth3DConfig;
  captions?: CaptionConfig[];
  dustParticles: Array<{
    x: number;
    y: number;
    size: number;
    speedX: number;
    speedY: number;
    opacity: number;
  }>;
}

export function drawSandwichFrame(ctx: any, state: SandwichState) {
  const { img, subjectImg, width, height, frame, timeSec, progress, depthConfig, captions = [], dustParticles } = state;
  const sandwichSettings = depthConfig.sandwich || {};
  const ambientDust = sandwichSettings.ambientDust !== false;
  const vignette = sandwichSettings.vignette !== false;
  const bannerText = sandwichSettings.bannerText;

  // 1. Layer 1: Background Plate (Subtle slow zoom)
  const bgScale = 1.0 + progress * 0.05;
  const bgW = width * bgScale;
  const bgH = height * bgScale;
  const bgX = (width - bgW) / 2;
  const bgY = (height - bgH) / 2;

  ctx.save();
  drawImageCover(ctx, img, bgX, bgY, bgW, bgH);

  // Subtle dark scrim to make midground typography readable
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 2. Layer 2: Midground 3D Typography (Behind Subject)
  let activeText = bannerText;
  if (!activeText && captions.length > 0) {
    const activeCaption = captions.find(c => timeSec >= c.start && timeSec <= c.end);
    if (activeCaption) {
      activeText = activeCaption.text;
    } else {
      activeText = captions.slice(0, 3).map(c => c.text).join(' ');
    }
  }

  if (activeText) {
    ctx.save();
    const fontSize = Math.round(width * 0.065);
    ctx.font = `900 ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textY = height * 0.38 + Math.sin(timeSec * Math.PI * 0.5) * 8;
    const textX = width / 2;

    // 3D Extrusion / Drop Shadow for text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(activeText.toUpperCase(), textX + 4, textY + 6);

    const textGrad = ctx.createLinearGradient(0, textY - fontSize / 2, 0, textY + fontSize / 2);
    textGrad.addColorStop(0, '#FFFFFF');
    textGrad.addColorStop(1, 'rgba(230, 240, 255, 0.85)');

    ctx.fillStyle = textGrad;
    ctx.fillText(activeText.toUpperCase(), textX, textY);
    ctx.restore();
  }

  // 3. Layer 2.5: Ambient Midground Floating Dust
  if (ambientDust && dustParticles) {
    ctx.save();
    for (const d of dustParticles) {
      const cx = (d.x + d.speedX * frame * 2.0) % (width + 40) - 20;
      const cy = (d.y + d.speedY * frame * 2.0) % (height + 40);
      const actualY = cy < 0 ? height + cy : cy;

      ctx.fillStyle = `rgba(255, 255, 255, ${d.opacity})`;
      ctx.beginPath();
      ctx.arc(cx, actualY, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 4. Layer 3: Subject In Front of Text (With Drop Shadow on Text)
  const subScale = 1.0 + progress * 0.08;
  const subW = width * subScale;
  const subH = height * subScale;
  const subX = (width - subW) / 2;
  const subY = (height - subH) / 2;

  ctx.save();
  if (subjectImg) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 12;
    drawImageCover(ctx, subjectImg, subX, subY, subW, subH);
  } else {
    // Dynamic Subject Segmentation: Lower 65% in sharp foreground over text
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, height * 0.42, width, height * 0.58);
    ctx.clip();

    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    drawImageCover(ctx, img, subX, subY, subW, subH);
    ctx.restore();
  }
  ctx.restore();

  // 5. Layer 4: Cinematic Vignette (Edge Volumetric Shadow)
  if (vignette) {
    ctx.save();
    const vignetteGrad = ctx.createRadialGradient(
      width / 2, height / 2, width * 0.35,
      width / 2, height / 2, width * 0.75
    );
    vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}
