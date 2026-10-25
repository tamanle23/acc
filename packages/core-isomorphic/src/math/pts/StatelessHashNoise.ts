/**
 * StatelessHashNoise:
 * 100% deterministic, stateless coordinate-and-frame hash noise engine.
 * Eliminates Math.random() and mutable PRNG state drift.
 * Value = hash(seed, frame, index).
 */
export class StatelessHashNoise {
  /**
   * Hashes seed, frame, and index into uniform float in [-1, 1].
   */
  public static hash(seed: number, frame: number, index: number = 0): number {
    let h = ((seed & 0xffffffff) ^ Math.imul(frame | 0, 0x45d9f3b) ^ Math.imul(index | 0, 0x27d4eb2d)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h = (h ^ (h >>> 16)) >>> 0;
    return (h / 2147483648) - 1.0;
  }

  /**
   * Hashes seed, frame, and index into uniform float in [0, 1].
   */
  public static hash01(seed: number, frame: number, index: number = 0): number {
    return (this.hash(seed, frame, index) + 1.0) * 0.5;
  }

  /**
   * Coherent continuous 2D spatial lattice noise using stateless bilinear interpolation.
   * Returns a value in [-1, 1].
   */
  public static noise2D(seed: number, frame: number, x: number, y: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const fx = x - x0;
    const fy = y - y0;

    // Smoothstep interpolation curve: 3f^2 - 2f^3
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);

    const s00 = this.hash(seed, frame, Math.imul(x0, 73856093) ^ Math.imul(y0, 19349663));
    const s10 = this.hash(seed, frame, Math.imul(x1, 73856093) ^ Math.imul(y0, 19349663));
    const s01 = this.hash(seed, frame, Math.imul(x0, 73856093) ^ Math.imul(y1, 19349663));
    const s11 = this.hash(seed, frame, Math.imul(x1, 73856093) ^ Math.imul(y1, 19349663));

    const nx0 = s00 + sx * (s10 - s00);
    const nx1 = s01 + sx * (s11 - s01);

    return nx0 + sy * (nx1 - nx0);
  }

  /**
   * 2D Curl turbulence vector computed via spatial partial derivatives.
   * Returns divergence-free velocity field { x, y }.
   */
  public static curlNoise2D(
    seed: number,
    frame: number,
    x: number,
    y: number,
    eps: number = 0.01
  ): { x: number; y: number } {
    const nY1 = this.noise2D(seed, frame, x, y + eps);
    const nY0 = this.noise2D(seed, frame, x, y - eps);
    const nX1 = this.noise2D(seed, frame, x + eps, y);
    const nX0 = this.noise2D(seed, frame, x - eps, y);

    const dNdy = (nY1 - nY0) / (2 * eps);
    const dNdx = (nX1 - nX0) / (2 * eps);

    // 2D Curl: [dN/dy, -dN/dx]
    return {
      x: dNdy,
      y: -dNdx,
    };
  }
}
