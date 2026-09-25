import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateDigitalGlitchEffect: EffectGenerator = {
  name: 'digital_glitch',
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

    // Glitches are random discontinuous events. We can pre-generate them.
    interface GlitchBlock {
      x: number; y: number; w: number; h: number; color: string; frame: number;
    }
    const blocks: GlitchBlock[] = [];
    
    if (config.variant === 'block_datamosh') {
      // Large moshing blocks
      const colors = ['rgba(255,0,255,0.8)', 'rgba(0,255,255,0.8)', 'rgba(255,255,0,0.8)'];
      for (let i = 0; i < totalFrames; i++) {
        // Glitch only 15% of the time
        if (Math.random() < 0.15) {
          const numBlocks = Math.floor(Math.random() * 10) + 5;
          for (let j = 0; j < numBlocks; j++) {
            blocks.push({
              x: Math.random() * config.width,
              y: Math.random() * config.height,
              w: Math.random() * 300 + 50,
              h: Math.random() * 100 + 20,
              color: colors[Math.floor(Math.random() * colors.length)],
              frame: i
            });
          }
        }
      }
    } else {
      // rgb_shake
      for (let i = 0; i < totalFrames; i++) {
        // Glitch 10% of the time
        if (Math.random() < 0.10) {
          blocks.push({
            x: (Math.random() - 0.5) * 50,
            y: (Math.random() - 0.5) * 50,
            w: 0, h: 0, color: 'shake', frame: i
          });
        }
      }
    }

    process.stdout.write(`Rendering ${totalFrames} frames for Digital Glitch (${config.variant}): `);
    
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(config.fps) === 0) process.stdout.write('.');

      if (config.bgTransparent) {
        ctx.clearRect(0, 0, config.width, config.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, config.width, config.height);
      }

      ctx.globalCompositeOperation = 'screen';

      if (config.variant === 'block_datamosh') {
        const currentBlocks = blocks.filter(b => b.frame === frame);
        for (const b of currentBlocks) {
          ctx.fillStyle = b.color;
          ctx.fillRect(b.x, b.y, b.w, b.h);
        }
      } else {
        // rgb_shake
        const shake = blocks.find(b => b.frame === frame);
        if (shake) {
          // Draw aggressive full-screen RGB separation overlays
          ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
          ctx.fillRect(shake.x, shake.y, config.width, config.height);
          ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
          ctx.fillRect(-shake.x, -shake.y, config.width, config.height);
          
          // Draw some horizontal slice displacement bars
          for (let i = 0; i < 5; i++) {
            const sy = Math.random() * config.height;
            const sh = Math.random() * 100 + 10;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fillRect(0, sy, config.width, sh);
          }
        }
      }

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    process.stdout.write(' Done!\n');
  }
};
