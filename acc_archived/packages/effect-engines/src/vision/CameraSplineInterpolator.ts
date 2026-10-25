/**
 * CameraSplineInterpolator:
 * Mathematical spline and 3D camera trajectory evaluator.
 * Computes 3D position P(t), look-at target T(t), roll angle theta(t), and FOV(t)
 * using Cubic Catmull-Rom & Bezier splines parameterized over normalized progress t in [0, 1].
 *
 * Adheres strictly to ZERO-ALLOC-FRAME-LOOP:
 * - Pre-computes camera state samples into contiguous Float32Array arrays.
 * - Resolves 2D/2.5D affine transform parameters (translation, scale, rotation, skew/perspective)
 *   without heap object instantiation during render loops.
 */

export interface Camera3DKeyframe {
  /** Normalized time in [0, 1] across sequence duration */
  time: number;
  /** Normalized 3D position [x, y, z] in [-1, 1], z > 0 is distance */
  position: [number, number, number];
  /** Normalized look-at target [tx, ty, tz] */
  target?: [number, number, number];
  /** Camera roll angle in degrees */
  roll?: number;
  /** Field of View in degrees (default 60) */
  fov?: number;
  /** Focal depth plane Z in [0, 1] for rack focus (0=near foreground, 1=infinity) */
  focalZ?: number;
  /** Circle of Confusion blur radius factor (0.0 to 1.0) */
  focalAperture?: number;
}

export interface Camera3DState {
  x: number;
  y: number;
  z: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  roll: number;
  fov: number;
  focalZ: number;
  focalAperture: number;
  // Computed 2D affine projections
  scale: number;
  transX: number;
  transY: number;
  rotationRad: number;
}

