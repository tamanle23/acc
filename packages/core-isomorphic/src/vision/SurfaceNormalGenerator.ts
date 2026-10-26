/**
 * SurfaceNormalGenerator:
 * Generates continuous 3D surface normal vector fields N(x, y) = [Nx, Ny, Nz]
 * from 2D monocular depth map buffers via 3x3 Sobel spatial gradient convolution.
 *
 * Adheres strictly to ZERO-ALLOC-FRAME-LOOP:
 * - Pre-computes and caches normal vectors in contiguous Float32Array buffers [Nx, Ny, Nz, Nx, Ny, Nz...]
 * - Provides zero-allocation lighting evaluation functions that write directly into pixel buffers
 * - 100% isomorphic with zero native C/Node leaks.
 */

export interface SurfaceNormalMap {
  width: number;
  height: number;
  /**
   * Contiguous Float32Array containing Nx, Ny, Nz triples normalized to [-1, 1], length = width * height * 3
   */
  normals: Float32Array;
  /**
   * Normalized scalar depth values in [0.0, 1.0], length = width * height
   */
  depths: Float32Array;
}

export interface Light3DSource {
  /**
   * Normalized light coordinates in clip space:
   * x in [-1, 1] (left to right)
   * y in [-1, 1] (top to bottom)
   * z in [-1, 1] or positive distance (towards viewer)
   */
  position: [number, number, number];
  diffuse: number;
  specular: number;
  shininess?: number;
  ambient?: number;
  rimIntensity?: number;
  color?: [number, number, number]; // [R, G, B] in [0, 255]
}

export interface RelightingParams {
  enabled: boolean;
  lightPosition?: [number, number, number];
  diffuse?: number;
  specular?: number;
  shininess?: number;
  ambient?: number;
  rimIntensity?: number;
  lightColor?: string | [number, number, number];
  normalStrength?: number;
}

export class SurfaceNormalGenerator {
  /**
   * Computes a surface normal map from a normalized depth buffer or 8-bit/16-bit depth values.
   *
   * @param depthArray Uint8Array or Float32Array of depth values (either 1-channel or 4-channel RGBA)
   * @param width Width of depth map
   * @param height Height of depth map
   * @param channels Number of channels per pixel (1 for grayscale, 4 for RGBA)
   * @param strength Normal map gradient height factor (higher = more pronounced surface relief, default 2.0)
   */
  public static generateFromDepth(
    depthArray: Uint8Array | Uint8ClampedArray | Float32Array,
    width: number,
    height: number,
    channels: number = 4,
    strength: number = 2.0
  ): SurfaceNormalMap {
    const totalPixels = width * height;
    const depths = new Float32Array(totalPixels);
    const normals = new Float32Array(totalPixels * 3);

    // 1. Extract normalized depth scalar in [0.0, 1.0]
    const stride = channels;
    for (let i = 0; i < totalPixels; i++) {
      const srcIdx = i * stride;
      // If 4-channel, use red channel or luminance
      const raw = depthArray[srcIdx];
      depths[i] = raw > 1.0 ? raw / 255.0 : raw;
    }

    // 2. 3x3 Sobel Convolution with clamped edge boundaries
    // Gx kernel:
    // [ -1  0  1 ]
    // [ -2  0  2 ]
    // [ -1  0  1 ]
    //
    // Gy kernel:
    // [ -1 -2 -1 ]
    // [  0  0  0 ]
    // [  1  2  1 ]
    const normalFactor = 1.0 / Math.max(0.01, strength);

    for (let y = 0; y < height; y++) {
      const yPrev = y > 0 ? y - 1 : 0;
      const yNext = y < height - 1 ? y + 1 : height - 1;

      const rowPrev = yPrev * width;
      const rowCurr = y * width;
      const rowNext = yNext * width;

      for (let x = 0; x < width; x++) {
        const xPrev = x > 0 ? x - 1 : 0;
        const xNext = x < width - 1 ? x + 1 : width - 1;

        // Sample 8 neighbors
        const z00 = depths[rowPrev + xPrev];
        const z01 = depths[rowPrev + x];
        const z02 = depths[rowPrev + xNext];

        const z10 = depths[rowCurr + xPrev];
        const z12 = depths[rowCurr + xNext];

        const z20 = depths[rowNext + xPrev];
        const z21 = depths[rowNext + x];
        const z22 = depths[rowNext + xNext];

        // Convolve horizontal and vertical gradients
        const gx = (z02 + 2.0 * z12 + z22) - (z00 + 2.0 * z10 + z20);
        const gy = (z20 + 2.0 * z21 + z22) - (z00 + 2.0 * z01 + z02);

        // Vector: [-gx, -gy, normalFactor]
        let nx = -gx;
        let ny = -gy;
        let nz = normalFactor;

        // Normalize vector to unit length
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len > 0.00001) {
          const invLen = 1.0 / len;
          nx *= invLen;
          ny *= invLen;
          nz *= invLen;
        } else {
          nx = 0.0;
          ny = 0.0;
          nz = 1.0;
        }

        const outIdx = (rowCurr + x) * 3;
        normals[outIdx] = nx;
        normals[outIdx + 1] = ny;
        normals[outIdx + 2] = nz;
      }
    }

