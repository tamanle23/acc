import { Canvas } from '@napi-rs/canvas';
import type { Depth3DConfig } from '../types';

export interface DepthMeshState {
  srcCanvas: Canvas;
  depthData: Uint8ClampedArray;
  gridX: number;
  gridY: number;
  cellW: number;
  cellH: number;
  width: number;
  height: number;
  frame: number;
  totalFrames: number;
  timeSec: number;
  progress: number;
  depthConfig: Depth3DConfig;
}

export function drawDepthMeshFrame(ctx: any, state: DepthMeshState) {
  const { srcCanvas, depthData, gridX, gridY, cellW, cellH, width, height, timeSec, depthConfig } = state;
  const meshSettings = depthConfig.depthMesh || {};
  const motion = meshSettings.motion || 'circle';
  const maxDisplacement = meshSettings.displacementScale ?? 16;

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

  // Render Displaced Grid Mesh
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(1.06 * camZoom, 1.06 * camZoom);
  ctx.translate(-width / 2, -height / 2);

  for (let gy = 0; gy < gridY; gy++) {
    for (let gx = 0; gx < gridX; gx++) {
      const idx = (gy * gridX + gx) * 4;
      const depthVal = depthData[idx] / 255.0; // 0.0 to 1.0

      const dx = camOffsetX * (depthVal - 0.5);
      const dy = camOffsetY * (depthVal - 0.5);

      const sx = gx * cellW;
      const sy = gy * cellH;
      const destX = sx + dx;
      const destY = sy + dy;

      ctx.drawImage(
        srcCanvas,
        sx, sy, cellW, cellH,
        destX, destY, cellW + 1, cellH + 1
      );
    }
  }
  ctx.restore();
}
