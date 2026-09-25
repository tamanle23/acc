import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateRainOnGlassEffect: EffectGenerator = {
  name: 'rain_on_glass',
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
    
    // We will draw water drops that are meant to be overlaid.
    // Real rain drops act as lenses, but since we are generating an overlay, 
    // we use a stylistic approach: dark edge, inner shadow, and bright white specular highlight.
    // This looks great when composited using Screen, Overlay, or Hard Light.

    interface Drop {
      x: number;
      y: number;
      r: number; // radius
      speedY: number; // 0 for static
      wobbleFreq: number;
      wobblePhase: number;
      opacityScale: number;
    }

    const drops: Drop[] = [];
    
    // Generate thousands of tiny background static drops (fog/condensation)
    const numStatic = config.variant === 'static_drops' ? 4000 : 1500;
    for (let i = 0; i < numStatic; i++) {
      drops.push({
        x: Math.random() * config.width,
        y: Math.random() * config.height,
        r: Math.random() * 2 + 0.5, // Tiny
        speedY: 0,
        wobbleFreq: 0,
        wobblePhase: 0,
        opacityScale: Math.random() * 0.5 + 0.5
      });
    }

    // Generate medium static drops
    const numMedium = config.variant === 'static_drops' ? 300 : 100;
    for (let i = 0; i < numMedium; i++) {
      drops.push({
        x: Math.random() * config.width,
        y: Math.random() * config.height,
        r: Math.random() * 6 + 2, // Medium
        speedY: 0,
        wobbleFreq: 0,
        wobblePhase: 0,
        opacityScale: 1
      });
    }

    // Generate sliding drops if variant is sliding_drops
    if (config.variant === 'sliding_drops') {
      const numSliding = 40;
      for (let i = 0; i < numSliding; i++) {
        const cycles = Math.floor(Math.random() * 3) + 1; // 1 to 3 wobbles per loop
        drops.push({
          x: Math.random() * config.width,
          y: Math.random() * config.height,
          r: Math.random() * 8 + 5, // Large
          speedY: config.height * (0.2 + Math.random() * 0.4), // Slide down
          wobbleFreq: (cycles * Math.PI * 2) / config.duration,
          wobblePhase: Math.random() * Math.PI * 2,
          opacityScale: 1
        });
      }
    }

    process.stdout.write(`Rendering ${totalFrames} frames for Rain on Glass (${config.variant}): `);
    
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(config.fps) === 0) {
        process.stdout.write('.');
      }

      const timeSec = frame / config.fps;

      if (config.bgTransparent) {
        ctx.clearRect(0, 0, config.width, config.height);
      } else {
        // We use a dark grey/black background. When composited with 'Screen', black disappears.
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, config.width, config.height);
      }

      for (const d of drops) {
        let currentX = d.x;
        // Modulo Y for seamless looping of sliding drops
        let currentY = ((d.y + d.speedY * timeSec) % config.height + config.height) % config.height;
        
        // Horizontal wobble for sliding drops (leaving a jagged path)
        if (d.speedY > 0) {
          currentX += Math.sin(timeSec * d.wobbleFreq + d.wobblePhase) * (d.r * 0.5);
        }

        // Draw the drop
        ctx.save();
        ctx.translate(currentX, currentY);

        // Deform large sliding drops to look like a tear
        if (d.speedY > 0) {
          ctx.scale(1, 1.2 + Math.sin(timeSec * d.wobbleFreq*2) * 0.2); // Pulse vertically
        }

        const opacity = d.opacityScale;

        // Base dark lens edge
        ctx.beginPath();
        ctx.arc(0, 0, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * opacity})`;
        ctx.fill();

        // Inner lighter body
        ctx.beginPath();
        ctx.arc(0, 0, d.r * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.1 * opacity})`;
        ctx.fill();

        // Specular highlight (crescent or dot)
        ctx.beginPath();
        if (d.r > 3) {
          // Crescent at the top-left
          ctx.arc(-d.r * 0.3, -d.r * 0.3, d.r * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * opacity})`;
          ctx.fill();
          
          // Secondary tiny bounce light bottom-right
          ctx.beginPath();
          ctx.arc(d.r * 0.5, d.r * 0.5, d.r * 0.15, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.4 * opacity})`;
          ctx.fill();
        } else {
          // Simple dot for tiny drops
          ctx.arc(0, 0, d.r * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * opacity})`;
          ctx.fill();
        }

        ctx.restore();
      }

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
