import {
  UniversalCanvasProvider,
  CanvasAssetLoader,
  ContentCacheRegistry,
  CacheNamespace,
  fastChecksum,
  MediaEngineRegistry,
  AssetProtocolRegistry,
  UniversalLogger as Logger,
  type ICanvasInstance,
  type IMediaFrameSink,
  VisionEngineRegistry,
  DepthStrategyId,
  SegmentationStrategyId,
} from "@acc/core-isomorphic";
import type {
  ResolvedStoryConfig,
  ResolvedSceneConfig,
  Depth3DConfig,
  CaptionTrackSnapshot,
} from "../types";
import { drawFrameBreakerFrame, drawImageCover } from "./frame-breaker";
import { drawParallaxFrame } from "./parallax";
import { drawSandwichFrame } from "./sandwich";
import { drawDepthMeshFrame } from "./depth-mesh";
import { drawCanvasCaptionsFromSnapshot, BoundedAcousticCaptionStrategy } from "../subtitles";
import { Depth3DFactory } from "./factory";

/**
 * Normalizes a path string by replacing backslashes with forward slashes.
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Returns the directory part of a path string.
 */
function getPathDir(filePath: string): string {
  const norm = normalizePath(filePath);
  const idx = norm.lastIndexOf('/');
  return idx === -1 ? '.' : norm.slice(0, idx);
}

/**
 * Returns the trailing filename or basename of a path string.
 */
function getPathBase(filePath: string, removeExtension: boolean = false): string {
  const norm = normalizePath(filePath);
  const base = norm.split('/').pop() || '';
  if (!removeExtension) return base;
  const dotIdx = base.lastIndexOf('.');
  return dotIdx === -1 ? base : base.slice(0, dotIdx);
}

/**
 * Joins path segments using forward slashes.
 */
function joinPaths(...segments: string[]): string {
  return segments
    .filter(Boolean)
    .join('/')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/');
}

/**
 * Checks whether a path string represents an absolute path.
 */
function isAbsolutePath(p: string): boolean {
  const norm = normalizePath(p);
  return norm.startsWith('/') || /^[a-zA-Z]:\//.test(norm);
}

/**
 * Resolves a potentially relative path against a base directory.
 */
function resolvePath(baseDir: string, relativeOrAbsolute: string): string {
  if (isAbsolutePath(relativeOrAbsolute)) {
    return normalizePath(relativeOrAbsolute);
  }
  return joinPaths(baseDir, relativeOrAbsolute);
}

/**
 * Asynchronously loads asset binary data isomorphically across Node, Bun, and browser environments.
 * Coordinates transparently through ContentCacheRegistry and AssetProtocolRegistry.
 */
