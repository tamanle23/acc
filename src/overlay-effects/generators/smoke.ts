import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
import { createNoise2D } from 'simplex-noise';

export const generateSmokeEffect: EffectGenerator = {
  name: 'smoke',
  generate: async (config: OverlayEffectConfig, pipeline: EffectPipeline) => {
    let adapter: CanvasAdapter;
    if (config.canvasEngine === 'napi-rs') {
      adapter = new NapiRsCanvasAdapter();
    } else {
      throw new Error(`Canvas engine ${config.canvasEngine} not supported yet.`);
    }

    const canvas = adapter.createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');
    
    // Lower resolution noise map to save CPU
    const noiseScale = 0.25; 
    const nWidth = Math.floor(config.width * noiseScale);
    const nHeight = Math.floor(config.height * noiseScale);
    
    const noise2D = createNoise2D();

    // Fractal Brownian Motion (fBm) helper for organic cloud-like noise
    const fbm = (x: number, y: number, scaleX: number, scaleY: number, octaves: number = 4) => {
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

    // Generate vertically tileable fBm noise for rising smoke
    const generateNoiseLayer = (scaleX: number, scaleY: number, alphaMultiplier: number) => {
      const offCanvas = adapter.createCanvas(nWidth, nHeight);
      const offCtx = offCanvas.getContext('2d');
      const rawCtx = offCtx as any;
      const imgData = rawCtx.createImageData(nWidth, nHeight);
      const data = imgData.data;

      for (let y = 0; y < nHeight; y++) {
        for (let x = 0; x < nWidth; x++) {
          const index = (y * nWidth + x) * 4;
          
          // Generate fBm noise
          const n1 = fbm(x, y, scaleX, scaleY);
          const n2 = fbm(x, y - nHeight, scaleX, scaleY);
          
          // Blend top and bottom for vertical tileability
          const blendY = y / nHeight;
          const blend = blendY * blendY * (3 - 2 * blendY); // Smoothstep
          let n = n1 * (1 - blend) + n2 * blend;

          // Map from [-1, 1] to [0, 1]
          n = (n + 1) / 2;
          
          // Smoothstep curve for soft cloud density
          n = n * n * (3 - 2 * n);
          // Threshold to make it wispy instead of a solid block
          n = Math.pow(n, 2.5);

          data[index] = 230;     // R (light grey/white)
          data[index + 1] = 230; // G
          data[index + 2] = 235; // B (slight cool tint)
          data[index + 3] = Math.floor(n * 255 * alphaMultiplier); // A
        }
      }
      rawCtx.putImageData(imgData, 0, 0);
      return offCanvas;
    };

    let layer1Params = { scaleX: 0.015, scaleY: 0.03, alpha: 0.4, speed: config.height * 0.2 };
    let layer2Params = { scaleX: 0.025, scaleY: 0.05, alpha: 0.3, speed: config.height * 0.3 };
    let layer3Params = { scaleX: 0.04,  scaleY: 0.08, alpha: 0.0, speed: 0 };

    switch(config.variant) {
      case 'rising_steam':
        // Fast, highly stretched vertically, lower opacity
        layer1Params = { scaleX: 0.01, scaleY: 0.05, alpha: 0.3, speed: config.height * 0.4 };
        layer2Params = { scaleX: 0.02, scaleY: 0.08, alpha: 0.2, speed: config.height * 0.6 };
        break;
      case 'rolling_smoke':
        // Thick, clumpy, 3 layers for complex fractal movement
        layer1Params = { scaleX: 0.01, scaleY: 0.02, alpha: 0.5, speed: config.height * 0.15 };
        layer2Params = { scaleX: 0.02, scaleY: 0.04, alpha: 0.4, speed: config.height * 0.25 };
        layer3Params = { scaleX: 0.03, scaleY: 0.06, alpha: 0.2, speed: config.height * 0.1 };
        break;
      default:
        console.warn(`Variant '${config.variant}' not recognized for smoke, defaulting to rising_steam`);
        break;
    }

    process.stdout.write(`Generating procedural fractal smoke textures... `);
    const layer1 = generateNoiseLayer(layer1Params.scaleX, layer1Params.scaleY, layer1Params.alpha);
    const layer2 = generateNoiseLayer(layer2Params.scaleX, layer2Params.scaleY, layer2Params.alpha);
    let layer3: CanvasInstance | null = null;
    if (layer3Params.alpha > 0) {
      layer3 = generateNoiseLayer(layer3Params.scaleX, layer3Params.scaleY, layer3Params.alpha);
    }
    console.log(`Done.`);

    const totalFrames = Math.ceil(config.fps * config.duration);
    process.stdout.write(`Rendering ${totalFrames} frames for Smoke (${config.variant}): `);
    
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

      // Draw Layers moving upwards
      // To loop perfectly, speed must cover exact multiple of height over duration
      const exactSpeed1 = (Math.ceil(layer1Params.speed * config.duration / config.height) * config.height) / config.duration;
      const exactSpeed2 = (Math.ceil(layer2Params.speed * config.duration / config.height) * config.height) / config.duration;
      const exactSpeed3 = layer3Params.alpha > 0 ? (Math.ceil(layer3Params.speed * config.duration / config.height) * config.height) / config.duration : 0;

      const offset1 = (timeSec * exactSpeed1) % config.height;
      const offset2 = (timeSec * exactSpeed2) % config.height;
      const offset3 = layer3Params.alpha > 0 ? (timeSec * exactSpeed3) % config.height : 0;

      // Napi-rs canvas trick
      const drawLayer = (layerCanvas: any, offset: number, horizontalSway: number) => {
        const drawCtx = ctx as any;
        const raw = layerCanvas.getRawCanvas ? layerCanvas.getRawCanvas() : layerCanvas;
        
        drawCtx.save();
        drawCtx.filter = 'blur(10px)'; // Add blur for extra volumetric softness
        
        // Draw twice for seamless vertical wrap (smoke goes UP, so we offset negatively)
        drawCtx.drawImage(raw, horizontalSway, -offset, config.width, config.height);
        drawCtx.drawImage(raw, horizontalSway, config.height - offset, config.width, config.height);
        
        drawCtx.restore();
      };

      // Add a slight horizontal sine sway for more organic "rolling" look
      // Must complete integer cycles over duration
      const swayFreq = (Math.PI * 2) / config.duration; 
      const sway1 = Math.sin(timeSec * swayFreq) * (config.width * 0.05);
      const sway2 = Math.cos(timeSec * swayFreq * 2) * (config.width * 0.03);

      drawLayer(layer1, offset1, sway1);
      drawLayer(layer2, offset2, sway2);
      
      if (layer3) {
        const sway3 = Math.sin(timeSec * swayFreq * 3) * (config.width * 0.02);
        drawLayer(layer3, offset3, sway3);
      }

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
