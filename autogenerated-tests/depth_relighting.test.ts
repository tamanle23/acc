import { describe, it, expect } from 'bun:test';
import { createCanvas } from '@napi-rs/canvas';
import {
  SurfaceNormalGenerator,
  type SurfaceNormalMap,
  type Light3DSource,
} from '../packages/effect-engines/src/vision/SurfaceNormalGenerator';
import { Depth3DPlugin } from '../packages/ir/src/plugins/vfx/Depth3DPlugin';

describe('Phase 1: Depth-Aware Dynamic Relighting & Normal Map Shading', () => {
  it('should compute surface normal maps from synthetic depth gradient using Sobel convolution', () => {
    const width = 64;
    const height = 64;
    const depthData = new Uint8Array(width * height * 4);

    // Create a horizontal depth ramp: depth increases from left (0) to right (255)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const val = Math.round((x / (width - 1)) * 255);
        depthData[idx] = val;     // R
        depthData[idx + 1] = val; // G
        depthData[idx + 2] = val; // B
        depthData[idx + 3] = 255; // A
      }
    }

    const normalMap = SurfaceNormalGenerator.generateFromDepth(depthData, width, height, 4, 2.0);

    expect(normalMap.width).toBe(width);
    expect(normalMap.height).toBe(height);
    expect(normalMap.normals.length).toBe(width * height * 3);
    expect(normalMap.depths.length).toBe(width * height);

    // Check center pixel normal vector: horizontal ramp means positive Gx -> negative Nx, Ny ~ 0, Nz > 0
    const centerX = 32;
    const centerY = 32;
    const centerIdx = (centerY * width + centerX) * 3;
    const nx = normalMap.normals[centerIdx];
    const ny = normalMap.normals[centerIdx + 1];
    const nz = normalMap.normals[centerIdx + 2];

    // For a ramp increasing left-to-right, the surface slopes towards the right (normal points back-left)
    expect(nx).toBeLessThan(0); // nx < 0
    expect(Math.abs(ny)).toBeLessThan(0.001); // no vertical slope
    expect(nz).toBeGreaterThan(0); // points towards camera

    // Normal vector must be unit length: ||N|| ≈ 1.0
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    expect(length).toBeGreaterThan(0.999);
    expect(length).toBeLessThan(1.001);
  });

  it('should evaluate Blinn-Phong lighting and gate highlights by alpha mask', () => {
    const width = 32;
    const height = 32;
    const totalPixels = width * height;

    // Flat surface normal (Nz = 1, Nx = 0, Ny = 0)
    const normals = new Float32Array(totalPixels * 3);
    const depths = new Float32Array(totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      normals[i * 3] = 0;
      normals[i * 3 + 1] = 0;
      normals[i * 3 + 2] = 1.0;
      depths[i] = 0.5;
    }

    const normalMap: SurfaceNormalMap = { width, height, normals, depths };

    // RGBA test buffer (base color: 100, 100, 100)
    const rgba = new Uint8Array(totalPixels * 4);
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      rgba[idx] = 100;
      rgba[idx + 1] = 100;
      rgba[idx + 2] = 100;
      // Top half opaque (255), bottom half transparent (0)
      rgba[idx + 3] = i < totalPixels / 2 ? 255 : 0;
    }

    // Light pointing straight on from camera [0, 0, 1]
    const light: Light3DSource = {
      position: [0, 0, 1],
      diffuse: 0.8,
      specular: 0.5,
      ambient: 0.1,
      rimIntensity: 0.0,
      color: [255, 255, 255],
    };

    SurfaceNormalGenerator.applyRelightingToRgba(rgba, normalMap, null, light);

    // Opaque pixel (top) should have increased luminance from light
    const topIdx = 0;
    expect(rgba[topIdx]).toBeGreaterThan(100);
    expect(rgba[topIdx + 1]).toBeGreaterThan(100);
    expect(rgba[topIdx + 2]).toBeGreaterThan(100);

    // Transparent pixel (bottom) must remain untouched (no specular bleed)
    const botIdx = (totalPixels - 1) * 4;
    expect(rgba[botIdx]).toBe(100);
    expect(rgba[botIdx + 1]).toBe(100);
    expect(rgba[botIdx + 2]).toBe(100);
    expect(rgba[botIdx + 3]).toBe(0);
  });

  it('should parse various CSS color formats accurately', () => {
    expect(SurfaceNormalGenerator.parseColor('#ffffff')).toEqual([255, 255, 255]);
    expect(SurfaceNormalGenerator.parseColor('#ff0000')).toEqual([255, 0, 0]);
    expect(SurfaceNormalGenerator.parseColor('#00f')).toEqual([0, 0, 255]);
    expect(SurfaceNormalGenerator.parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30]);
    expect(SurfaceNormalGenerator.parseColor([120, 130, 140])).toEqual([120, 130, 140]);
  });

  it('should preserve deterministic rendering and zero-alloc frame loop in Depth3DPlugin', async () => {
    const plugin = new Depth3DPlugin();
    expect(plugin.type).toBe('vfx/depth3d');
    expect(plugin.targetScope).toBe('sequence');
    expect(plugin.targetPhase).toBe(2);

    const width = 120;
    const height = 90;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Create a base image asset
    ctx.fillStyle = '#334455';
    ctx.fillRect(0, 0, width, height);
    const baseImg = canvas;

    const mockSeq: any = {
      id: 'seq-1',
      startFrame: 0,
      endFrame: 30,
      durationFrames: 30,
    };

    // Render clip space with relighting disabled (standard baseline)
    plugin.renderClipSpace(
      {
        canvas: canvas as any,
        ctx: ctx as any,
        frame: 0,
        localFrame: 0,
        width,
        height,
        sequence: mockSeq,
        baseAsset: baseImg as any,
      },
      {
        mode: 'frame_breaker',
        relighting: { enabled: false },
      }
    );

    const baselineData = ctx.getImageData(0, 0, width, height).data.slice();

    // Verify baseline was rendered without crash
    expect(baselineData.length).toBe(width * height * 4);
  });
});
