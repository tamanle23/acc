import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateSnowEffect: EffectGenerator = {
  name: 'snow',
  generate: async (config: OverlayEffectConfig, pipeline: EffectPipeline) => {
    let adapter: CanvasAdapter;
    if (config.canvasEngine === 'napi-rs') {
      adapter = new NapiRsCanvasAdapter();
    } else {
      throw new Error(`Canvas engine ${config.canvasEngine} not supported yet.`);
    }

    const canvas = adapter.createCanvas(config.width, config.height);
    const ctx = canvas.getContext('2d');
    
    const totalFrames = Math.ceil(config.fps * config.duration);
    
    // Configurable snow parameters based on variant
    let flakeCount = 1500;
    let baseSpeed = config.height * 0.2; 
    let swayAmpBase = 40;
    let swayAmpVariance = 20;
    
    switch(config.variant) {
      case 'light_snow':
        flakeCount = 500;
        baseSpeed = config.height * 0.15;
        swayAmpBase = 20;
        swayAmpVariance = 10;
        break;
      case 'flurries':
        flakeCount = 1500;
        baseSpeed = config.height * 0.25;
        swayAmpBase = 60;
        swayAmpVariance = 30;
        break;
      case 'blizzard':
        flakeCount = 4000;
        baseSpeed = config.height * 0.8;
        swayAmpBase = 150;
        swayAmpVariance = 100;
        break;
      default:
        console.warn(`Variant '${config.variant}' not recognized for snow, defaulting to light_snow`);
        flakeCount = 500; // default safe fallback
        break;
    }
    
    interface Snowflake {
      x: number;
      y: number;
      z: number;
      radius: number;
      speed: number;
      swayFrequency: number;
      swayAmplitude: number;
      swayPhase: number;
    }

    const flakes: Snowflake[] = [];
    for (let i = 0; i < flakeCount; i++) {
      const z = Math.random() * 0.8 + 0.2; // 0.2 to 1.0
      // Frequency must be an integer multiple of (1 / duration) to loop perfectly
      // e.g., if duration is 3s, frequency could be 1/3, 2/3, 3/3 cycles per second.
      const cyclesPerLoop = Math.floor(Math.random() * 3) + 1; // 1 to 3 cycles per duration
      const swayFrequency = (cyclesPerLoop * Math.PI * 2) / config.duration;

      flakes.push({
        x: Math.random() * config.width,
        y: Math.random() * config.height,
        z,
        radius: (Math.random() * 3 + 1) * z,
        speed: (baseSpeed * z) + (Math.random() * 20),
        swayFrequency,
        swayAmplitude: (Math.random() * swayAmpVariance + swayAmpBase) * z,
        swayPhase: Math.random() * Math.PI * 2,
      });
    }

    process.stdout.write(`Rendering ${totalFrames} frames for Snow (${config.variant}): `);
    
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

      for (const flake of flakes) {
        // Vertical movement (modulo for seamless wrap)
        const totalDistanceY = flake.speed * timeSec;
        const currentY = (flake.y + totalDistanceY) % config.height;
        
        // Horizontal sway (sine wave loops perfectly if frequency is synced to duration)
        const swayOffset = Math.sin(timeSec * flake.swayFrequency + flake.swayPhase) * flake.swayAmplitude;
        const currentX = ((flake.x + swayOffset) % config.width + config.width) % config.width;

        // Visual properties
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * flake.z})`;
        ctx.beginPath();
        ctx.arc(currentX, currentY, flake.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
