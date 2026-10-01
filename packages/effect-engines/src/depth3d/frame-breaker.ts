import { Image } from '@napi-rs/canvas';
import type { Depth3DConfig } from '../types';

export interface FrameBreakerState {
  img: Image;
  subjectImg: Image | null;
  bgCanvas?: any;
  width: number;
  height: number;
  frame: number;
  totalFrames: number;
  timeSec: number;
  progress: number;
  depthConfig: Depth3DConfig;
}

export function drawFrameBreakerFrame(ctx: any, state: FrameBreakerState) {
  const { img, subjectImg, width, height, timeSec, depthConfig, bgCanvas } = state;
  const style = depthConfig.frameStyle || 'card';
  const popOutIntensity = depthConfig.popOutIntensity ?? 1.15;
  const shadowEnabled = depthConfig.shadow !== false;
  const shadowBlur = depthConfig.shadowBlur ?? 14;
  const shadowColor = depthConfig.shadowColor || 'rgba(0, 0, 0, 0.6)';
  const floatMotion = depthConfig.floatMotion !== false;

  // 1. Calculate Backdrop Plate & Frame Sizing strictly preserving the Source Image Aspect Ratio
  const imgRatio = img.width / img.height;
  const canvasRatio = width / height;

  let bgW = width;
  let bgH = height;
  let bgX = 0;
  let bgY = 0;

  if (imgRatio > canvasRatio) {
    bgW = width;
    bgH = width / imgRatio;
    bgY = (height - bgH) / 2;
  } else {
    bgH = height;
    bgW = height * imgRatio;
    bgX = (width - bgW) / 2;
  }

  // Helper: Detect non-transparent bounding box from subject image
  let subBBox: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
  if (subjectImg) {
    if ((subjectImg as any)._bbox) {
      subBBox = (subjectImg as any)._bbox;
    } else {
      try {
        const { createCanvas } = require('@napi-rs/canvas');
        const c = createCanvas(subjectImg.width, subjectImg.height);
        const cctx = c.getContext('2d');
        cctx.drawImage(subjectImg, 0, 0);
        const data = cctx.getImageData(0, 0, subjectImg.width, subjectImg.height).data;
        let minX = subjectImg.width, maxX = 0, minY = subjectImg.height, maxY = 0;
        for (let y = 0; y < subjectImg.height; y += 2) {
          for (let x = 0; x < subjectImg.width; x += 2) {
            const a = data[(y * subjectImg.width + x) * 4 + 3];
            if (a > 30) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX > minX && maxY > minY) {
          subBBox = { minX, maxX, minY, maxY };
          (subjectImg as any)._bbox = subBBox;
        }
      } catch {}
    }
  }

  // Calculate inner photo crop (sw, sh, sx, sy) with intelligent subject framing
  const innerZoom = depthConfig.innerZoom ?? (style === 'polaroid' ? 1.50 : 1.38);
  const sw = img.width / innerZoom;
  const sh = img.height / innerZoom;

  let sx = (img.width - sw) / 2;
  let sy = (img.height - sh) * 0.28;

  if (subBBox) {
    const subCenterX = (subBBox.minX + subBBox.maxX) / 2;
    const subCutY = subBBox.minY + (subBBox.maxY - subBBox.minY) * (depthConfig.popOutIntensity ? Math.min(0.42, 0.28 * depthConfig.popOutIntensity) : 0.30);
    sx = Math.max(0, Math.min(img.width - sw, subCenterX - sw / 2 + img.width * (depthConfig.focusOffsetX ?? 0)));
    sy = Math.max(0, Math.min(img.height - sh, subCutY));
  } else {
    const focusOffsetY = depthConfig.focusOffsetY ?? (style === 'polaroid' ? 0.35 : 0.28);
    sx = Math.max(0, Math.min(img.width - sw, (img.width - sw) / 2 + img.width * (depthConfig.focusOffsetX ?? 0)));
    sy = Math.max(0, Math.min(img.height - sh, img.height * focusOffsetY));
  }

  // Sizing card frame to allow ample headroom above for 3D character popout
  let targetInnerH = bgH * (style === 'polaroid' ? 0.52 : (style === 'cinema' ? 0.48 : 0.54));
  let targetInnerW = targetInnerH * (sw / sh);
  let cornerRadius = 24;
  let borderWidth = 16;
  let borderColor = '#ffffff';
  let bottomExtraPadding = 0;

  switch (style) {
    case 'polaroid':
      cornerRadius = 12;
      borderWidth = 16;
      borderColor = '#fdfdfd';
      bottomExtraPadding = bgH * 0.08; // classic thick white polaroid bottom lip
      break;
    case 'cinema':
      cornerRadius = 8;
      borderWidth = 12;
      borderColor = '#111111';
      break;
    case 'comic':
      cornerRadius = 0;
      borderWidth = 16;
      borderColor = '#000000';
      break;
    case 'card':
    default:
      cornerRadius = 24;
      borderWidth = 18;
      borderColor = '#ffffff';
      break;
  }

  const baseFrameW = targetInnerW + borderWidth * 2;
  const baseFrameH = targetInnerH + borderWidth * 2 + bottomExtraPadding;

  // 2. Draw Backdrop (Dimmed Scene preserving exact 100% original aspect ratio plate)
  ctx.save();
  if (bgCanvas) {
    ctx.drawImage(bgCanvas, 0, 0);
  } else {
    ctx.fillStyle = '#06060c';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, img.width, img.height, bgX, bgY, bgW, bgH);
    ctx.fillStyle = 'rgba(10, 10, 18, 0.65)';
    ctx.fillRect(bgX, bgY, bgW, bgH);
  }
  ctx.restore();

  // 3. Compute Floating Motion (Oscillation)
  let floatY = 0;
  let floatTilt = 0;
  let floatScale = 1.0;

  if (floatMotion) {
    floatY = Math.sin(timeSec * Math.PI * 1.2) * 10;
    floatTilt = Math.sin(timeSec * Math.PI * 0.8) * 0.010; // ~0.6 degrees tilt
    floatScale = 1.0 + Math.sin(timeSec * Math.PI * 0.6) * 0.012;
  }

  const frameW = baseFrameW * floatScale;
  const frameH = baseFrameH * floatScale;
  const frameX = (width - frameW) / 2;
  // Position frame slightly lower to leave ample headroom for the character head popping out above
  const frameY = (height - frameH) / 2 + bgH * 0.05 + floatY;

  ctx.save();
  ctx.translate(width / 2, height / 2 + bgH * 0.05 + floatY);
  ctx.rotate(floatTilt);
  ctx.translate(-width / 2, -(height / 2 + bgH * 0.05 + floatY));

  // 4. Draw Outer Card Drop Shadow & Card Body
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

  // 5. Draw Inner Scene (Framed with subject neck line matching top border)
  const innerPadding = borderWidth * floatScale;
  const innerX = frameX + innerPadding;
  const innerY = frameY + innerPadding;
  const innerW = frameW - (innerPadding * 2);
  const innerH = frameH - (innerPadding * 2) - (bottomExtraPadding * floatScale);

  ctx.save();
  roundRect(ctx, innerX, innerY, innerW, innerH, Math.max(0, cornerRadius - 4));
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, innerX, innerY, innerW, innerH);
  ctx.restore();

  // 6. Draw Frame Border Stroke
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  roundRect(ctx, frameX, frameY, frameW, frameH, cornerRadius);
  ctx.stroke();

  // 7. Draw Out-of-Bounds Pop-Out Subject (Head and upper body breaking outside top frame)
  const scale = innerW / sw;
  const offsetX = innerX - sx * scale;
  const offsetY = innerY - sy * scale;

  ctx.save();
  // Clip bottom so subject never bleeds over the bottom card margin
  ctx.beginPath();
  ctx.rect(frameX - 400, frameY - 600, frameW + 800, (innerY + innerH) - (frameY - 600));
  ctx.clip();

  if (shadowEnabled) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur * 1.2;
    ctx.shadowOffsetY = 16;
  }

  if (subjectImg) {
    // Full uncropped subject rendered via exact affine mapping:
    // Lower body matches inner photo 100%, head & hands project freely over top border!
    ctx.drawImage(subjectImg, offsetX, offsetY, img.width * scale, img.height * scale);
  } else {
    // Dynamic Pop-out Fallback
    ctx.save();
    ctx.beginPath();
    const focalCenterX = innerX + innerW * 0.5;
    const focalRadiusX = innerW * 0.42;
    const focalRadiusY = innerH * 0.50;
    ctx.ellipse(focalCenterX, innerY + innerH * 0.25, focalRadiusX, focalRadiusY, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(img, offsetX, offsetY, img.width * scale, img.height * scale);
    ctx.restore();
  }
  ctx.restore();

  // Restore rotation transformation
  ctx.restore();
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

export function drawImageCover(
  ctx: any,
  img: any,
  x: number,
  y: number,
  w: number,
  h: number,
  zoom = 1.0,
  focusOffsetY = 0.0,
  focusOffsetX = 0.0
) {
  const imgRatio = img.width / img.height;
  const targetRatio = w / h;
  let sw, sh, sx, sy;

  if (imgRatio > targetRatio) {
    sh = img.height / zoom;
    sw = (img.height * targetRatio) / zoom;
    sx = Math.max(0, Math.min(img.width - sw, (img.width - sw) / 2 + img.width * focusOffsetX));
    sy = Math.max(0, Math.min(img.height - sh, img.height * focusOffsetY));
  } else {
    sw = img.width / zoom;
    sh = (img.width / targetRatio) / zoom;
    sx = Math.max(0, Math.min(img.width - sw, (img.width - sw) / 2 + img.width * focusOffsetX));
    sy = Math.max(0, Math.min(img.height - sh, (img.height - sh) / 2 + img.height * focusOffsetY));
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}
