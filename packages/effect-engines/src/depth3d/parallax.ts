import type { Depth3DConfig } from '../types';
import { drawImageCover } from './frame-breaker';

export interface ParallaxState {
  img: any;
  subjectImg: any | null;
  bgImg?: any | null;
  width: number;
  height: number;
  frame: number;
  totalFrames: number;
  timeSec: number;
  progress: number;
  depthConfig: Depth3DConfig;
  particles: Array<{
    x: number;
    y: number;
    size: number;
    speedX: number;
    speedY: number;
    opacity: number;
    pulseSpeed: number;
  }>;
}

export function drawParallaxFrame(ctx: any, state: ParallaxState) {
  const { img, subjectImg, bgImg, width, height, frame, totalFrames, timeSec, progress, depthConfig, particles } = state;
  const parallaxSettings = depthConfig.parallax || {};
  const cameraMotion = parallaxSettings.cameraMotion || 'dolly_zoom';
  const intensity = parallaxSettings.intensity ?? 1.0;
  const depthBlur = parallaxSettings.depthBlur !== false;
  const hasForeground = parallaxSettings.foregroundElements !== false;

  // 1. Calculate Camera Multi-Plane Interpolation
  let bgScale = 1.0;
  let bgPanX = 0;
  let bgPanY = 0;
  let subjectScale = 1.0;
  let subjectPanX = 0;
  let subjectPanY = 0;

  switch (cameraMotion) {
    case 'pan_left':
      bgPanX = -progress * 45 * intensity;
      subjectPanX = -progress * 100 * intensity;
      bgScale = 1.06;
      subjectScale = 1.10;
      break;
    case 'pan_right':
      bgPanX = progress * 45 * intensity;
      subjectPanX = progress * 100 * intensity;
      bgScale = 1.06;
      subjectScale = 1.10;
      break;
    case 'zoom_in':
      bgScale = 1.0 + progress * 0.08 * intensity;
      subjectScale = 1.0 + progress * 0.18 * intensity;
      break;
    case 'zoom_out':
      bgScale = 1.08 - progress * 0.08 * intensity;
      subjectScale = 1.18 - progress * 0.18 * intensity;
      break;
    case 'dolly_zoom':
    default:
      bgScale = 1.0 + progress * 0.14 * intensity;
      subjectScale = 1.15 - progress * 0.06 * intensity;
      bgPanY = Math.sin(progress * Math.PI) * 12 * intensity;
      subjectPanY = -Math.sin(progress * Math.PI) * 18 * intensity;
      break;
  }

  // 2. Render Layer 1: Background Plane (Slow Velocity)
  ctx.save();
  const sourceBg = bgImg || img;
  const bgW = width * bgScale;
  const bgH = height * bgScale;
  const bgX = (width - bgW) / 2 + bgPanX;
  const bgY = (height - bgH) / 2 + bgPanY;

  if (depthBlur && subjectImg) {
    ctx.filter = 'blur(6px)';
  }

  drawImageCover(ctx, sourceBg, bgX, bgY, bgW, bgH);
  ctx.restore();

  // 3. Render Layer 2: Subject Plane (Differential Medium Velocity)
  if (subjectImg) {
    ctx.save();
    const subW = width * subjectScale;
    const subH = height * subjectScale;
    const subX = (width - subW) / 2 + subjectPanX;
    const subY = (height - subH) / 2 + subjectPanY;

    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;

    drawImageCover(ctx, subjectImg, subX, subY, subW, subH);
    ctx.restore();
  } else {
    ctx.save();
    const subW = width * subjectScale;
    const subH = height * subjectScale;
    const subX = (width - subW) / 2 + subjectPanX;
    const subY = (height - subH) / 2 + subjectPanY;

    // Smooth subtle center accentuation
    ctx.beginPath();
    ctx.rect(0, 0, width, height * 0.75);
    ctx.clip();
    ctx.globalAlpha = 0.25;
    drawImageCover(ctx, img, subX, subY, subW, subH);
    ctx.restore();
  }

  // 4. Render Layer 3: Foreground Elements (Fast High Velocity Particles & Bokeh)
  if (hasForeground && particles) {
    ctx.save();
    for (const p of particles) {
      const curX = (p.x + p.speedX * frame * 2.5 * intensity) % (width + 60) - 30;
      const curY = (p.y + p.speedY * frame * 2.0 * intensity) % (height + 60);
      const actualY = curY < 0 ? height + curY : curY;

      const pulse = Math.sin(timeSec * p.pulseSpeed) * 0.2 + 0.8;
      const alpha = p.opacity * pulse;

      const grad = ctx.createRadialGradient(curX, actualY, 0, curX, actualY, p.size * 2);
      grad.addColorStop(0, `rgba(255, 245, 200, ${alpha * 1.2})`);
      grad.addColorStop(0.5, `rgba(255, 220, 150, ${alpha * 0.6})`);
      grad.addColorStop(1, 'rgba(255, 220, 150, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(curX, actualY, p.size * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
