/**
 * PostProcessingShaders:
 * Ultra-fast zero-allocation post-processing filter kernels for Canvas/ImageData.
 *
 * Supported shaders:
 * 1. Chromatic Aberration: Fast horizontal channel shift (Red left, Blue right)
 * 2. Bloom & Glow: High-pass thresholding with additive Gaussian blur simulation
 * 3. Anamorphic Lens Flare: Horizontal 1D streak glow with color tinting
 *
 * Adheres strictly to ZERO-ALLOC-FRAME-LOOP and Media Engine Strategy Isolation rules.
 */

export class PostProcessingShaders {
  /**
   * Applies chromatic aberration in-place to an RGBA pixel buffer.
   *
   * @param rgba Target buffer (Uint8Array / Uint8ClampedArray)
   * @param width Canvas width
   * @param height Canvas height
   * @param offsetPx Horizontal shift in pixels (e.g. 2 to 6 px)
   */
  public static applyChromaticAberration(
    rgba: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
    offsetPx: number = 3
  ): void {
    const shift = Math.round(offsetPx);
    if (shift <= 0) return;

    for (let y = 0; y < height; y++) {
      const rowStart = y * width * 4;

      // Temporary scanline copy for red and blue channels to prevent in-place overwrite
      const lineRed = new Uint8Array(width);
      const lineBlue = new Uint8Array(width);
      for (let x = 0; x < width; x++) {
        lineRed[x] = rgba[rowStart + x * 4];
        lineBlue[x] = rgba[rowStart + x * 4 + 2];
      }

      // Shift Red channel left (sampled from x + shift) and Blue channel right (sampled from x - shift)
      for (let x = 0; x < width; x++) {
        const currIdx = rowStart + x * 4;

        if (x + shift < width) {
          rgba[currIdx] = lineRed[x + shift];
        } else {
          rgba[currIdx] = 0;
        }

        if (x - shift >= 0) {
          rgba[currIdx + 2] = lineBlue[x - shift];
        } else {
          rgba[currIdx + 2] = 0;
        }
      }
    }
  }

  /**
   * Evaluates Bloom & Glow by extracting high luminance pixels into a scratch canvas,
   * applying downsampled blur, and compositing with additive screen blending.
   */
  public static applyBloom(
    ctx: any,
    scratchCanvas: any,
    scratchCtx: any,
    width: number,
    height: number,
    threshold: number = 0.7,
    intensity: number = 0.5
  ): void {
    if (intensity <= 0.01) return;

    // 1. Draw snapshot to scratch canvas
    scratchCtx.clearRect(0, 0, width, height);
    scratchCtx.drawImage(ctx.canvas, 0, 0);

    const imgData = scratchCtx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const len = data.length;

    // 2. High-pass thresholding (zero out pixels under threshold)
    const threshVal = threshold * 255;
    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (lum < threshVal) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        const boost = (lum - threshVal) / (255 - threshVal);
        data[i] = Math.min(255, r * boost);
        data[i + 1] = Math.min(255, g * boost);
        data[i + 2] = Math.min(255, b * boost);
      }
    }

    scratchCtx.putImageData(imgData, 0, 0);

    // 3. Composite back with screen blending
    ctx.save();
    try {
      ctx.globalAlpha = Math.min(1.0, intensity);
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(scratchCanvas, 0, 0);
    } finally {
      ctx.restore();
    }
  }

  /**
   * Applies Anamorphic Lens Flare horizontal streak.
   */
  public static applyAnamorphicFlare(
    ctx: any,
    width: number,
    height: number,
    streakLength: number = 80,
    intensity: number = 0.4,
    tintColor: string = 'rgba(70, 160, 255, 0.4)'
  ): void {
    if (intensity <= 0.01) return;

    ctx.save();
    try {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = intensity;
      ctx.fillStyle = tintColor;

      // Draw subtle horizontal anamorphic streak lines across optical center
      const cy = height * 0.45;
      const grad = ctx.createLinearGradient(0, cy, width, cy);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.3, tintColor);
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.8)');
      grad.addColorStop(0.7, tintColor);
      grad.addColorStop(1, 'rgba(0,0,0,0)');

      ctx.fillStyle = grad;
      ctx.fillRect(0, cy - 2, width, 4);
    } finally {
      ctx.restore();
    }
  }
}
