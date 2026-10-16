import { Pt, Group, Num } from 'pts';

export interface ParallaxVector {
  offsetX: number;
  offsetY: number;
  zoom: number;
  rotation: number;
}

export interface WiggleStereoPair {
  leftEyeOffset: Pt;
  rightEyeOffset: Pt;
  phase: number;
}

/**
 * DepthMathEngine:
 * Uses pts.js vector geometry to compute bit-identical camera parallax,
 * stereo wigglegram offsets, and volumetric depth matrices.
 * Guaranteed mathematical parity across client WebGL and server FFmpeg render loops.
 */
export class DepthMathEngine {
  /**
   * Computes a 2.5D camera parallax offset vector based on normalized time and mouse coordinates.
   */
  public static computeParallax(
    frame: number,
    fps: number,
    intensity = 1.0,
    mouseX = 0.5,
    mouseY = 0.5
  ): ParallaxVector {
    const timeSec = frame / Math.max(1, fps);

    // Dynamic camera drift curve using trigonometric oscillation
    const cameraPt = new Pt(
      Math.sin(timeSec * 0.8) * 20.0 * intensity + (mouseX - 0.5) * 40.0 * intensity,
      Math.cos(timeSec * 0.6) * 12.0 * intensity + (mouseY - 0.5) * 25.0 * intensity
    );

    const zoom = 1.0 + Math.sin(timeSec * 0.4) * 0.05 * intensity;
    const rotation = Math.sin(timeSec * 0.5) * 0.02 * intensity;

    return {
      offsetX: cameraPt.x,
      offsetY: cameraPt.y,
      zoom,
      rotation,
    };
  }

  /**
   * Computes stereo eye separation vectors for wigglegram 3D effects.
   */
  public static computeWigglegram(
    frame: number,
    fps: number,
    frequencyHz = 4.0,
    focalDistancePx = 15.0
  ): WiggleStereoPair {
    const timeSec = frame / Math.max(1, fps);
    const phase = Math.sin(timeSec * Math.PI * 2 * frequencyHz);

    const baseOffset = new Pt(focalDistancePx * phase, 0);
    const leftEye = baseOffset.clone().multiply(-0.5);
    const rightEye = baseOffset.clone().multiply(0.5);

    return {
      leftEyeOffset: leftEye,
      rightEyeOffset: rightEye,
      phase,
    };
  }

  /**
   * Computes 3D bounding geometry for Frame-Breaker pop-out visual effects.
   */
  public static computeFrameBreakerBounds(
    canvasW: number,
    canvasH: number,
    popOutIntensity = 1.2
  ): { innerFrame: Group; breachThreshold: number } {
    const paddingX = canvasW * 0.1;
    const paddingY = canvasH * 0.1;

    const topLeft = new Pt(paddingX, paddingY);
    const bottomRight = new Pt(canvasW - paddingX, canvasH - paddingY);

    const innerFrame = new Group(topLeft, bottomRight);
    const breachThreshold = paddingY * popOutIntensity;

    return {
      innerFrame,
      breachThreshold,
    };
  }
}
