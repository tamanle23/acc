import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
import { createNoise2D } from 'simplex-noise';

export const generateFireEffect: EffectGenerator = {
  name: 'fire',
  generate: async (config: OverlayEffectConfig, pipeline: EffectPipeline) => {
    let adapter: CanvasAdapter;
    if (config.canvasEngine === 'napi-rs') {
      adapter = new NapiRsCanvasAdapter();
    } else {
      throw new Error(`Canvas engine ${config.canvasEngine} not supported yet.`);
    }

    const canvas = adapter.createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');
    
    // Lower resolution noise map to save CPU, then stretch it
    const noiseScale = 0.25; 
    const nWidth = Math.floor(config.width * noiseScale);
    const nHeight = Math.floor(config.height * noiseScale);
    
    const noise2D = createNoise2D();

    // Fractal Brownian Motion (fBm) helper
    const fbm = (x: number, y: number, scaleX: number, scaleY: number, octaves: number = 3) => {
      let total = 0;
      let amplitude = 1;
      let frequency = 1;
      let maxVal = 0;
      for (let i = 0; i < octaves; i++) {
        total += noise2D(x * scaleX * frequency, y * scaleY * frequency) * amplitude;
        maxVal += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }
      return total / maxVal; // Normalized [-1, 1]
    };

    // Precompute a fire color palette (256 colors)
    const palette = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i++) {
      const idx = i * 4;
      const t = i / 255;
      
      // Black (transparent) -> Red -> Orange -> Yellow -> White
      if (t < 0.2) {
        palette[idx] = 0; palette[idx+1] = 0; palette[idx+2] = 0; palette[idx+3] = 0;
      } else if (t < 0.4) {
        const factor = (t - 0.2) / 0.2;
        palette[idx] = Math.floor(255 * factor); palette[idx+1] = 0; palette[idx+2] = 0; palette[idx+3] = Math.floor(255 * factor);
      } else if (t < 0.7) {
        const factor = (t - 0.4) / 0.3;
        palette[idx] = 255; palette[idx+1] = Math.floor(165 * factor); palette[idx+2] = 0; palette[idx+3] = 255;
      } else if (t < 0.9) {
        const factor = (t - 0.7) / 0.2;
        palette[idx] = 255; palette[idx+1] = 165 + Math.floor(90 * factor); palette[idx+2] = 0; palette[idx+3] = 255;
      } else {
        const factor = (t - 0.9) / 0.1;
        palette[idx] = 255; palette[idx+1] = 255; palette[idx+2] = Math.floor(255 * factor); palette[idx+3] = 255;
      }
    }

    // Generate vertically tileable fBm noise for rising flames
    const generateFireLayer = (scaleX: number, scaleY: number) => {
      const offCanvas = adapter.createCanvas(nWidth, nHeight);
      const offCtx = offCanvas.getContext('2d');
      const rawCtx = offCtx as any;
      const imgData = rawCtx.createImageData(nWidth, nHeight);
      const data = imgData.data;

      for (let y = 0; y < nHeight; y++) {
        for (let x = 0; x < nWidth; x++) {
          const index = (y * nWidth + x) * 4;
          
          const n1 = fbm(x, y, scaleX, scaleY);
          const n2 = fbm(x, y - nHeight, scaleX, scaleY);
          
          // Blend top and bottom for vertical tileability
          const blendY = y / nHeight;
          const blend = blendY * blendY * (3 - 2 * blendY); // Smoothstep
          let n = n1 * (1 - blend) + n2 * blend;

          // Map from [-1, 1] to [0, 1]
          n = (n + 1) / 2;

          // Sharpen the noise to make flame licks
          n = Math.pow(n, 1.2);

          const colorIdx = Math.floor(n * 255) * 4;

          data[index] = palette[colorIdx];
          data[index + 1] = palette[colorIdx + 1];
          data[index + 2] = palette[colorIdx + 2];
          data[index + 3] = palette[colorIdx + 3];
        }
      }
      rawCtx.putImageData(imgData, 0, 0);
      return offCanvas;
    };

    let layer1Params = { scaleX: 0.015, scaleY: 0.04, speed: config.height * 0.4 };
    let layer2Params = { scaleX: 0.03, scaleY: 0.06, speed: config.height * 0.7 };
    
    // Mask logic
    let maskHeight = 0.4; // bottom 40%

    switch(config.variant) {
      case 'campfire_flames':
        layer1Params = { scaleX: 0.015, scaleY: 0.04, speed: config.height * 0.5 };
        layer2Params = { scaleX: 0.025, scaleY: 0.07, speed: config.height * 0.8 };
        maskHeight = 0.3;
        break;
      case 'wall_of_fire':
        layer1Params = { scaleX: 0.008, scaleY: 0.03, speed: config.height * 0.3 };
        layer2Params = { scaleX: 0.015, scaleY: 0.05, speed: config.height * 0.5 };
        maskHeight = 0.7; // Cover most of the screen
        break;
      default:
        console.warn(`Variant '${config.variant}' not recognized for fire, defaulting to campfire_flames`);
        break;
    }

    process.stdout.write(`Generating procedural fire textures... `);
    const layer1 = generateFireLayer(layer1Params.scaleX, layer1Params.scaleY);
    const layer2 = generateFireLayer(layer2Params.scaleX, layer2Params.scaleY);
    console.log(`Done.`);

    const totalFrames = Math.ceil(config.fps * config.duration);
    process.stdout.write(`Rendering ${totalFrames} frames for Fire (${config.variant}): `);
    
    // Create a vertical mask gradient so flames die out at the top
    const gradientMask = ctx.createLinearGradient(0, config.height * (1 - maskHeight), 0, config.height);
    gradientMask.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradientMask.addColorStop(0.3, 'rgba(0, 0, 0, 0.5)');
    gradientMask.addColorStop(1, 'rgba(0, 0, 0, 1)');

    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(config.fps) === 0) {
        process.stdout.write('.');
      }

      const timeSec = frame / config.fps;

      if (config.bgTransparent) {
        ctx.clearRect(0, 0, config.width, config.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, config.width, config.height);
      }

      const exactSpeed1 = (Math.ceil(layer1Params.speed * config.duration / config.height) * config.height) / config.duration;
      const exactSpeed2 = (Math.ceil(layer2Params.speed * config.duration / config.height) * config.height) / config.duration;

      const offset1 = (timeSec * exactSpeed1) % config.height;
      const offset2 = (timeSec * exactSpeed2) % config.height;

      const swayFreq = (Math.PI * 2) / config.duration; 
      const sway1 = Math.sin(timeSec * swayFreq) * (config.width * 0.02);
      const sway2 = Math.cos(timeSec * swayFreq * 2) * (config.width * 0.015);

      // Create a temporary canvas to draw the flames and apply the mask
      const tempCanvas = adapter.createCanvas(config.width, config.height);
      const tempCtx = tempCanvas.getContext('2d') as any;

      const drawLayer = (layerCanvas: any, offset: number, horizontalSway: number, blendMode: string) => {
        const raw = layerCanvas.getRawCanvas ? layerCanvas.getRawCanvas() : layerCanvas;
        tempCtx.globalCompositeOperation = blendMode;
        tempCtx.drawImage(raw, horizontalSway, -offset, config.width, config.height);
        tempCtx.drawImage(raw, horizontalSway, config.height - offset, config.width, config.height);
      };

      // Draw layers on temp canvas (using screen or lighter to blend fire layers)
      drawLayer(layer1, offset1, sway1, 'source-over');
      drawLayer(layer2, offset2, sway2, 'screen'); // Additive blending for fire

      // Apply the gradient mask to fade flames at the top
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.fillStyle = gradientMask;
      tempCtx.fillRect(0, 0, config.width, config.height);

      // Draw the final temp canvas onto the main canvas
      const rawTemp = (tempCanvas as any).getRawCanvas ? (tempCanvas as any).getRawCanvas() : tempCanvas;
      
      // Use standard blending
      (ctx as any).globalCompositeOperation = 'source-over';
      (ctx as any).drawImage(rawTemp, 0, 0);

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