    return {
      width,
      height,
      normals,
      depths,
    };
  }

  /**
   * Zero-allocation Blinn-Phong dynamic relighting kernel with alpha gating and rim feathering.
   * Modulates destination RGBA pixel buffer directly in-place.
   */
  public static applyRelightingToRgba(
    targetRgba: Uint8Array | Uint8ClampedArray,
    normalMap: SurfaceNormalMap,
    alphaMask: Uint8Array | Uint8ClampedArray | null,
    light: Light3DSource
  ): void {
    const { width, height, normals } = normalMap;
    const totalPixels = width * height;

    const [lxNorm, lyNorm, lzNorm] = light.position;
    const diffuseCoeff = light.diffuse ?? 0.8;
    const specCoeff = light.specular ?? 0.6;
    const shininess = light.shininess ?? 16.0;
    const ambientCoeff = light.ambient ?? 0.15;
    const rimCoeff = light.rimIntensity ?? 0.4;
    const color = light.color ?? [255, 255, 255];

    // Halfway vector H for Blinn-Phong (assuming viewer V is [0, 0, 1])
    // L = normalize([lx, ly, lz])
    const lLen = Math.sqrt(lxNorm * lxNorm + lyNorm * lyNorm + lzNorm * lzNorm);
    const lx = lLen > 0.0001 ? lxNorm / lLen : 0;
    const ly = lLen > 0.0001 ? lyNorm / lLen : 0;
    const lz = lLen > 0.0001 ? lzNorm / lLen : 1;

    // View vector V = [0, 0, 1]
    // H = (L + V) / |L + V|
    const hx = lx;
    const hy = ly;
    const hz = lz + 1.0;
    const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz);
    const halfX = hLen > 0.0001 ? hx / hLen : 0;
    const halfY = hLen > 0.0001 ? hy / hLen : 0;
    const halfZ = hLen > 0.0001 ? hz / hLen : 1;

    for (let i = 0; i < totalPixels; i++) {
      const nIdx = i * 3;
      const nx = normals[nIdx];
      const ny = normals[nIdx + 1];
      const nz = normals[nIdx + 2];

      const pIdx = i * 4;
      const alphaVal = alphaMask ? alphaMask[i] : targetRgba[pIdx + 3];
      const alphaNorm = alphaVal / 255.0;

      // Gate out transparent pixels completely to prevent specular bleed onto background
      if (alphaNorm <= 0.01) {
        continue;
      }

      // 1. Diffuse term: N dot L
      const nDotL = Math.max(0.0, nx * lx + ny * ly + nz * lz);

      // 2. Specular term: (N dot H)^shininess
      const nDotH = Math.max(0.0, nx * halfX + ny * halfY + nz * halfZ);
      const specFactor = nDotH > 0.0 ? Math.pow(nDotH, shininess) : 0.0;

      // 3. Rim feather term: 1.0 - (N dot V) where V = [0, 0, 1] => 1.0 - nz
      // Soft rim transition between alpha [0.2, 0.9]
      let rimFactor = 0.0;
      if (rimCoeff > 0.0) {
        const fresnel = Math.max(0.0, 1.0 - Math.abs(nz));
        const edgeFeather = alphaNorm < 0.9 ? alphaNorm : (1.0 - (alphaNorm - 0.9) * 2.0);
        rimFactor = fresnel * Math.max(0.0, edgeFeather) * rimCoeff;
      }

      // Total luminance multiplier
      const totalIntensity = (ambientCoeff + (nDotL * diffuseCoeff) + (specFactor * specCoeff) + rimFactor) * alphaNorm;

      // Additive screen blend over original base pixel
      // Out = Base + Light * intensity
      const r = targetRgba[pIdx];
      const g = targetRgba[pIdx + 1];
      const b = targetRgba[pIdx + 2];

      const addR = (color[0] / 255.0) * totalIntensity * 255.0;
      const addG = (color[1] / 255.0) * totalIntensity * 255.0;
      const addB = (color[2] / 255.0) * totalIntensity * 255.0;

      targetRgba[pIdx] = Math.min(255, Math.round(r + addR));
      targetRgba[pIdx + 1] = Math.min(255, Math.round(g + addG));
      targetRgba[pIdx + 2] = Math.min(255, Math.round(b + addB));
    }
  }

  /**
   * Helper to parse CSS color hex strings like '#ffaa00' or 'rgb(255, 170, 0)' into [R, G, B].
   */
  public static parseColor(colorStr?: string | [number, number, number]): [number, number, number] {
    if (Array.isArray(colorStr)) return colorStr;
    if (!colorStr) return [255, 255, 255];

    if (colorStr.startsWith('#')) {
      const hex = colorStr.slice(1);
      if (hex.length === 3) {
        return [
          parseInt(hex[0] + hex[0], 16),
          parseInt(hex[1] + hex[1], 16),
          parseInt(hex[2] + hex[2], 16),
        ];
      }
      if (hex.length === 6) {
        return [
          parseInt(hex.slice(0, 2), 16),
          parseInt(hex.slice(2, 4), 16),
          parseInt(hex.slice(4, 6), 16),
        ];
      }
    }

    const rgbMatch = colorStr.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
    if (rgbMatch) {
      return [
        parseInt(rgbMatch[1], 10),
        parseInt(rgbMatch[2], 10),
        parseInt(rgbMatch[3], 10),
      ];
    }

    return [255, 255, 255];
  }
}
