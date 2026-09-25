import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateFloatingHeartsEffect: EffectGenerator = {
  name: 'floating_hearts',
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
    
    interface Heart {
      x: number; y: number; s: number; color: string;
      speedY: number; swayFreq: number; swayPhase: number;
    }
    
    const particles: Heart[] = [];
    const numHearts = config.variant === 'burst_hearts' ? 150 : 50;
    const colors = ['255, 100, 150', '255, 50, 100', '255, 150, 180'];
      
    for (let i = 0; i < numHearts; i++) {
      const swayCycles = Math.floor(Math.random() * 2) + 1;
      particles.push({
        x: Math.random() * config.width,
        y: Math.random() * config.height,
        s: Math.random() * 1.5 + 0.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedY: -config.height * (Math.random() * 0.2 + 0.1), // Floating up
        swayFreq: (swayCycles * Math.PI * 2) / config.duration,
        swayPhase: Math.random() * Math.PI * 2,
      });
    }

    const drawHeart = (ctx: any, x: number, y: number, size: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size, size);
      ctx.beginPath();
      // Bezier heart
      ctx.moveTo(0, 5);
      ctx.bezierCurveTo(0, -10, -20, -10, -20, 5);
      ctx.bezierCurveTo(-20, 20, 0, 30, 0, 40);
      ctx.bezierCurveTo(0, 30, 20, 20, 20, 5);
      ctx.bezierCurveTo(20, -10, 0, -10, 0, 5);
      ctx.fill();
      ctx.restore();
    };

    process.stdout.write(`Rendering ${totalFrames} frames for Floating Hearts (${config.variant}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(config.fps) === 0) process.stdout.write('.');
      const timeSec = frame / config.fps;
      ctx.clearRect(0, 0, config.width, config.height);

      for (const p of particles) {
        const cx = ((p.x + Math.sin(timeSec * p.swayFreq + p.swayPhase)*50) % config.width + config.width) % config.width;
        const cy = ((p.y + p.speedY * timeSec) % config.height + config.height) % config.height;
        
        ctx.fillStyle = `rgba(${p.color}, 0.8)`;
        drawHeart(ctx, cx, cy, p.s);
      }
      pipeline.pushFrame(canvas.toBuffer('raw'));
    }
    process.stdout.write(' Done!\n');
  }
};
