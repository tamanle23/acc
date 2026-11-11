import {
  UniversalCanvasProvider,
  CanvasAssetLoader,
  ContentCacheRegistry,
  CacheNamespace,
  fastChecksum,
  AssetProtocolRegistry,
  UniversalLogger as Logger,
  type ICanvasInstance,
  VisionEngineRegistry,
} from '@acc/core-isomorphic';
import type { ResolvedSceneConfig, Depth3DConfig } from '../types';
import { drawImageCover } from './frame-breaker';

export interface PreprocessedDepthScene {
  img: any;
  subjectImg: any | null;
  subjectBBox: any | null;
  bgImg: any | null;
  particles: any[];
  dustParticles: any[];
  dCanvas: ICanvasInstance;
  sCanvas: ICanvasInstance;
  depthLayers: {
    bg: ICanvasInstance;
    mg: ICanvasInstance;
    fg: ICanvasInstance;
  } | null;
  dispose: () => void;
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

export function getPathDir(filePath: string): string {
  const norm = normalizePath(filePath);
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? '.' : norm.slice(0, idx);
}

export function getPathBase(filePath: string, removeExtension = false): string {
  const norm = normalizePath(filePath);
  const base = norm.split('/').pop() || '';
  if (!removeExtension) return base;
  const dotIdx = base.lastIndexOf('.');
  return dotIdx === -1 ? base : base.slice(0, dotIdx);
}

export function joinPaths(...segments: string[]): string {
  return segments
    .filter(Boolean)
    .join('/')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
}

export async function loadAssetBytes(assetPathOrUri: string): Promise<Uint8Array | null> {
  // 1. In-memory ContentCacheRegistry
  const cache = ContentCacheRegistry.namespace(CacheNamespace.Assets);
  if (await cache.has(assetPathOrUri)) {
    const blob = await cache.get(assetPathOrUri);
    if (blob) {
      const ab = await blob.arrayBuffer();
      return new Uint8Array(ab);
    }
  }

  // 2. AssetProtocolRegistry
  try {
    const assetBlob = AssetProtocolRegistry.getInstance().resolve(assetPathOrUri);
    if (assetBlob && typeof assetBlob.arrayBuffer === 'function') {
      const ab = await assetBlob.arrayBuffer();
      if (ab && ab.byteLength > 0) {
        return new Uint8Array(ab);
      }
    }
  } catch {}

  // 3. Web-standard fetch for HTTP/HTTPS/blob/data URLs
  if (typeof fetch === 'function' && /^(https?|blob|data):/i.test(assetPathOrUri)) {
    try {
      const res = await fetch(assetPathOrUri);
      if (res.ok) {
        const ab = await res.arrayBuffer();
        return new Uint8Array(ab);
      }
    } catch {}
  }

  return null;
}

export class DepthScenePreprocessor {
  public static async prepare(
    scene: ResolvedSceneConfig,
    depthConfig: Depth3DConfig,
    width: number,
    height: number
  ): Promise<PreprocessedDepthScene> {
    const mode = depthConfig.mode || 'frame_breaker';

    // 1. Read input image buffer isomorphically
    const imgBuffer = await loadAssetBytes(scene.resolvedImage);
    if (!imgBuffer) {
      throw new Error(`[DepthScenePreprocessor] Asset not found or could not be loaded: ${scene.resolvedImage}`);
    }

    const img = await CanvasAssetLoader.loadImage(imgBuffer);
    let subjectImg: any | null = null;
    let subjectBBox: any = null;

    const shouldAutoSegment =
      depthConfig.autoSegment !== undefined
        ? depthConfig.autoSegment
        : mode === 'frame_breaker' ||
          mode === 'volumetric_sandwich' ||
          mode === 'sandwich';

    const segStrat = VisionEngineRegistry.getSegmentationStrategy(depthConfig?.segmentationStrategy);

    if (shouldAutoSegment) {
      try {
        const segRes = await (segStrat as any).segment(imgBuffer);
        const maskBuffer = (segRes as any)?.maskRgbaBuffer || (segRes as any)?.maskAlphaData;
        if (maskBuffer) {
          subjectImg = await CanvasAssetLoader.loadImage(maskBuffer);
          subjectBBox = segRes.boundingBox;
        }
      } catch {}
    }

    // 2. Setup Mode-Specific Particles
    const particles =
      mode === 'parallax_25d' || mode === 'parallax_dolly'
        ? Array.from({ length: 28 }, (_, i) => ({
            x: (Math.sin(i * 99) * 0.5 + 0.5) * width,
            y: (Math.cos(i * 33) * 0.5 + 0.5) * height,
            size: 3 + (i % 6) * 3,
            speedX: (0.4 + (i % 3) * 0.3) * (i % 2 === 0 ? 1 : -1),
            speedY: -0.5 - (i % 4) * 0.4,
            opacity: 0.2 + (i % 5) * 0.15,
            layer: i % 3,
            pulseSpeed: 1.5 + (i % 3) * 0.5,
            parallaxFactor: 0.15 + (i % 4) * 0.1,
          }))
        : [];

    // 3. Acquire Scratch Canvases for Depth & Cover
    const dCanvas = UniversalCanvasProvider.acquireScratchCanvas(width, height);
    const dCtx = dCanvas.getContext('2d');

    const sCanvas = UniversalCanvasProvider.acquireScratchCanvas(width, height);
    const sCtx = sCanvas.getContext('2d');
    drawImageCover(sCtx, img, 0, 0, width, height);

    let loadedDepth = false;
    const depthStrat = VisionEngineRegistry.getDepthStrategy(depthConfig?.depthStrategy);

    if (depthConfig.autoDepth) {
      try {
        const depthRes = await (depthStrat as any).estimateDepth(imgBuffer);
        const depthBuffer = (depthRes as any)?.depth16Buffer || (depthRes as any)?.depth16Data;
        if (depthBuffer && depthBuffer.length > 0) {
          const dm = await CanvasAssetLoader.loadImage(depthBuffer);
          drawImageCover(dCtx, dm, 0, 0, width, height);
          loadedDepth = true;
        }
      } catch {}
    }

    if (!loadedDepth) {
      const radGrad = dCtx.createRadialGradient(
        width / 2,
        height * 0.52,
        width * 0.05,
        width / 2,
        height * 0.52,
        width * 0.65
      );
      radGrad.addColorStop(0, 'rgb(255, 255, 255)');
      radGrad.addColorStop(0.5, 'rgb(180, 180, 180)');
      radGrad.addColorStop(1, 'rgb(30, 30, 30)');
      dCtx.fillStyle = radGrad;
      dCtx.fillRect(0, 0, width, height);
    }

    // 4. Build Continuous Multi-Plane Depth Layers
    let depthLayers: { bg: ICanvasInstance; mg: ICanvasInstance; fg: ICanvasInstance } | null = null;
    try {
      const depthDataFull = dCtx.getImageData(0, 0, width, height).data;
      const srcDataFull = sCtx.getImageData(0, 0, width, height).data;

      const mgCanvas = UniversalCanvasProvider.acquireScratchCanvas(width, height);
      const mgCtx = mgCanvas.getContext('2d');
      const mgImgData = mgCtx.createImageData(width, height);
      const mgData = mgImgData.data;

      const fgCanvas = UniversalCanvasProvider.acquireScratchCanvas(width, height);
      const fgCtx = fgCanvas.getContext('2d');
      const fgImgData = fgCtx.createImageData(width, height);
      const fgData = fgImgData.data;

      const bgC = UniversalCanvasProvider.acquireScratchCanvas(width, height);
      const bgCctx = bgC.getContext('2d');
      const bgImgData = bgCctx.createImageData(width, height);
      const bgData = bgImgData.data;

      const totalPixels = width * height;
      for (let p = 0; p < totalPixels; p++) {
        const idx = p * 4;
        const dVal = depthDataFull[idx];
        const r = srcDataFull[idx];
        const g = srcDataFull[idx + 1];
        const b = srcDataFull[idx + 2];
        const a = srcDataFull[idx + 3];

        if (dVal < 90) {
          bgData[idx] = r;
          bgData[idx + 1] = g;
          bgData[idx + 2] = b;
          bgData[idx + 3] = a;
        } else if (dVal < 170) {
          mgData[idx] = r;
          mgData[idx + 1] = g;
          mgData[idx + 2] = b;
          mgData[idx + 3] = a;
        } else {
          fgData[idx] = r;
          fgData[idx + 1] = g;
          fgData[idx + 2] = b;
          fgData[idx + 3] = a;
        }
      }

      mgCtx.putImageData(mgImgData, 0, 0);
      fgCtx.putImageData(fgImgData, 0, 0);
      bgCctx.putImageData(bgImgData, 0, 0);

      depthLayers = { bg: bgC, mg: mgCanvas, fg: fgCanvas };
    } catch {}

    const dispose = (): void => {
      try {
        UniversalCanvasProvider.releaseScratchCanvas(dCanvas);
        UniversalCanvasProvider.releaseScratchCanvas(sCanvas);
        if (depthLayers) {
          if (depthLayers.bg) UniversalCanvasProvider.releaseScratchCanvas(depthLayers.bg);
          if (depthLayers.mg) UniversalCanvasProvider.releaseScratchCanvas(depthLayers.mg);
          if (depthLayers.fg) UniversalCanvasProvider.releaseScratchCanvas(depthLayers.fg);
        }
      } catch {}
    };

    return {
      img,
      subjectImg,
      subjectBBox,
      bgImg: null,
      particles,
      dustParticles: [],
      dCanvas,
      sCanvas,
      depthLayers,
      dispose,
    };
  }
}
