import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateSpeedLinesEffect: EffectGenerator = {
  name: 'speed_lines',
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
    
    // Anime speed lines are basically just lots of lines.
    // They usually flicker or change slightly every frame or every 2 frames.
    // We can just generate them dynamically per frame.

    const cx = config.width / 2;
    const cy = config.height / 2;
    const maxRadius = Math.sqrt(cx*cx + cy*cy); // Distance to corner

    process.stdout.write(`Rendering ${totalFrames} frames for Speed Lines (${config.variant}): `);
    
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(config.fps) === 0) {
        process.stdout.write('.');
      }

      ctx.clearRect(0, 0, config.width, config.height);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';

      if (config.variant === 'radial_burst') {
        const numLines = Math.floor(Math.random() * 20) + 100; // 100-120 lines
        const innerRadiusBase = Math.min(config.width, config.height) * 0.25;

        for (let i = 0; i < numLines; i++) {
          const angle = Math.random() * Math.PI * 2;
          const length = Math.random() * maxRadius * 0.5 + maxRadius * 0.5;
          const innerR = innerRadiusBase + Math.random() * 100;
          
          const startX = cx + Math.cos(angle) * innerR;
          const startY = cy + Math.sin(angle) * innerR;
          const endX = cx + Math.cos(angle) * (innerR + length);
          const endY = cy + Math.sin(angle) * (innerR + length);
          
          // Draw a very thin, sharp triangle for manga look
          const thickness = Math.random() * 4 + 1;
          const anglePerp = angle + Math.PI / 2;

          ctx.beginPath();
          // Tip points to center
          ctx.moveTo(startX, startY);
          // Base is wide on the outside
          ctx.lineTo(endX + Math.cos(anglePerp) * thickness, endY + Math.sin(anglePerp) * thickness);
          ctx.lineTo(endX - Math.cos(anglePerp) * thickness, endY - Math.sin(anglePerp) * thickness);
          ctx.fill();
        }
      } else if (config.variant === 'horizontal_rush') {
        const numLines = Math.floor(Math.random() * 30) + 60;

        for (let i = 0; i < numLines; i++) {
          const y = Math.random() * config.height;
          // Randomly appear from left or right edge, or span whole screen
          const length = Math.random() * config.width + config.width * 0.5;
          const thickness = Math.random() * 6 + 1;
          const xOffset = Math.random() > 0.5 ? 0 : config.width - length;

          ctx.fillRect(xOffset, y, length, thickness);
        }
      } else {
        console.warn(`Variant '${config.variant}' not recognized for speed_lines`);
      }

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
