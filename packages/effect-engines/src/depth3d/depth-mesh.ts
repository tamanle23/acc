import { Canvas } from '@napi-rs/canvas';
import type { Depth3DConfig } from '../types';

export interface DepthMeshLayers {
  bgCanvas: Canvas;
  mgCanvas?: Canvas;
  fgCanvas?: Canvas;
}

export interface DepthMeshState {
  srcCanvas: Canvas;
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

  // Smooth Multi-Plane Depth Parallax: Zero grid tearing, continuous cinematic depth
  if (depthLayers) {
    // 1. Background Plane (Moves in counter-direction to foreground, slightly scaled to cover edges)
    ctx.save();
    ctx.translate(width / 2 - camOffsetX * 0.35, height / 2 - camOffsetY * 0.35);
    ctx.scale(1.08 * camZoom, 1.08 * camZoom);
    ctx.translate(-width / 2, -height / 2);
    ctx.drawImage(depthLayers.bgCanvas || srcCanvas, 0, 0);
    ctx.restore();

    // 2. Midground Plane (Intermediate parallax)
    if (depthLayers.mgCanvas) {
      ctx.save();
      ctx.translate(width / 2 + camOffsetX * 0.12, height / 2 + camOffsetY * 0.12);
      ctx.scale(1.04 * camZoom, 1.04 * camZoom);
      ctx.translate(-width / 2, -height / 2);
      ctx.drawImage(depthLayers.mgCanvas, 0, 0);
      ctx.restore();
    }

    // 3. Foreground Subject Plane (Dominant forward parallax + soft depth occlusion shadow)
    if (depthLayers.fgCanvas) {
      ctx.save();
      ctx.translate(width / 2 + camOffsetX * 0.55, height / 2 + camOffsetY * 0.55);
      ctx.scale(1.02 * camZoom, 1.02 * camZoom);
      ctx.translate(-width / 2, -height / 2);

      // Realistic volumetric depth shadow on background
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = camOffsetX * 0.25;
      ctx.shadowOffsetY = 12;

      ctx.drawImage(depthLayers.fgCanvas, 0, 0);
      ctx.restore();
    }
  } else {
    // Graceful smooth fallback: continuous camera orbital drift without cell fragmentation
    ctx.save();
    ctx.translate(width / 2 + camOffsetX * 0.4, height / 2 + camOffsetY * 0.4);
    ctx.scale(1.06 * camZoom, 1.06 * camZoom);
    ctx.translate(-width / 2, -height / 2);
    ctx.drawImage(srcCanvas, 0, 0);
    ctx.restore();
  }
}
