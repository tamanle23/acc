import type { ICanvasInstance } from '@acc/core-isomorphic';
import type { Depth3DConfig } from '../types';

export interface DepthMeshLayers {
  bgCanvas: ICanvasInstance | any;
  mgCanvas?: ICanvasInstance | any;
  fgCanvas?: ICanvasInstance | any;
}

export interface DepthMeshState {
  srcCanvas: ICanvasInstance | any;
  depthData?: Uint8ClampedArray;
  depthLayers?: DepthMeshLayers;
  gridX?: number;
  gridY?: number;
  cellW?: number;
  cellH?: number;
  width: number;
  height: number;
  frame: number;
  totalFrames: number;
  timeSec: number;
  progress: number;
  depthConfig: Depth3DConfig;
}

export function drawDepthMeshFrame(ctx: any, state: DepthMeshState) {
  const { srcCanvas, depthLayers, width, height, timeSec, depthConfig } = state;
  const meshSettings = depthConfig.depthMesh || {};
  const motion = meshSettings.motion || 'circle';
  const maxDisplacement = meshSettings.displacementScale ?? 18;

  // Compute Camera Orbital Vector
  let camOffsetX = 0;
  let camOffsetY = 0;
  let camZoom = 1.0;

  switch (motion) {
    case 'horizontal':
      camOffsetX = Math.sin(timeSec * Math.PI * 0.8) * maxDisplacement;
      break;
    case 'vertical':
      camOffsetY = Math.sin(timeSec * Math.PI * 0.8) * maxDisplacement;
      break;
    case 'zoom':
      camZoom = 1.0 + (Math.sin(timeSec * Math.PI * 0.8) * 0.5 + 0.5) * 0.08;
      break;
    case 'circle':
    default:
      camOffsetX = Math.cos(timeSec * Math.PI * 0.8) * maxDisplacement;
      camOffsetY = Math.sin(timeSec * Math.PI * 0.8) * (maxDisplacement * 0.6);
      break;
  }

  const unwrap = (c: any) => (c && typeof c.getRawCanvas === 'function' ? c.getRawCanvas() : c);

  // Smooth Multi-Plane Depth Parallax: Zero grid tearing, continuous cinematic depth
  if (depthLayers) {
    const rawBg = unwrap(depthLayers.bgCanvas || srcCanvas);
    const rawMg = unwrap(depthLayers.mgCanvas);
    const rawFg = unwrap(depthLayers.fgCanvas);

    // 1. Background Plane (Moves in counter-direction to foreground, slightly scaled to cover edges)
    if (rawBg) {
      ctx.save();
      ctx.translate(width / 2 - camOffsetX * 0.35, height / 2 - camOffsetY * 0.35);
      ctx.scale(1.08 * camZoom, 1.08 * camZoom);
      ctx.translate(-width / 2, -height / 2);
      ctx.drawImage(rawBg, 0, 0);
      ctx.restore();
    }

    // 2. Midground Plane (Intermediate parallax)
    if (rawMg) {
      ctx.save();
      ctx.translate(width / 2 + camOffsetX * 0.12, height / 2 + camOffsetY * 0.12);
      ctx.scale(1.04 * camZoom, 1.04 * camZoom);
      ctx.translate(-width / 2, -height / 2);
      ctx.drawImage(rawMg, 0, 0);
      ctx.restore();
    }

    // 3. Foreground Subject Plane (Dominant forward parallax + soft depth occlusion shadow)
    if (rawFg) {
      ctx.save();
      ctx.translate(width / 2 + camOffsetX * 0.55, height / 2 + camOffsetY * 0.55);
      ctx.scale(1.02 * camZoom, 1.02 * camZoom);
      ctx.translate(-width / 2, -height / 2);

      // Realistic volumetric depth shadow on background
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = camOffsetX * 0.25;
      ctx.shadowOffsetY = 12;

      ctx.drawImage(rawFg, 0, 0);
      ctx.restore();
    }
  } else {
    // Graceful smooth fallback: continuous camera orbital drift without cell fragmentation
    const rawSrc = unwrap(srcCanvas);
    if (rawSrc) {
      ctx.save();
      ctx.translate(width / 2 + camOffsetX * 0.4, height / 2 + camOffsetY * 0.4);
      ctx.scale(1.06 * camZoom, 1.06 * camZoom);
      ctx.translate(-width / 2, -height / 2);
      ctx.drawImage(rawSrc, 0, 0);
      ctx.restore();
    }
  }
}
