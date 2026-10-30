import { ColorMath, type RGB } from './LutCubeGenerator';

export interface ColorWheelValue {
  r: number;  // Red balance: -1.0 to +1.0
  g: number;  // Green balance: -1.0 to +1.0
  b: number;  // Blue balance: -1.0 to +1.0
  y?: number; // Master luminance offset: -1.0 to +1.0
}

export interface StudioColorPipelineParams {
  // --- Stage 1: Primary Color Correction ---
  temperature?: number; // Kelvin shift: -100 (cool/blue) to +100 (warm/amber), default 0
  tint?: number;        // Green/Magenta shift: -100 (green) to +100 (magenta), default 0
  exposure?: number;    // Photometric EV: -3.0 to +3.0, default 0.0
  contrast?: number;    // Contrast factor: 0.2 to 2.5, default 1.0
  pivot?: number;       // Mid-gray pivot: 0.0 to 1.0, default 0.435 (18% photographic gray)
  highlights?: number;  // Highlights rolloff: -100 to +100, default 0
  shadows?: number;     // Shadows rolloff: -100 to +100, default 0
  whites?: number;      // Specular white anchor: -100 to +100, default 0
  blacks?: number;      // Deep black anchor: -100 to +100, default 0

  // 3-Way Color Wheels (ASC CDL / DaVinci Resolve standard)
  lift?: ColorWheelValue;   // Shadows color balance & luma
  gamma?: ColorWheelValue;  // Midtones color balance & luma
  gain?: ColorWheelValue;   // Highlights color balance & luma
  offset?: ColorWheelValue; // Global master balance & luma

  // --- Stage 2: Creative Color Grading ---
  lut?: string;         // Preset key (e.g. 'teal_and_orange', 'kodak_2383')
  lutIntensity?: number;// 0.0 to 1.0 (default 1.0) - blend factor between corrected and LUT
  saturation?: number;  // Saturation factor: 0.0 to 3.0, default 1.0
  vibrance?: number;    // Smart saturation: -100 to +100, default 0
  hueShift?: number;    // Hue rotation in degrees: -180 to +180, default 0

  // --- Stage 3: Vignette & Finishing ---
  vignette?: number;        // Shorthand vignette intensity: 0.0 to 1.0
  vignetteAmount?: number;  // Vignette amount: -1.0 to +1.0, default 0.0
  vignetteMidpoint?: number;// Falloff start radius: 0.1 to 0.9, default 0.5
  vignetteFeather?: number; // Falloff softness: 0.1 to 1.0, default 0.5
  vignetteRoundness?: number;// Roundness: -1.0 (oval) to +1.0 (circular), default 0.0
}

/**
 * Pure mathematical smoothstep function.
 */
function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

/**
 * Applies studio-grade Color Correction (Stage 1) followed by Creative Color Grading (Stage 2)
 * and Vignette Finishing (Stage 3) in a single high-performance contiguous pixel traversal loop.
 *
 * Execution Order:
 * 1. White Balance (Temperature & Tint)
 * 2. Photometric Exposure (EV)
 * 3. 3-Way Color Wheels (Offset, Lift, Gain, Gamma)
 * 4. Highlights / Shadows Rolloff & Whites / Blacks
 * 5. Contrast with 18% Mid-Gray Pivot
 * 6. Creative 3D LUT Tetrahedral Interpolation with Intensity Blend Factor
 * 7. Vibrance & Saturation
 * 8. Radial Vignette Falloff
 */
