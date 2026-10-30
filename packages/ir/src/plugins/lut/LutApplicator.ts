import { ColorMath, type RGB } from './LutCubeGenerator';

/**
 * Applies a pre-baked Float32Array 3D LUT to every pixel of an ImageData
 * using tetrahedral interpolation (industry-standard, same quality as Resolve/Premiere).
 *
 * LUT layout (matching .cube spec): B-major ordering:
 *   index = (b * size * size + g * size + r) * 3
 *
 * @param imageData - mutable ImageData from ctx.getImageData
 * @param lutData   - flattened Float32Array of size^3 * 3 RGB floats (0-1 range)
 * @param size      - LUT grid size (e.g. 17 for 17^3)
 */
export function applyLutToImageData(
  imageData: ImageData,
  lutData: Float32Array,
  size: number
): void {
  const pixels = imageData.data; // Uint8ClampedArray, RGBA
  const sizeM1 = size - 1;
  const sizeM1f = sizeM1;

  for (let i = 0; i < pixels.length; i += 4) {
    const rIn = pixels[i]! / 255;
    const gIn = pixels[i + 1]! / 255;
    const bIn = pixels[i + 2]! / 255;

    // Scale to LUT grid coordinates
    const rx = rIn * sizeM1f;
    const gx = gIn * sizeM1f;
    const bx = bIn * sizeM1f;

    const r0 = Math.floor(rx);
    const g0 = Math.floor(gx);
    const b0 = Math.floor(bx);

    const r1 = Math.min(r0 + 1, sizeM1);
    const g1 = Math.min(g0 + 1, sizeM1);
    const b1 = Math.min(b0 + 1, sizeM1);

    const fr = rx - r0;
    const fg = gx - g0;
    const fb = bx - b0;

    // Tetrahedral interpolation (Sakamoto algorithm)
    const [ro, go, bo] = tetrahedralInterpolate(
      lutData, size,
      r0, g0, b0,
      r1, g1, b1,
      fr, fg, fb
    );

    pixels[i] = Math.round(ColorMath.clamp(ro) * 255);
    pixels[i + 1] = Math.round(ColorMath.clamp(go) * 255);
    pixels[i + 2] = Math.round(ColorMath.clamp(bo) * 255);
    // alpha unchanged
  }
}

function lutAt(data: Float32Array, size: number, r: number, g: number, b: number): RGB {
  const idx = (b * size * size + g * size + r) * 3;
  return [data[idx]!, data[idx + 1]!, data[idx + 2]!];
}

function tetrahedralInterpolate(
  data: Float32Array, size: number,
  r0: number, g0: number, b0: number,
  r1: number, g1: number, b1: number,
  fr: number, fg: number, fb: number
): RGB {
  const c000 = lutAt(data, size, r0, g0, b0);
  const c100 = lutAt(data, size, r1, g0, b0);
  const c010 = lutAt(data, size, r0, g1, b0);
  const c110 = lutAt(data, size, r1, g1, b0);
  const c001 = lutAt(data, size, r0, g0, b1);
  const c101 = lutAt(data, size, r1, g0, b1);
  const c011 = lutAt(data, size, r0, g1, b1);
  const c111 = lutAt(data, size, r1, g1, b1);

  let rOut: number, gOut: number, bOut: number;

  if (fr >= fg && fg >= fb) {
    rOut = (1 - fr) * c000[0] + (fr - fg) * c100[0] + (fg - fb) * c110[0] + fb * c111[0];
    gOut = (1 - fr) * c000[1] + (fr - fg) * c100[1] + (fg - fb) * c110[1] + fb * c111[1];
    bOut = (1 - fr) * c000[2] + (fr - fg) * c100[2] + (fg - fb) * c110[2] + fb * c111[2];
  } else if (fr >= fb && fb >= fg) {
    rOut = (1 - fr) * c000[0] + (fr - fb) * c100[0] + (fb - fg) * c101[0] + fg * c111[0];
    gOut = (1 - fr) * c000[1] + (fr - fb) * c100[1] + (fb - fg) * c101[1] + fg * c111[1];
    bOut = (1 - fr) * c000[2] + (fr - fb) * c100[2] + (fb - fg) * c101[2] + fg * c111[2];
  } else if (fg >= fr && fr >= fb) {
    rOut = (1 - fg) * c000[0] + (fg - fr) * c010[0] + (fr - fb) * c110[0] + fb * c111[0];
    gOut = (1 - fg) * c000[1] + (fg - fr) * c010[1] + (fr - fb) * c110[1] + fb * c111[1];
    bOut = (1 - fg) * c000[2] + (fg - fr) * c010[2] + (fr - fb) * c110[2] + fb * c111[2];
  } else if (fg >= fb && fb >= fr) {
    rOut = (1 - fg) * c000[0] + (fg - fb) * c010[0] + (fb - fr) * c011[0] + fr * c111[0];
    gOut = (1 - fg) * c000[1] + (fg - fb) * c010[1] + (fb - fr) * c011[1] + fr * c111[1];
    bOut = (1 - fg) * c000[2] + (fg - fb) * c010[2] + (fb - fr) * c011[2] + fr * c111[2];
  } else if (fb >= fr && fr >= fg) {
    rOut = (1 - fb) * c000[0] + (fb - fr) * c001[0] + (fr - fg) * c101[0] + fg * c111[0];
    gOut = (1 - fb) * c000[1] + (fb - fr) * c001[1] + (fr - fg) * c101[1] + fg * c111[1];
    bOut = (1 - fb) * c000[2] + (fb - fr) * c001[2] + (fr - fg) * c101[2] + fg * c111[2];
  } else {
    // fb >= fg && fg >= fr
    rOut = (1 - fb) * c000[0] + (fb - fg) * c001[0] + (fg - fr) * c011[0] + fr * c111[0];
    gOut = (1 - fb) * c000[1] + (fb - fg) * c001[1] + (fg - fr) * c011[1] + fr * c111[1];
    bOut = (1 - fb) * c000[2] + (fb - fg) * c001[2] + (fg - fr) * c011[2] + fr * c111[2];
  }

  return [rOut, gOut, bOut];
}