async function loadAssetBytes(assetPathOrUri: string): Promise<Uint8Array | null> {
  // 1. In-memory ContentCacheRegistry
  const cache = ContentCacheRegistry.namespace(CacheNamespace.Assets);
  if (await cache.has(assetPathOrUri)) {
    const blob = await cache.get(assetPathOrUri);
    if (blob) {
      const ab = await blob.arrayBuffer();
      return new Uint8Array(ab);
    }
  }

  // 2. AssetProtocolRegistry (protocol URIs, custom schemes, OPFS, disk files)
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

export async function checkExists(p: string): Promise<boolean> {
  const cache = ContentCacheRegistry.namespace(CacheNamespace.Assets);
  if (await cache.has(p)) return true;
  try {
    const blob = AssetProtocolRegistry.getInstance().resolve(p);
    const ab = await blob.arrayBuffer();
    return ab.byteLength > 0;
  } catch {
    return false;
  }
}

import { DepthScenePreprocessor, type PreprocessedDepthScene } from './DepthScenePreprocessor';
import { DepthCanvasCompositor } from './DepthCanvasCompositor';
import { MediaSinkStreamer } from './MediaSinkStreamer';

export * from "./strategy";
export * from "./renderers";
export * from "./factory";
export * from "./DepthScenePreprocessor";
export * from "./DepthCanvasCompositor";
export * from "./MediaSinkStreamer";

export interface Depth3DSceneOptions {
  scene: ResolvedSceneConfig;
  duration: number;
  assPath: string | null;
  config: ResolvedStoryConfig;
  outputPath: string;
  fallbackAudioPath?: string;
  paddingTime?: number;
  useHighQualityIntermediate?: boolean;
  sink?: IMediaFrameSink;
  engine?: string;
}

async function getStoryRootAndCacheDir(
  resolvedImagePath: string,
): Promise<{ storyRoot: string; depthCacheDir: string }> {
  const sceneDir = getPathDir(resolvedImagePath);
  let storyRoot = sceneDir;

  let currDir = sceneDir;
  for (let i = 0; i < 5; i++) {
    if (await checkExists(joinPaths(currDir, "story-config.json"))) {
      storyRoot = currDir;
      break;
    }
    const parent = getPathDir(currDir);
    if (parent === currDir || !parent || parent === '.') break;
    currDir = parent;
  }

  const depthCacheDir = joinPaths(storyRoot, "autogenerated", "depth-3d");
  return { storyRoot, depthCacheDir };
}

/**
 * Unified Runner for all 3D Depth & Visual Pop-Out rendering engines.
 * Pure isomorphic execution leveraging MediaEngineRegistry, ContentCacheRegistry, and UniversalCanvasProvider.
 * Adheres strictly to Single Responsibility Principle via DepthScenePreprocessor, DepthCanvasCompositor, and MediaSinkStreamer.
 */
export async function renderDepth3DScene(options: Depth3DSceneOptions): Promise<{ path: string; duration: number }> {
  const { scene, config } = options;
  const width = config.settings.width || 1080;
  const height = config.settings.height || 1920;
  const depthConfig: Depth3DConfig = scene.depth3d ||
    config.settings.depth3d || { enabled: true, mode: "frame_breaker" };

  const preprocessed = await DepthScenePreprocessor.prepare(scene, depthConfig, width, height);
  const compositor = new DepthCanvasCompositor();
  return MediaSinkStreamer.streamScene(options, preprocessed, compositor);
}

/**
 * Resolves cached or auto-segmented subject cutout image and bounding box for a given image path.
 */
export async function resolveSubjectCutout(
  imagePath: string,
  depthConfig?: Depth3DConfig
): Promise<{ subjectImg: any | null; subjectBBox: any | null }> {
  try {
    const imgBuffer = await loadAssetBytes(imagePath);
    if (!imgBuffer) return { subjectImg: null, subjectBBox: null };

    const { storyRoot, depthCacheDir } = await getStoryRootAndCacheDir(imagePath);
    const segStrat = VisionEngineRegistry.getSegmentationStrategy(depthConfig?.segmentationStrategy);
    const segStratName = (segStrat.name || segStrat.id || "segmentation").replace(/[^a-zA-Z0-9_-]/g, "_");

    const fChecksum = fastChecksum(imgBuffer);

    // 1. Check in-memory ContentCacheRegistry
    const cacheKey = `cutout_${segStratName}_${fChecksum}`;
    const cache = ContentCacheRegistry.namespace(CacheNamespace.VFX);
    if (await cache.has(cacheKey)) {
      const data = await cache.get(cacheKey);
      if (data) {
        const subjectImg = await CanvasAssetLoader.loadImage(data);
        return { subjectImg, subjectBBox: null };
      }
    }

    // 3. Fallback to active/fallback segmentation strategy
    const segRes = await (segStrat as any).segment(imgBuffer);
    if (segRes?.maskCanvas) {
      return { subjectImg: segRes.maskCanvas, subjectBBox: segRes.boundingBox };
    }
    const maskBuffer = (segRes as any)?.maskRgbaBuffer || (segRes as any)?.maskAlphaData;
    if (maskBuffer) {
      await cache.set(cacheKey, maskBuffer, { mimeType: 'image/png' });
      const subjectImg = await CanvasAssetLoader.loadImage(maskBuffer);
      return { subjectImg, subjectBBox: segRes.boundingBox };
    }

    return { subjectImg: null, subjectBBox: null };
  } catch (err: any) {
    Logger.debug('resolveSubjectCutout', `Cutout resolution skipped: ${err?.message || err}`);
    return { subjectImg: null, subjectBBox: null };
  }
}

/**
 * Resolves pre-computed or on-demand depth map data for mesh displacement & 3D re-lighting.
 */
export async function resolveDepthMapData(
  imagePath: string,
  targetWidth: number,
  targetHeight: number,
  depthConfig?: Depth3DConfig
): Promise<{ depthCanvas: ICanvasInstance; depthData: Uint8ClampedArray; normalMap?: any; srcCanvas?: ICanvasInstance }> {
  const imgBuffer = await loadAssetBytes(imagePath);
  if (!imgBuffer) {
    throw new Error(`[resolveDepthMapData] Asset could not be loaded: ${imagePath}`);
  }

  const dCanvas = UniversalCanvasProvider.createCanvas(targetWidth, targetHeight);
  const dCtx = dCanvas.getContext("2d");

  const depthStrat = VisionEngineRegistry.getDepthStrategy(depthConfig?.depthStrategy);
  const depthStratName = (depthStrat.name || depthStrat.id || "depth").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fChecksum = fastChecksum(imgBuffer);

  const cacheKey = `depth_${depthStratName}_${fChecksum}`;
  const cache = ContentCacheRegistry.namespace(CacheNamespace.VFX);

  let loadedDepth = false;
  if (await cache.has(cacheKey)) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      const dm = await CanvasAssetLoader.loadImage(cached);
      drawImageCover(dCtx, dm, 0, 0, targetWidth, targetHeight);
      loadedDepth = true;
    }
  }

  // Check pre-computed cache candidates isomorphically
  if (!loadedDepth) {
    const { storyRoot, depthCacheDir } = await getStoryRootAndCacheDir(imagePath);
    const sceneDir = getPathDir(imagePath);
    const baseName = getPathBase(imagePath, true);

    const candidates = [
      joinPaths(depthCacheDir, `${baseName}_depth_${depthStratName}_${fChecksum}.png`),
      joinPaths(depthCacheDir, `${baseName}_depth_${fChecksum}.png`),
      joinPaths(depthCacheDir, `${baseName}_depth.png`),
      joinPaths(sceneDir, `${baseName}_depth_${depthStratName}_${fChecksum}.png`),
      joinPaths(sceneDir, `${baseName}_depth_${fChecksum}.png`),
      joinPaths(sceneDir, `${baseName}_depth.png`),
      joinPaths(storyRoot, `${baseName}_depth_${fChecksum}.png`),
      joinPaths(storyRoot, `${baseName}_depth.png`),
    ];
    for (const cand of candidates) {
      const data = await loadAssetBytes(cand);
      if (data && data.length > 0) {
        try {
          await cache.set(cacheKey, data, { mimeType: 'image/png' });
          const dm = await CanvasAssetLoader.loadImage(data);
          drawImageCover(dCtx, dm, 0, 0, targetWidth, targetHeight);
          loadedDepth = true;
          break;
        } catch { }
      }
    }
  }

  if (!loadedDepth) {
    try {
      const depthRes = await (depthStrat as any).estimateDepth(imgBuffer);
      if (depthRes?.depthCanvas) {
        drawImageCover(dCtx, depthRes.depthCanvas, 0, 0, targetWidth, targetHeight);
        loadedDepth = true;
      } else {
        const depthBuffer = (depthRes as any)?.depth16Buffer || (depthRes as any)?.depth16Data;
        if (depthBuffer && depthBuffer.length > 0) {
          await cache.set(cacheKey, depthBuffer, { mimeType: 'image/png' });
          const dm = await CanvasAssetLoader.loadImage(depthBuffer);
          drawImageCover(dCtx, dm, 0, 0, targetWidth, targetHeight);
          loadedDepth = true;
        }
      }
    } catch (err: any) {
      Logger.debug('resolveDepthMapData', `Dynamic depth estimation skipped: ${err?.message || err}`);
    }
  }

  if (!loadedDepth) {
    const radGrad = dCtx.createRadialGradient(
      targetWidth / 2,
      targetHeight * 0.52,
      targetWidth * 0.05,
      targetWidth / 2,
      targetHeight * 0.52,
      targetWidth * 0.65,
    );
    radGrad.addColorStop(0, "rgb(255, 255, 255)");
    radGrad.addColorStop(0.5, "rgb(180, 180, 180)");
    radGrad.addColorStop(1, "rgb(30, 30, 30)");
    dCtx.fillStyle = radGrad;
    dCtx.fillRect(0, 0, targetWidth, targetHeight);
  }

  const depthData = dCtx.getImageData(0, 0, targetWidth, targetHeight).data;
  return { depthCanvas: dCanvas, depthData, srcCanvas: dCanvas };
}
