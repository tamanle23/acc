import type { ICanvasInstance } from '@acc/core-isomorphic';
import type { Depth3DConfig } from '../types';
import { drawImageCover } from './frame-breaker';

export interface WigglegramState {
  baseCanvas: ICanvasInstance | any;
  subjectImg: any | null;
  width: number;
  height: number;
  frame: number;
  totalFrames: number;
  timeSec: number;
  progress: number;
  depthConfig: Depth3DConfig;
}

export function drawWigglegramFrame(ctx: any, state: WigglegramState) {
  const { baseCanvas, subjectImg, width, height, timeSec, depthConfig } = state;
  const wiggleSettings = depthConfig.wigglegram || {};
  const frequency = wiggleSettings.frequency ?? 8; // Hz
  const amplitude = wiggleSettings.amplitude ?? 12; // px
  const direction = wiggleSettings.direction || 'horizontal';
  const chromatic = wiggleSettings.chromaticAberration !== false;

  // 4-step stereo discretization: -1, -0.33, 0.33, 1
  const phase = Math.sin(timeSec * Math.PI * 2 * frequency);
  const discretePhase = Math.round(phase * 3) / 3;

  let shiftX = discretePhase * amplitude;
  let shiftY = 0;
  let tilt = 0;

  if (direction === 'diagonal') {
    shiftY = discretePhase * (amplitude * 0.5);
  } else if (direction === 'rotational') {
    tilt = discretePhase * 0.008;
  }

  // 1. Draw Background Layer (Slight Counter-Shift)
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(1.05, 1.05);
  ctx.rotate(tilt * 0.5);
  ctx.translate(-width / 2, -height / 2);

  const bgShiftX = -shiftX * 0.4;
  const bgShiftY = -shiftY * 0.4;
  ctx.drawImage(baseCanvas, bgShiftX, bgShiftY);
  ctx.restore();

  // 2. Draw Subject Layer (Forward Shift)
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(1.05, 1.05);
  ctx.rotate(tilt);
  ctx.translate(-width / 2, -height / 2);

  const subShiftX = shiftX * 0.8;
  const subShiftY = shiftY * 0.8;

  if (subjectImg) {
    drawImageCover(ctx, subjectImg, subShiftX, subShiftY, width, height);
  } else {
    // Dynamic center focus region pop
    ctx.save();
    ctx.beginPath();
    ctx.arc(width / 2, height * 0.5, width * 0.38, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(baseCanvas, subShiftX, subShiftY);
    ctx.restore();
  }
  ctx.restore();

  // 3. Chromatic Aberration Simulation during peak shifts
  if (chromatic && Math.abs(discretePhase) > 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.15;
    ctx.drawImage(baseCanvas, subShiftX + 3, subShiftY);
    ctx.drawImage(baseCanvas, subShiftX - 3, subShiftY);
    ctx.restore();
  }
}
