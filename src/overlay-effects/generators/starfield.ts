import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateStarfieldEffect: EffectGenerator = {
  name: 'starfield',
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
    
    interface Star {
      x: number; y: number; z: number; // 3D coordinates
      r: number;
      pulseFreq: number; pulsePhase: number;
    }
    
    const stars: Star[] = [];
    const numStars = config.variant === 'warp_speed' ? 1000 : 500;
    
    for (let i = 0; i < numStars; i++) {
      const pulseCycles = Math.floor(Math.random() * 3) + 1;
      stars.push({
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 2000,
        z: Math.random() * 1000 + 1, // Z from 1 to 1001
        r: Math.random() * 2 + 1,
        pulseFreq: (pulseCycles * Math.PI * 2) / config.duration,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    process.stdout.write(`Rendering ${totalFrames} frames for Starfield (${config.variant}): `);
    const fov = 300;
    
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(config.fps) === 0) process.stdout.write('.');
      const timeSec = frame / config.fps;
      
      if (config.bgTransparent) {
        ctx.clearRect(0, 0, config.width, config.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, config.width, config.height);
      }
      
      ctx.fillStyle = 'white';

      for (const s of stars) {
        let currentZ = s.z;
        
        if (config.variant === 'warp_speed') {
          // Move stars towards camera (z decreases)
          // To loop seamlessly, Z goes from 1000 down to 0, then wraps.
          // speed = 1000 units per duration
          const speedZ = 1000 / config.duration;
          currentZ = ((s.z - timeSec * speedZ) % 1000 + 1000) % 1000 + 1; 
        }

        const scale = fov / currentZ;
        const screenX = config.width / 2 + s.x * scale;
        const screenY = config.height / 2 + s.y * scale;

        // Skip if outside screen
        if (screenX >= 0 && screenX <= config.width && screenY >= 0 && screenY <= config.height) {
          let opacity = 1.0;
          if (config.variant === 'twinkling_night') {
            opacity = 0.5 + Math.sin(timeSec * s.pulseFreq + s.pulsePhase) * 0.5;
          } else {
            // Warp speed: fade in as they appear from afar (Z = 1000)
            opacity = Math.max(0, 1 - (currentZ / 1000));
          }

          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          
          if (config.variant === 'warp_speed') {
            // Draw lines for warp effect (motion blur)
            const prevZ = currentZ + (1000 / config.duration) * (1 / config.fps); // Where it was last frame
            const prevScale = fov / prevZ;
            const prevX = config.width / 2 + s.x * prevScale;
            const prevY = config.height / 2 + s.y * prevScale;
            
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = s.r * scale;
            ctx.beginPath();
            ctx.moveTo(screenX, screenY);
            ctx.lineTo(prevX, prevY);
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(screenX, screenY, s.r * scale, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      pipeline.pushFrame(canvas.toBuffer('raw'));
    }
    process.stdout.write(' Done!\n');
  }
};
