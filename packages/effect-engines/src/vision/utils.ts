import { UniversalCanvasProvider, CanvasAssetLoader } from '@acc/core-isomorphic';
import type { BoundingBox } from './types';

// Ensure global Hugging Face cache adheres to GLOBAL-STORAGE rule when in Node/Bun environment
function getGlobalHfCache(): string | undefined {
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const os = require('os');
      const path = require('path');
      return path.join(os.homedir(), '.cache', 'huggingface');
    } catch {}
  }
  return undefined;
}

const globalHfCache = getGlobalHfCache();
if (globalHfCache && typeof process !== 'undefined' && process.env) {
  process.env.HF_HOME = globalHfCache;
}

export function configureHfEnv(transformersEnv?: any) {
  if (globalHfCache && typeof process !== 'undefined' && process.env) {
    process.env.HF_HOME = globalHfCache;
  }
  if (transformersEnv && globalHfCache) {
    transformersEnv.cacheDir = globalHfCache;
    transformersEnv.allowLocalModels = true;
  }
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
  const original = await CanvasAssetLoader.loadImage(originalImageBuffer);
  const origW = original.width;
  const origH = original.height;

  let alphaMask: Uint8Array | number[] | Float32Array;
  let mW = maskWidth;
  let mH = maskHeight;

  if (Buffer.isBuffer(alphaMaskOrBuffer) && (!mW || !mH)) {
    const maskImg = await CanvasAssetLoader.loadImage(alphaMaskOrBuffer);
    mW = maskImg.width;
    mH = maskImg.height;
    const tempCanvas = UniversalCanvasProvider.acquireScratchCanvas(mW, mH);
    try {
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
    } finally {
      UniversalCanvasProvider.releaseScratchCanvas(tempCanvas);
    }
  } else {
    alphaMask = alphaMaskOrBuffer as Uint8Array | number[] | Float32Array;
    mW = mW || origW;
    mH = mH || origH;
  }

  // Mask canvas at mask resolution
  const maskCanvas = UniversalCanvasProvider.acquireScratchCanvas(mW, mH);
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
      let normVal = typeof rawVal === 'number' && rawVal <= 1.0 ? rawVal : Number(rawVal) / 255.0;
      
      // Smoothstep curve for soft edge transition if requested or default
      if (options?.featherRadius !== 0) {
        // smoothstep between 0.1 and 0.9
        const edgeMin = 0.08;
        const edgeMax = 0.92;
        const clamped = Math.max(0, Math.min(1, (normVal - edgeMin) / (edgeMax - edgeMin)));
        normVal = clamped * clamped * (3 - 2 * clamped);
      }
      
      const alpha = Math.max(0, Math.min(255, Math.round(normVal * 255)));
      const pos = idx * 4;
      
      maskImgData.data[pos] = 255;
      maskImgData.data[pos + 1] = 255;
      maskImgData.data[pos + 2] = 255;
      maskImgData.data[pos + 3] = alpha;

      if (alpha > 30) {
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
  const fullCanvas = UniversalCanvasProvider.acquireScratchCanvas(origW, origH);
  const fullCtx = fullCanvas.getContext('2d');

  // Draw original
  fullCtx.drawImage(original, 0, 0, origW, origH);

  // Apply alpha mask via destination-in
  fullCtx.globalCompositeOperation = 'destination-in';
  fullCtx.drawImage(maskCanvas, 0, 0, origW, origH);

  const rgbaBuffer = fullCanvas.toBuffer('image/png');

  // Also export alpha mask canvas scaled to original size
  const alphaCanvas = UniversalCanvasProvider.acquireScratchCanvas(origW, origH);
  const alphaCtx = alphaCanvas.getContext('2d');
  alphaCtx.drawImage(maskCanvas, 0, 0, origW, origH);
  const alphaBuffer = alphaCanvas.toBuffer('image/png');

  // Release scratch canvases back to pool
  UniversalCanvasProvider.releaseScratchCanvas(fullCanvas);
  UniversalCanvasProvider.releaseScratchCanvas(alphaCanvas);
  UniversalCanvasProvider.releaseScratchCanvas(maskCanvas);

  const bbox: BoundingBox = fgPixels > 0
    ? {
        x: minX / mW,
        y: minY / mH,
        width: (maxX - minX + 1) / mW,
        height: (maxY - minY + 1) / mH,
        confidence: 0.95
      }
    : { x: 0.2, y: 0.2, width: 0.6, height: 0.6, confidence: 0.5 };

  return { rgbaBuffer, alphaBuffer, bbox };
}
