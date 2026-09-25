import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateMatrixRainEffect: EffectGenerator = {
  name: 'matrix_rain',
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
    
    const fontSize = 20;
    const columns = Math.floor(config.width / fontSize);
    
    interface Column {
      x: number;
      speed: number;
      length: number;
      chars: string[];
    }
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*'.split('');
    const cols: Column[] = [];
    
    for (let i = 0; i < columns; i++) {
      const length = Math.floor(Math.random() * 20) + 10;
      const colChars = [];
      for (let j = 0; j < length; j++) colChars.push(chars[Math.floor(Math.random() * chars.length)]);
      
      cols.push({
        x: i * fontSize,
        speed: (Math.random() * 0.5 + 0.5) * config.height * 0.5, // Pixels per second
        length,
        chars: colChars
      });
    }

    process.stdout.write(`Rendering ${totalFrames} frames for Matrix Rain (${config.variant}): `);
    
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(config.fps) === 0) process.stdout.write('.');

      const timeSec = frame / config.fps;

      if (config.bgTransparent) {
        ctx.clearRect(0, 0, config.width, config.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, config.width, config.height);
      }

      ctx.font = `${fontSize}px monospace`;
      
      const headColor = config.variant === 'red_alert' ? 'rgba(255, 200, 200, 1)' : 'rgba(200, 255, 200, 1)';
      const tailColorRGB = config.variant === 'red_alert' ? '255, 0, 0' : '0, 255, 0';

      for (const col of cols) {
        // Ensure seamless looping
        const exactSpeed = (Math.ceil(col.speed * config.duration / config.height) * config.height) / config.duration;
        const headY = (timeSec * exactSpeed) % config.height;
        
        for (let i = 0; i < col.length; i++) {
          let y = headY - i * fontSize;
          // Wrap around top if needed
          if (y < 0) y += config.height;
          
          const opacity = 1 - (i / col.length);
          
          if (i === 0) {
            ctx.fillStyle = headColor; // Bright head
          } else {
            ctx.fillStyle = `rgba(${tailColorRGB}, ${opacity})`;
          }
          
          // Matrix characters change occasionally, but we can just use static arrays for performance
          ctx.fillText(col.chars[i], col.x, y);
        }
      }

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    process.stdout.write(' Done!\n');
  }
};
