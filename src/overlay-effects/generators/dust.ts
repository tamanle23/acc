import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateDustEffect: EffectGenerator = {
  name: 'dust',
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
    
    let particleCount = 1000;
    let baseSpeedY = config.height * 0.05; // Very slow moving down
    let baseSpeedX = config.width * 0.02;  // Very slow moving right
    let sizeMultiplier = 1;
    let baseOpacity = 0.5;

    switch(config.variant) {
      case 'ambient_dust':
        particleCount = 1000;
        baseSpeedY = config.height * 0.03;
        baseSpeedX = config.width * 0.03;
        sizeMultiplier = 1.0;
        baseOpacity = 0.6;
        break;
      case 'sunshaft_dust':
        particleCount = 2000;
        baseSpeedY = config.height * 0.1;
        baseSpeedX = config.width * 0.1; // Diagonal drift matching a light beam
        sizeMultiplier = 1.2;
        baseOpacity = 0.8;
        break;
      default:
        console.warn(`Variant '${config.variant}' not recognized for dust, defaulting to ambient_dust`);
        break;
    }
    
    interface DustParticle {
      x: number;
      y: number;
      z: number;
      radius: number;
      speedX: number;
      speedY: number;
      pulseFrequency: number;
      pulsePhase: number;
    }

    const particles: DustParticle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const z = Math.random() * 0.8 + 0.2; // 0.2 to 1.0
      
      // Frequency must be an integer multiple of (1 / duration) to loop perfectly
      const cyclesPerLoop = Math.floor(Math.random() * 2) + 1; // 1 or 2 cycles
      const pulseFrequency = (cyclesPerLoop * Math.PI * 2) / config.duration;

      // Add variance to speed
      const speedX = (baseSpeedX * z) + ((Math.random() - 0.5) * config.width * 0.02);
      const speedY = (baseSpeedY * z) + ((Math.random() - 0.5) * config.height * 0.02);

      particles.push({
        x: Math.random() * config.width,
        y: Math.random() * config.height,
        z,
        radius: (Math.random() * 2 + 0.5) * z * sizeMultiplier,
        speedX,
        speedY,
        pulseFrequency,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    process.stdout.write(`Rendering ${totalFrames} frames for Dust (${config.variant}): `);
    
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

      // Draw dust
      for (const p of particles) {
        // Continuous movement with seamless wrapping
        const currentX = ((p.x + p.speedX * timeSec) % config.width + config.width) % config.width;
        const currentY = ((p.y + p.speedY * timeSec) % config.height + config.height) % config.height;
        
        // Pulsing opacity for fade in/out (sine wave normalized to 0-1)
        const pulse = (Math.sin(timeSec * p.pulseFrequency + p.pulsePhase) + 1) / 2; 
        // pulse is 0.0 to 1.0
        
        // Some particles twinkle fully, some just slightly dim
        const opacity = baseOpacity * p.z * (0.3 + 0.7 * pulse);

        ctx.fillStyle = `rgba(255, 235, 200, ${opacity})`; // Slightly warm/golden dust
        ctx.beginPath();
        ctx.arc(currentX, currentY, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
