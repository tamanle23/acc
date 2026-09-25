import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateBubblesEffect: EffectGenerator = {
  name: 'bubbles',
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
    
    let bubbleCount = 50;
    let baseSpeedY = -config.height * 0.2; // Move up
    let sizeMultiplier = 1;

    switch(config.variant) {
      case 'underwater_bubbles':
        bubbleCount = 200;
        baseSpeedY = -config.height * 0.4;
        sizeMultiplier = 0.5;
        break;
      case 'floating_bubbles':
        bubbleCount = 40;
        baseSpeedY = -config.height * 0.15;
        sizeMultiplier = 1.5;
        break;
      default:
        console.warn(`Variant '${config.variant}' not recognized for bubbles, defaulting to floating_bubbles`);
        break;
    }
    
    interface Bubble {
      x: number;
      y: number;
      radius: number;
      speedX: number;
      speedY: number;
      swayFreq: number;
      swayPhase: number;
      scaleFreq: number;
      scalePhase: number;
    }

    const bubbles: Bubble[] = [];

    for (let i = 0; i < bubbleCount; i++) {
      const z = Math.random() * 0.8 + 0.2;
      
      // Sway and scale must complete full integer cycles to loop seamlessly
      const swayCycles = Math.floor(Math.random() * 3) + 1;
      const swayFreq = (swayCycles * Math.PI * 2) / config.duration;
      
      const scaleCycles = Math.floor(Math.random() * 2) + 1;
      const scaleFreq = (scaleCycles * Math.PI * 2) / config.duration;

      bubbles.push({
        x: Math.random() * config.width,
        y: Math.random() * config.height,
        radius: (Math.random() * 20 + 5) * z * sizeMultiplier,
        speedX: (Math.random() - 0.5) * config.width * 0.05,
        speedY: baseSpeedY * z,
        swayFreq,
        swayPhase: Math.random() * Math.PI * 2,
        scaleFreq,
        scalePhase: Math.random() * Math.PI * 2,
      });
    }

    process.stdout.write(`Rendering ${totalFrames} frames for Bubbles (${config.variant}): `);
    
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(config.fps) === 0) {
        process.stdout.write('.');
      }

      const timeSec = frame / config.fps;

      // Bubbles strictly require transparent backgrounds for proper overlay
      ctx.clearRect(0, 0, config.width, config.height);

      for (const b of bubbles) {
        // Continuous movement with seamless wrapping
        const currentX = ((b.x + b.speedX * timeSec) % config.width + config.width) % config.width;
        const currentY = ((b.y + b.speedY * timeSec) % config.height + config.height) % config.height;
        
        // Sway calculation
        const sway = Math.sin(timeSec * b.swayFreq + b.swayPhase) * (config.width * 0.02);
        
        // Scale calculation: Sine wave from 0.7 to 1.3
        const scale = 1.0 + Math.sin(timeSec * b.scaleFreq + b.scalePhase) * 0.3;
        
        const finalX = currentX + sway;
        const finalRadius = b.radius * scale;

        ctx.save();
        ctx.translate(finalX, currentY);

        // Draw bubble body (sharp edges)
        ctx.beginPath();
        ctx.arc(0, 0, finalRadius, 0, Math.PI * 2);
        // Slightly blue/white transparent fill
        ctx.fillStyle = 'rgba(200, 230, 255, 0.2)';
        ctx.fill();
        
        // Solid thin white border
        ctx.lineWidth = finalRadius > 10 ? 2 : 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.stroke();
        
        // Crescent highlight
        ctx.beginPath();
        ctx.arc(0, 0, finalRadius * 0.7, Math.PI * 1.1, Math.PI * 1.6);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = finalRadius > 10 ? 3 : 1.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.restore();
      }

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
