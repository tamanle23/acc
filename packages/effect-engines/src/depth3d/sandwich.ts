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
  const pos = (sandwichSettings.position as string)?.toLowerCase();

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

  // Compute base Y position
  let baseY = height * 0.38;
  if (pos === 'top' || pos === 'top-center') {
    baseY = height * 0.22;
  } else if (pos === 'center' || pos === 'middle') {
    baseY = height * 0.48;
  } else if (pos === 'bottom' || pos === 'bottom-center') {
    baseY = height * 0.75;
  }
  if (typeof sandwichSettings.positionY === 'number') {
    baseY = sandwichSettings.positionY <= 1.0 ? height * sandwichSettings.positionY : sandwichSettings.positionY;
  }

  if (activeText) {
    ctx.save();

    // 1. Compute Font Size
    let fontSize = Math.round(width * 0.065);
    if (typeof sandwichSettings.fontSize === 'number' && sandwichSettings.fontSize > 0) {
      fontSize = sandwichSettings.fontSize <= 1.0
        ? Math.round(width * sandwichSettings.fontSize)
        : Math.round(sandwichSettings.fontSize);
    }
    ctx.font = `900 ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 3. Compute Position X
    let baseX = width / 2;
    if (typeof sandwichSettings.positionX === 'number') {
      baseX = sandwichSettings.positionX <= 1.0 ? width * sandwichSettings.positionX : sandwichSettings.positionX;
    }

    // 4. Float Motion
    const floatOffset = sandwichSettings.floatMotion !== false ? Math.sin(timeSec * Math.PI * 0.5) * 8 : 0;
    const textY = baseY + floatOffset;
    const textX = baseX;

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
    // Dynamic Subject Segmentation Fallback (when no cutout subjectImg is provided)
    ctx.save();
    ctx.beginPath();
    if (pos === 'bottom' || pos === 'bottom-center' || baseY > height * 0.60) {
      // Center character mask to allow bottom banner text to peek through
      const cw = width * 0.58;
      const ch = height * 0.62;
      const cx = (width - cw) / 2;
      const cy = height * 0.38;
      ctx.rect(cx, cy, cw, ch);
    } else {
      ctx.rect(0, height * 0.42, width, height * 0.58);
    }
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