export function applyColorCorrectionAndGrading(
  imageData: ImageData,
  params: StudioColorPipelineParams,
  lutData?: Float32Array,
  lutSize: number = 17
): void {
  const pixels = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  if (width === 0 || height === 0 || pixels.length === 0) return;

  // --- Precompute Pipeline Constants ---
  const temp = params.temperature ?? 0;
  const tint = params.tint ?? 0;
  const tempR = temp * 0.004;
  const tempB = -temp * 0.004;
  const tintG = -tint * 0.003;
  const tintR = tint * 0.0015;
  const tintB = tint * 0.0015;

  const exposure = params.exposure ?? 0;
  const expFactor = exposure !== 0 ? Math.pow(2, exposure) : 1.0;

  const contrast = params.contrast ?? 1.0;
  const pivot = params.pivot ?? 0.435; // 18% photographic mid-gray
  const highFactor = (params.highlights ?? 0) * 0.0025;
  const shadFactor = (params.shadows ?? 0) * 0.0025;
  const whitesFactor = (params.whites ?? 0) * 0.002;
  const blacksFactor = (params.blacks ?? 0) * 0.002;

  // 3-Way Color Wheels
  const liftY = (params.lift?.y ?? 0) * 0.2;
  const liftR = (params.lift?.r ?? 0) * 0.2 + liftY;
  const liftG = (params.lift?.g ?? 0) * 0.2 + liftY;
  const liftB = (params.lift?.b ?? 0) * 0.2 + liftY;

  const gainY = (params.gain?.y ?? 0) * 0.5;
  const gainR = (params.gain?.r ?? 0) * 0.5 + gainY;
  const gainG = (params.gain?.g ?? 0) * 0.5 + gainY;
  const gainB = (params.gain?.b ?? 0) * 0.5 + gainY;

  const gammaY = (params.gamma?.y ?? 0) * 0.5;
  const gammaR = Math.pow(2, -((params.gamma?.r ?? 0) * 0.5 + gammaY));
  const gammaG = Math.pow(2, -((params.gamma?.g ?? 0) * 0.5 + gammaY));
  const gammaB = Math.pow(2, -((params.gamma?.b ?? 0) * 0.5 + gammaY));

  const offsetY = (params.offset?.y ?? 0) * 0.2;
  const offsetR = (params.offset?.r ?? 0) * 0.2 + offsetY;
  const offsetG = (params.offset?.g ?? 0) * 0.2 + offsetY;
  const offsetB = (params.offset?.b ?? 0) * 0.2 + offsetY;

  const hasWheels =
    liftR !== 0 || liftG !== 0 || liftB !== 0 ||
    gainR !== 0 || gainG !== 0 || gainB !== 0 ||
    gammaR !== 1.0 || gammaG !== 1.0 || gammaB !== 1.0 ||
    offsetR !== 0 || offsetG !== 0 || offsetB !== 0;

  // Creative Grade
  const hasLut = Boolean(lutData && lutSize > 1);
  const lutIntensity = ColorMath.clamp(params.lutIntensity ?? 1.0, 0, 1);
  const lutSizeM1 = lutSize - 1;

  const sat = params.saturation ?? 1.0;
  const vib = (params.vibrance ?? 0) * 0.01;

  // Vignette
  const vigAmt = params.vignetteAmount ?? params.vignette ?? 0.0;
  const vigMid = params.vignetteMidpoint ?? 0.5;
  const vigFeath = Math.max(0.01, params.vignetteFeather ?? 0.5);
  const hasVignette = vigAmt !== 0;
  const halfW = width * 0.5;
  const halfH = height * 0.5;
  const invHalfW = 1.0 / halfW;
  const invHalfH = 1.0 / halfH;

  // --- Pixel Traversal Loop ---
  let pIdx = 0;
  for (let y = 0; y < height; y++) {
    const dy = (y - halfH) * invHalfH;
    const dy2 = dy * dy;

    for (let x = 0; x < width; x++) {
      const rIn = pixels[pIdx]! / 255;
      const gIn = pixels[pIdx + 1]! / 255;
      const bIn = pixels[pIdx + 2]! / 255;

      // 1. White Balance (Temperature & Tint)
      let r = ColorMath.clamp(rIn * (1.0 + tempR + tintR));
      let g = ColorMath.clamp(gIn * (1.0 + tintG));
      let b = ColorMath.clamp(bIn * (1.0 + tempB + tintB));

      // 2. Photometric Exposure (EV)
      if (expFactor !== 1.0) {
        r *= expFactor;
        g *= expFactor;
        b *= expFactor;
      }

      // 3. 3-Way Color Wheels
      if (hasWheels) {
        // Offset
        r += offsetR;
        g += offsetG;
        b += offsetB;

        // Lift (affects shadows predominantly)
        r += liftR * (1.0 - ColorMath.clamp(r));
        g += liftG * (1.0 - ColorMath.clamp(g));
        b += liftB * (1.0 - ColorMath.clamp(b));

        // Gain (multiplies highlights)
        r *= (1.0 + gainR);
        g *= (1.0 + gainG);
        b *= (1.0 + gainB);

        // Gamma (midtones power curve)
        if (gammaR !== 1.0 && r > 0) r = Math.pow(r, gammaR);
        if (gammaG !== 1.0 && g > 0) g = Math.pow(g, gammaG);
        if (gammaB !== 1.0 && b > 0) b = Math.pow(b, gammaB);
      }

      // 4. Highlights / Shadows Rolloff & Whites / Blacks
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (luma > 0.5) {
        const wHigh = (luma - 0.5) * 2.0;
        const delta = highFactor * wHigh;
        r += delta;
        g += delta;
        b += delta;
      } else {
        const wShad = (0.5 - luma) * 2.0;
        const delta = shadFactor * wShad;
        r += delta;
        g += delta;
        b += delta;
      }

      if (whitesFactor !== 0 || blacksFactor !== 0) {
        const wbDelta = whitesFactor * luma + blacksFactor * (1.0 - luma);
        r += wbDelta;
        g += wbDelta;
        b += wbDelta;
      }

      // 5. Contrast with 18% Mid-Gray Pivot
      if (contrast !== 1.0) {
        r = pivot + (r - pivot) * contrast;
        g = pivot + (g - pivot) * contrast;
        b = pivot + (b - pivot) * contrast;
      }

      // Clamp before passing into 3D LUT stage
      r = ColorMath.clamp(r);
      g = ColorMath.clamp(g);
      b = ColorMath.clamp(b);

      // 6. Creative 3D LUT Tetrahedral Interpolation with Intensity Blend
      if (hasLut && lutData) {
        const rx = r * lutSizeM1;
        const gx = g * lutSizeM1;
        const bx = b * lutSizeM1;

        const r0 = Math.floor(rx);
        const g0 = Math.floor(gx);
        const b0 = Math.floor(bx);

        const r1 = Math.min(r0 + 1, lutSizeM1);
        const g1 = Math.min(g0 + 1, lutSizeM1);
        const b1 = Math.min(b0 + 1, lutSizeM1);

        const fr = rx - r0;
        const fg = gx - g0;
        const fb = bx - b0;

        const [rLut, gLut, bLut] = tetrahedralInterpolate(
          lutData, lutSize,
          r0, g0, b0,
          r1, g1, b1,
          fr, fg, fb
        );

        if (lutIntensity >= 0.999) {
          r = rLut;
          g = gLut;
          b = bLut;
        } else if (lutIntensity > 0) {
          r = r * (1.0 - lutIntensity) + rLut * lutIntensity;
          g = g * (1.0 - lutIntensity) + gLut * lutIntensity;
          b = b * (1.0 - lutIntensity) + bLut * lutIntensity;
        }
      }

      // 7. Vibrance & Master Saturation
      if (sat !== 1.0 || vib !== 0) {
        const currentLuma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const chroma = maxC - minC;
        const effectiveSat = sat * (1.0 + vib * (1.0 - chroma));

        r = currentLuma + (r - currentLuma) * effectiveSat;
        g = currentLuma + (g - currentLuma) * effectiveSat;
        b = currentLuma + (b - currentLuma) * effectiveSat;
      }

      // 8. Radial Vignette
      if (hasVignette) {
        const dx = (x - halfW) * invHalfW;
        const dist = Math.sqrt(dx * dx + dy2);
        const falloff = smoothstep(vigMid, vigMid + vigFeath, dist);
        const vMask = Math.max(0, 1.0 - vigAmt * falloff);
        r *= vMask;
        g *= vMask;
        b *= vMask;
      }

      pixels[pIdx] = Math.round(ColorMath.clamp(r) * 255);
      pixels[pIdx + 1] = Math.round(ColorMath.clamp(g) * 255);
      pixels[pIdx + 2] = Math.round(ColorMath.clamp(b) * 255);
      // Alpha remains untouched at pixels[pIdx + 3]

      pIdx += 4;
    }
  }
}

