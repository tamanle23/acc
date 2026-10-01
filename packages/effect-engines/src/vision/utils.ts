import os from 'os';
import path from 'path';
import { env } from '@huggingface/transformers';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { BoundingBox } from './types';

// Ensure global Hugging Face cache adheres to GLOBAL-STORAGE rule
const globalHfCache = path.join(os.homedir(), '.cache', 'huggingface');
env.cacheDir = globalHfCache;
env.allowLocalModels = true;

export function configureHfEnv() {
  env.cacheDir = globalHfCache;
}

/**
 * Creates an RGBA PNG buffer from an original image buffer and a 1-channel binary/grayscale alpha mask or mask image Buffer.
 */
export async function createCutoutRgba(
  originalImageBuffer: Buffer,
  alphaMaskOrBuffer: Uint8Array | number[] | Float32Array | Buffer,
  maskWidth?: number,
  maskHeight?: number,
  options?: { fillHoles?: boolean; featherRadius?: number }
): Promise<{ rgbaBuffer: Buffer; alphaBuffer: Buffer; bbox: BoundingBox }> {
  const original = await loadImage(originalImageBuffer);
  const origW = original.width;
  const origH = original.height;

  let alphaMask: Uint8Array | number[] | Float32Array;
  let mW = maskWidth;
  let mH = maskHeight;

  if (Buffer.isBuffer(alphaMaskOrBuffer) && (!mW || !mH)) {
    const maskImg = await loadImage(alphaMaskOrBuffer);
    mW = maskImg.width;
    mH = maskImg.height;
    const tempCanvas = createCanvas(mW, mH);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(maskImg, 0, 0, mW, mH);
    const rawData = tempCtx.getImageData(0, 0, mW, mH).data;
    const arrayMask = new Uint8Array(mW * mH);
    for (let i = 0; i < mW * mH; i++) {
      const r = rawData[i * 4];
      const g = rawData[i * 4 + 1];
      const b = rawData[i * 4 + 2];
      const a = rawData[i * 4 + 3];
      // If image has RGB white/black mask or alpha
      const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      arrayMask[i] = a > 0 ? (lum > 0 ? lum : a) : 0;
    }
    alphaMask = arrayMask;
  } else {
    alphaMask = alphaMaskOrBuffer as Uint8Array | number[] | Float32Array;
    mW = mW || origW;
    mH = mH || origH;
  }

  // Mask canvas at mask resolution
  const maskCanvas = createCanvas(mW, mH);
  const maskCtx = maskCanvas.getContext('2d');
  const maskImgData = maskCtx.createImageData(mW, mH);

  let minX = mW;
  let maxX = 0;
  let minY = mH;
  let maxY = 0;
  let fgPixels = 0;

  for (let y = 0; y < mH; y++) {
    for (let x = 0; x < mW; x++) {
      const idx = y * mW + x;
      const rawVal = alphaMask[idx];
      const alpha = typeof rawVal === 'number' && rawVal <= 1.0 ? Math.round(rawVal * 255) : Math.round(Number(rawVal));
      const pos = idx * 4;
      
      maskImgData.data[pos] = 255;
      maskImgData.data[pos + 1] = 255;
      maskImgData.data[pos + 2] = 255;
      maskImgData.data[pos + 3] = alpha > 127 ? 255 : 0;

      if (alpha > 127) {
        fgPixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  maskCtx.putImageData(maskImgData, 0, 0);

  // Full resolution RGBA canvas
  const fullCanvas = createCanvas(origW, origH);
  const fullCtx = fullCanvas.getContext('2d');

  // Draw original
  fullCtx.drawImage(original, 0, 0, origW, origH);

  // Apply alpha mask via destination-in
  fullCtx.globalCompositeOperation = 'destination-in';
  fullCtx.drawImage(maskCanvas, 0, 0, origW, origH);

  const rgbaBuffer = fullCanvas.toBuffer('image/png');

  // Also export alpha mask canvas scaled to original size
  const alphaCanvas = createCanvas(origW, origH);
  const alphaCtx = alphaCanvas.getContext('2d');
  alphaCtx.drawImage(maskCanvas, 0, 0, origW, origH);
  const alphaBuffer = alphaCanvas.toBuffer('image/png');

  const bbox: BoundingBox = fgPixels > 0
    ? {
        x: minX / maskWidth,
        y: minY / maskHeight,
        width: (maxX - minX + 1) / maskWidth,
        height: (maxY - minY + 1) / maskHeight,
        confidence: 0.95
      }
    : { x: 0.2, y: 0.2, width: 0.6, height: 0.6, confidence: 0.5 };

  return { rgbaBuffer, alphaBuffer, bbox };
}
