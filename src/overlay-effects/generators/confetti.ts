import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateConfettiEffect: EffectGenerator = {
  name: 'confetti',
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
    
    interface Confetti {
      x: number; y: number; w: number; h: number;
      color: string;
      speedY: number; speedX: number;
      rotFreqX: number; rotPhaseX: number;
      rotFreqZ: number; rotPhaseZ: number;
    }
    
    const particles: Confetti[] = [];
    const colors = config.variant === 'golden_shower' 
      ? ['255,215,0', '218,165,32', '255,223,0'] 
      : ['255,0,0', '0,255,0', '0,0,255', '255,255,0', '255,0,255', '0,255,255'];
      
    for (let i = 0; i < 200; i++) {
      const rotCyclesX = Math.floor(Math.random() * 5) + 2;
      const rotCyclesZ = Math.floor(Math.random() * 3) + 1;
      
      particles.push({
        x: Math.random() * config.width,
        y: Math.random() * config.height,
        w: Math.random() * 10 + 5,
        h: Math.random() * 20 + 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedY: config.height * (Math.random() * 0.3 + 0.2), // Falling down
        speedX: config.width * (Math.random() - 0.5) * 0.1,
        rotFreqX: (rotCyclesX * Math.PI * 2) / config.duration,
        rotPhaseX: Math.random() * Math.PI * 2,
        rotFreqZ: (rotCyclesZ * Math.PI * 2) / config.duration,
        rotPhaseZ: Math.random() * Math.PI * 2,
      });
    }

    process.stdout.write(`Rendering ${totalFrames} frames for Confetti (${config.variant}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(config.fps) === 0) process.stdout.write('.');
      const timeSec = frame / config.fps;
      ctx.clearRect(0, 0, config.width, config.height);

      for (const p of particles) {
        const cx = ((p.x + p.speedX * timeSec) % config.width + config.width) % config.width;
        const cy = ((p.y + p.speedY * timeSec) % config.height + config.height) % config.height;
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(timeSec * p.rotFreqZ + p.rotPhaseZ);
        ctx.scale(Math.cos(timeSec * p.rotFreqX + p.rotPhaseX), 1);
        
        ctx.fillStyle = `rgb(${p.color})`;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      }
      pipeline.pushFrame(canvas.toBuffer('raw'));
    }
    process.stdout.write(' Done!\n');
  }
};
