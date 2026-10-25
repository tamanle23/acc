import { run, bench, group } from 'mitata';

group('Color Grading & Image Matrix Math', () => {
  // Test frame: 1920x1080 Float32 RGBA color matrix values
  const pixelCount = 10000;
  const pixels = new Float32Array(pixelCount * 4);

  // Seed sample RGB pixels
  for (let i = 0; i < pixelCount * 4; i += 4) {
    pixels[i] = Math.random();     // R
    pixels[i + 1] = Math.random(); // G
    pixels[i + 2] = Math.random(); // B
    pixels[i + 3] = 1.0;           // A
  }

  bench('RGB Contrast & Saturation Matrix Transformation (10k Pixels)', () => {
    const out = new Float32Array(pixels.length);
    const contrast = 1.15;
    const saturation = 1.2;

    for (let i = 0; i < pixels.length; i += 4) {
      let r = pixels[i];
      let g = pixels[i + 1];
      let b = pixels[i + 2];

      // Apply contrast
      r = (r - 0.5) * contrast + 0.5;
      g = (g - 0.5) * contrast + 0.5;
      b = (b - 0.5) * contrast + 0.5;

      // Apply saturation (Luma weights)
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = luma + (r - luma) * saturation;
      g = luma + (g - luma) * saturation;
      b = luma + (b - luma) * saturation;

      out[i] = Math.max(0, Math.min(1, r));
      out[i + 1] = Math.max(0, Math.min(1, g));
      out[i + 2] = Math.max(0, Math.min(1, b));
      out[i + 3] = pixels[i + 3];
    }
  });

  bench('Tone Mapping Rec.709 to PQ/HDR Curves (10k Pixels)', () => {
    const out = new Float32Array(pixels.length);
    const gamma = 2.2;
    const invGamma = 1.0 / gamma;

    for (let i = 0; i < pixels.length; i += 4) {
      out[i] = Math.pow(pixels[i], invGamma);
      out[i + 1] = Math.pow(pixels[i + 1], invGamma);
      out[i + 2] = Math.pow(pixels[i + 2], invGamma);
      out[i + 3] = pixels[i + 3];
    }
  });
});

if (import.meta.main) {
  run();
}
