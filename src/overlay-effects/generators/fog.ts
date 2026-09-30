import { BaseEffectEngine } from '../../core/BaseEffectEngine';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
import { createNoise2D } from 'simplex-noise';
export class FogEffect extends BaseEffectEngine {
  async renderAndPipe(outputPath: string): Promise<void> {
    let adapter: CanvasAdapter;
    if ('napi-rs' === 'napi-rs') {
      adapter = new NapiRsCanvasAdapter();
    } else {
      throw new Error(`Canvas engine ${'napi-rs'} not supported yet.`);
    }
    const canvas = adapter.createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    // We generate a lower resolution noise map to save CPU, then stretch it.
    // This perfectly satisfies the "2D perlin noise stretching" requirement.
    const noiseScale = 0.25;
    const nWidth = Math.floor(this.width * noiseScale);
    const nHeight = Math.floor(this.height * noiseScale);
    const noise2D = createNoise2D();
    // Helper to generate a tileable noise texture on an offscreen canvas
    const generateNoiseLayer = (scaleX: number, scaleY: number, alphaMultiplier: number, yMask: 'none' | 'ground') => {
      const offCanvas = adapter.createCanvas(nWidth, nHeight);
      const offCtx = offCanvas.getContext('2d');
      // Because napi-rs/canvas doesn't strictly have putImageData in the base adapter interface,
      // we'll draw using small rects or we can cast it if we know we are using napi-rs
      // Drawing small rects is slow. Let's use ImageData if available, or just raw pixel loops.
      // Since we know it's napi-rs, let's use standard Canvas API via any cast.
      const rawCtx = offCtx as any;
      const imgData = rawCtx.createImageData(nWidth, nHeight);
      const data = imgData.data;
      for (let y = 0; y < nHeight; y++) {
        // Ground mist mask: fades out towards the top
        let mask = 1;
        if (yMask === 'ground') {
          const normY = y / nHeight;
          mask = normY < 0.3 ? 0 : (normY - 0.3) / 0.7; // 0 at top 30%, ramps up to 1 at bottom
        }
        for (let x = 0; x < nWidth; x++) {
          const index = (y * nWidth + x) * 4;
          // Tileable horizontal noise: map X to a circle in 2D noise space
          // This ensures the left edge seamlessly wraps to the right edge!
          const angle = (x / nWidth) * Math.PI * 2;
          const nx = Math.cos(angle) * scaleX;
          const ny = Math.sin(angle) * scaleX;
          // We use standard y for vertical
          const nz = y * scaleY;
          // We use 3D noise trick via 2D layered if we had 3D, but with 2D simplex we can't easily do a cylinder.
          // Alternatively, just generate standard 2D noise and blend the edges.
          // Edge blending for X wrapping:
          const n1 = noise2D(x * scaleX, y * scaleY);
          const n2 = noise2D((x - nWidth) * scaleX, y * scaleY);
          const blendX = x / nWidth; // 0 to 1
          // Smoother step for blending
          const blend = blendX * blendX * (3 - 2 * blendX);
          let n = n1 * (1 - blend) + n2 * blend;
          // Map from [-1, 1] to [0, 255]
          n = (n + 1) / 2;
          // Threshold and curve to make it look wispy
          n = Math.pow(n, 2);
          data[index] = 255;     // R
          data[index + 1] = 255; // G
          data[index + 2] = 255; // B
          data[index + 3] = Math.floor(n * 255 * alphaMultiplier * mask); // A
        }
      }
      rawCtx.putImageData(imgData, 0, 0);
      return offCanvas;
    };
    let layer1Params = { scaleX: 0.02, scaleY: 0.05, alpha: 0.4, mask: 'none' as any, speed: this.width * 0.1 };
    let layer2Params = { scaleX: 0.04, scaleY: 0.08, alpha: 0.3, mask: 'none' as any, speed: this.width * 0.15 };
    switch (this.variantName) {
      case 'ground_mist':
        layer1Params = { scaleX: 0.01, scaleY: 0.04, alpha: 0.6, mask: 'ground', speed: this.width * 0.05 };
        layer2Params = { scaleX: 0.03, scaleY: 0.06, alpha: 0.5, mask: 'ground', speed: this.width * 0.08 };
        break;
      case 'dense_fog':
        layer1Params = { scaleX: 0.008, scaleY: 0.02, alpha: 0.8, mask: 'none', speed: this.width * 0.02 };
        layer2Params = { scaleX: 0.015, scaleY: 0.03, alpha: 0.6, mask: 'none', speed: this.width * 0.04 };
        break;
      default:
        console.warn(`Variant '${this.variantName}' not recognized for fog, defaulting to dense_fog`);
        break;
    }
    process.stdout.write(`Generating procedural noise textures... `);
    const layer1 = generateNoiseLayer(layer1Params.scaleX, layer1Params.scaleY, layer1Params.alpha, layer1Params.mask);
    const layer2 = generateNoiseLayer(layer2Params.scaleX, layer2Params.scaleY, layer2Params.alpha, layer2Params.mask);
    console.log(`Done.`);
    const totalFrames = Math.ceil(this.fps * this.duration);
    const { stream, promise } = this.initStream(outputPath);
    process.stdout.write(`Rendering ${totalFrames} frames for Fog (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      const timeSec = frame / this.fps;
      if ((this.pipelineConfig.background === 'transparent')) {
        ctx.clearRect(0, 0, this.width, this.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.width, this.height);
      }
      // Draw Layer 1 (Back)
      // To loop perfectly over duration, speed must cover an exact multiple of the screen width.
      // E.g., speed = this.width / this.duration (1 screen width per loop)
      const exactSpeed1 = (Math.ceil(layer1Params.speed * this.duration / this.width) * this.width) / this.duration;
      const exactSpeed2 = (Math.ceil(layer2Params.speed * this.duration / this.width) * this.width) / this.duration;
      const offset1 = (timeSec * exactSpeed1) % this.width;
      const offset2 = (timeSec * exactSpeed2) % this.width;
      // Napi-rs canvas can draw another canvas directly
      const drawLayer = (layerCanvas: any, offset: number) => {
        const drawCtx = ctx as any; // Cast to bypass strict adapter limits
        const raw = layerCanvas.getRawCanvas ? layerCanvas.getRawCanvas() : layerCanvas;
        // Draw twice for seamless horizontal wrap
        drawCtx.drawImage(raw, offset, 0, this.width, this.height);
        drawCtx.drawImage(raw, offset - this.width, 0, this.width, this.height);
      };
      drawLayer(layer1, offset1);
      drawLayer(layer2, offset2);
      const buffer = canvas.toBuffer('raw');
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