/**
 * Standard isolated 3D LUT applicator (backwards compatible).
 */
export function applyLutToImageData(
  imageData: ImageData,
  lutData: Float32Array,
  size: number
): void {
  applyColorCorrectionAndGrading(imageData, {}, lutData, size);
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
    gOut = (1 - fr) * c000[1] + (fr - fb) * c100[1] + (fb - fg) * c101[1] + fg * c111[0];
    bOut = (1 - fr) * c000[2] + (fr - fb) * c100[2] + (fb - fg) * c101[2] + fg * c111[2];
  } else if (fg >= fr && fr >= fb) {
    rOut = (1 - fg) * c000[0] + (fg - fr) * c010[0] + (fr - fb) * c110[0] + fb * c111[0];
    gOut = (1 - fg) * c000[1] + (fg - fr) * c010[1] + (fr - fb) * c110[1] + fb * c111[1];
    bOut = (1 - fg) * c000[2] + (fg - fr) * c010[2] + (fr - fb) * c110[2] + fb * c111[2];
  } else if (fg >= fb && fb >= fr) {
    rOut = (1 - fg) * c000[0] + (fg - fb) * c010[0] + (fb - fr) * c011[0] + fr * c111[0];
    gOut = (1 - fg) * c000[1] + (fg - fb) * c010[1] + (fb - fr) * c011[1] + fr * c111[0];
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
