import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter, CanvasInstance } from '../canvas-strategies/base';

// Simple PRNG to replace Math.random for deterministic loops if needed, 
// though for rain, standard random might be fine since we warp the positions.
export const generateRainEffect: EffectGenerator = {
  name: 'rain',
  generate: async (config: OverlayEffectConfig, pipeline: EffectPipeline) => {
    // Choose adapter based on config
    let adapter: CanvasAdapter;
    if (config.canvasEngine === 'napi-rs') {
      adapter = new NapiRsCanvasAdapter();
    } else {
      throw new Error(`Canvas engine ${config.canvasEngine} not supported yet.`);
    }

    const canvas = adapter.createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');
    
    const totalFrames = Math.ceil(config.fps * config.duration);
    
    // Configurable rain parameters based on variant
    let dropCount = 1000;
    let baseSpeed = config.height * 1.5; // Distance per second (pixels)
    let windOffsetBase = -200;
    let windOffsetVariance = -100;
    
    switch(config.variant) {
      case 'drizzle':
        dropCount = 300;
        baseSpeed = config.height * 0.8;
        windOffsetBase = -50;
        windOffsetVariance = -50;
        break;
      case 'heavy_rain':
        dropCount = 1000;
        baseSpeed = config.height * 1.5;
        windOffsetBase = -200;
        windOffsetVariance = -100;
        break;
      case 'storm':
        dropCount = 2000;
        baseSpeed = config.height * 2.5;
        windOffsetBase = -800; // Strong wind
        windOffsetVariance = -400;
        break;
      default:
        console.warn(`Variant '${config.variant}' not recognized for rain, defaulting to heavy_rain`);
        break;
    }
    
    // Initialize drops
    interface Drop {
      x: number;
      y: number;
      z: number; // For pseudo-3D parallax (closer = faster, thicker)
      length: number;
      speed: number;
      windOffset: number; // Horizontal drift per second
    }

    const drops: Drop[] = [];
    for (let i = 0; i < dropCount; i++) {
      const z = Math.random() * 0.5 + 0.5; // 0.5 to 1.0
      drops.push({
        x: Math.random() * (config.width + Math.abs(windOffsetBase) * 2), // Extra width to account for wind
        y: Math.random() * config.height,
        z,
        length: (Math.random() * 20 + 20) * z,
        speed: (baseSpeed * z) + (Math.random() * 200), // Pixel/sec
        windOffset: (Math.random() * windOffsetVariance + windOffsetBase) * z,   // Negative for leftward slant
      });
    }

    // Render loop
    process.stdout.write(`Rendering ${totalFrames} frames for Rain (${config.variant}): `);
    
    for (let frame = 0; frame < totalFrames; frame++) {
      // Progress indicator
      if (frame % Math.floor(config.fps) === 0) {
        process.stdout.write('.');
      }

      const timeSec = frame / config.fps;

      // Clear background
      if (config.bgTransparent) {
        ctx.clearRect(0, 0, config.width, config.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, config.width, config.height);
      }

      ctx.lineCap = 'round';

      // Draw drops
      for (const drop of drops) {
        // Calculate new position based on speed and time
        // We use modulo to ensure the drop wraps around seamlessly
        
        // Vertical movement
        const totalDistanceY = drop.speed * timeSec;
        const currentY = (drop.y + totalDistanceY) % config.height;
        
        // Horizontal movement (wind)
        const totalDistanceX = drop.windOffset * timeSec;
        // Since wind is negative, we need positive modulo math
        const currentX = ((drop.x + totalDistanceX) % config.width + config.width) % config.width;

        // Visual properties based on depth (z)
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * drop.z})`;
        ctx.lineWidth = 1.5 * drop.z;

        ctx.beginPath();
        ctx.moveTo(currentX, currentY);
        // Draw the tail of the drop (opposite to the falling direction)
        const tailX = currentX - (drop.windOffset / config.fps) * 0.5; // Simplified angle calc
        const tailY = currentY - drop.length;
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }

      // Extract raw buffer and push to pipeline
      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
