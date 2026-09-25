import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateEmbersEffect: EffectGenerator = {
  name: 'embers',
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
    
    let sparkCount = 800;
    let baseSpeedY = -config.height * 0.4; // Moving up
    let baseSpeedX = config.width * 0.05;  // Slight drift
    let windVariance = config.width * 0.02;

    switch(config.variant) {
      case 'campfire_sparks':
        sparkCount = 600;
        baseSpeedY = -config.height * 0.3;
        baseSpeedX = config.width * 0.02;
        windVariance = config.width * 0.05;
        break;
      case 'windy_sparks':
        sparkCount = 1200;
        baseSpeedY = -config.height * 0.6;
        baseSpeedX = config.width * 0.5; // Strong horizontal wind
        windVariance = config.width * 0.2;
        break;
      default:
        console.warn(`Variant '${config.variant}' not recognized for embers, defaulting to campfire_sparks`);
        break;
    }
    
    interface Spark {
      x: number;
      y: number;
      z: number;
      radius: number;
      speedX: number;
      speedY: number;
      flickerFreq: number;
      flickerPhase: number;
      color: string;
    }

    const sparks: Spark[] = [];
    const colors = ['255, 100, 20', '255, 150, 30', '255, 200, 50', '255, 50, 10']; // Reds, Oranges, Yellows

    for (let i = 0; i < sparkCount; i++) {
      const z = Math.random() * 0.8 + 0.2;
      
      // Flickering must loop seamlessly
      const cyclesPerLoop = Math.floor(Math.random() * 5) + 2; // 2 to 6 fast flickers per loop
      const flickerFreq = (cyclesPerLoop * Math.PI * 2) / config.duration;

      const speedX = (baseSpeedX * z) + ((Math.random() - 0.5) * windVariance);
      const speedY = (baseSpeedY * z) + ((Math.random() - 0.5) * config.height * 0.1);

      sparks.push({
        x: Math.random() * config.width,
        y: Math.random() * config.height,
        z,
        radius: (Math.random() * 3 + 1) * z,
        speedX,
        speedY,
        flickerFreq,
        flickerPhase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    process.stdout.write(`Rendering ${totalFrames} frames for Embers (${config.variant}): `);
    
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

      for (const s of sparks) {
        // Continuous movement with seamless wrapping (modulo)
        // Since Y speed is negative (moving up), we need to ensure positive modulo
        const currentX = ((s.x + s.speedX * timeSec) % config.width + config.width) % config.width;
        const currentY = ((s.y + s.speedY * timeSec) % config.height + config.height) % config.height;
        
        // Flickering opacity
        const flicker = (Math.sin(timeSec * s.flickerFreq + s.flickerPhase) + 1) / 2; 
        const opacity = 0.3 + 0.7 * flicker;

        ctx.fillStyle = `rgba(${s.color}, ${opacity})`;
        ctx.beginPath();
        ctx.arc(currentX, currentY, s.radius, 0, Math.PI * 2);
        ctx.fill();

        // Add a slight glow effect for bigger sparks
        if (s.z > 0.6) {
          ctx.fillStyle = `rgba(${s.color}, ${opacity * 0.3})`;
          ctx.beginPath();
          ctx.arc(currentX, currentY, s.radius * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