export class CameraSplineInterpolator {
  /**
   * Evaluates a Catmull-Rom spline curve given four control points and progress t in [0, 1].
   */
  public static catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      0.5 *
      (2 * p1 +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    );
  }

  /**
   * Evaluates cubic Bezier curve for scalar value given p0, p1, p2, p3.
   */
  public static cubicBezier(p0: number, p1: number, p2: number, p3: number, t: number): number {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    return uuu * p0 + 3 * uu * t * p1 + 3 * u * tt * p2 + ttt * p3;
  }

  /**
   * Pre-computes camera trajectory states across discrete sequence frames.
   * Stored in a contiguous Float32Array: [x, y, z, tx, ty, tz, roll, fov, focalZ, focalAperture] * totalFrames
   */
  public static precomputeTrajectory(
    keyframes: Camera3DKeyframe[],
    totalFrames: number,
    canvasWidth: number,
    canvasHeight: number
  ): Float32Array {
    const stride = 10;
    const buffer = new Float32Array(totalFrames * stride);

    if (!keyframes || keyframes.length === 0) {
      // Default identity camera trajectory
      for (let f = 0; f < totalFrames; f++) {
        const offset = f * stride;
        buffer[offset] = 0;     // x
        buffer[offset + 1] = 0; // y
        buffer[offset + 2] = 1; // z (distance 1.0)
        buffer[offset + 3] = 0; // tx
        buffer[offset + 4] = 0; // ty
        buffer[offset + 5] = 0; // tz
        buffer[offset + 6] = 0; // roll
        buffer[offset + 7] = 60; // fov
        buffer[offset + 8] = 0.5; // focalZ
        buffer[offset + 9] = 0.0; // focalAperture
      }
      return buffer;
    }

    // Sort keyframes by time
    const sorted = [...keyframes].sort((a, b) => a.time - b.time);

    // Ensure boundary keyframes at t=0 and t=1
    if (sorted[0].time > 0) {
      sorted.unshift({ ...sorted[0], time: 0 });
    }
    if (sorted[sorted.length - 1].time < 1) {
      sorted.push({ ...sorted[sorted.length - 1], time: 1 });
    }

    const n = sorted.length;

    for (let f = 0; f < totalFrames; f++) {
      const t = totalFrames > 1 ? f / (totalFrames - 1) : 0;

      // Find segment
      let segIdx = 0;
      while (segIdx < n - 1 && sorted[segIdx + 1].time < t) {
        segIdx++;
      }

      const k1 = sorted[segIdx];
      const k2 = sorted[Math.min(n - 1, segIdx + 1)];
      const k0 = sorted[Math.max(0, segIdx - 1)];
      const k3 = sorted[Math.min(n - 1, segIdx + 2)];

      const segDuration = k2.time - k1.time;
      const segT = segDuration > 0.00001 ? Math.min(1.0, Math.max(0.0, (t - k1.time) / segDuration)) : 0;

      // Catmull-Rom interpolation for smooth cinematic curvature
      const x = this.catmullRom(k0.position[0], k1.position[0], k2.position[0], k3.position[0], segT);
      const y = this.catmullRom(k0.position[1], k1.position[1], k2.position[1], k3.position[1], segT);
      const z = Math.max(0.05, this.catmullRom(k0.position[2], k1.position[2], k2.position[2], k3.position[2], segT));

      const tx0 = k0.target?.[0] ?? 0;
      const tx1 = k1.target?.[0] ?? 0;
      const tx2 = k2.target?.[0] ?? 0;
      const tx3 = k3.target?.[0] ?? 0;
      const tx = this.catmullRom(tx0, tx1, tx2, tx3, segT);

      const ty0 = k0.target?.[1] ?? 0;
      const ty1 = k1.target?.[1] ?? 0;
      const ty2 = k2.target?.[1] ?? 0;
      const ty3 = k3.target?.[1] ?? 0;
      const ty = this.catmullRom(ty0, ty1, ty2, ty3, segT);

      const tz0 = k0.target?.[2] ?? 0;
      const tz1 = k1.target?.[2] ?? 0;
      const tz2 = k2.target?.[2] ?? 0;
      const tz3 = k3.target?.[2] ?? 0;
      const tz = this.catmullRom(tz0, tz1, tz2, tz3, segT);

      const roll0 = k0.roll ?? 0;
      const roll1 = k1.roll ?? 0;
      const roll2 = k2.roll ?? 0;
      const roll3 = k3.roll ?? 0;
      const roll = this.catmullRom(roll0, roll1, roll2, roll3, segT);

      const fov0 = k0.fov ?? 60;
      const fov1 = k1.fov ?? 60;
      const fov2 = k2.fov ?? 60;
      const fov3 = k3.fov ?? 60;
      const fov = Math.max(10, this.catmullRom(fov0, fov1, fov2, fov3, segT));

      const focalZ0 = k0.focalZ ?? 0.5;
      const focalZ1 = k1.focalZ ?? 0.5;
      const focalZ2 = k2.focalZ ?? 0.5;
      const focalZ3 = k3.focalZ ?? 0.5;
      const focalZ = Math.min(1.0, Math.max(0.0, this.catmullRom(focalZ0, focalZ1, focalZ2, focalZ3, segT)));

      const aper0 = k0.focalAperture ?? 0.0;
      const aper1 = k1.focalAperture ?? 0.0;
      const aper2 = k2.focalAperture ?? 0.0;
      const aper3 = k3.focalAperture ?? 0.0;
      const focalAperture = Math.min(1.0, Math.max(0.0, this.catmullRom(aper0, aper1, aper2, aper3, segT)));

      const offset = f * stride;
      buffer[offset] = x;
      buffer[offset + 1] = y;
      buffer[offset + 2] = z;
      buffer[offset + 3] = tx;
      buffer[offset + 4] = ty;
      buffer[offset + 5] = tz;
      buffer[offset + 6] = roll;
      buffer[offset + 7] = fov;
      buffer[offset + 8] = focalZ;
      buffer[offset + 9] = focalAperture;
    }

    return buffer;
  }

  /**
   * Fast zero-allocation reader that unpacks frame state from precomputed buffer.
   */
  public static readFrameState(
    buffer: Float32Array,
    frame: number,
    canvasWidth: number,
    canvasHeight: number,
    out: Camera3DState
  ): void {
    const stride = 10;
    const offset = Math.min(buffer.length - stride, Math.max(0, frame * stride));

    out.x = buffer[offset];
    out.y = buffer[offset + 1];
    out.z = buffer[offset + 2];
    out.targetX = buffer[offset + 3];
    out.targetY = buffer[offset + 4];
    out.targetZ = buffer[offset + 5];
    out.roll = buffer[offset + 6];
    out.fov = buffer[offset + 7];
    out.focalZ = buffer[offset + 8];
    out.focalAperture = buffer[offset + 9];

    // Compute perspective projection parameters
    // Perspective scale is inversely proportional to distance z and FOV
    // Base scale = (1 / z) * tan(referenceFov / 2) / tan(fov / 2)
    const refFovRad = (60 * Math.PI) / 180;
    const currentFovRad = (Math.max(10, out.fov) * Math.PI) / 180;
    const fovScale = Math.tan(refFovRad / 2) / Math.tan(currentFovRad / 2);
    out.scale = (1.0 / Math.max(0.05, out.z)) * fovScale;

    // Translation relative to camera center and look-at target
    out.transX = (out.targetX - out.x) * canvasWidth * 0.5;
    out.transY = (out.targetY - out.y) * canvasHeight * 0.5;
    out.rotationRad = (out.roll * Math.PI) / 180;
  }
}
