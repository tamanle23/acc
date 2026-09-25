import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateGodRaysEffect: EffectGenerator = {
  name: 'god_rays',
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

    // God rays are basically polygons radiating from a light source (often top center),
    // moving back and forth (swaying) and fading in and out (pulsing).
    
    interface Ray {
      angleOffset: number; // Offset from straight down
      widthAngle: number;  // How wide the ray is
      intensity: number;
      swayFreq: number;
      swayPhase: number;
      pulseFreq: number;
      pulsePhase: number;
    }

    const rays: Ray[] = [];
    const numRays = config.variant === 'underwater_shafts' ? 15 : 8;
    
    for (let i = 0; i < numRays; i++) {
      const swayCycles = Math.floor(Math.random() * 2) + 1; // 1 to 2 cycles
      const pulseCycles = Math.floor(Math.random() * 3) + 1;

      rays.push({
        angleOffset: (Math.random() - 0.5) * Math.PI * 0.8, // -72 to +72 degrees
        widthAngle: Math.random() * 0.15 + 0.05,
        intensity: Math.random() * 0.4 + 0.2, // 0.2 to 0.6
        swayFreq: (swayCycles * Math.PI * 2) / config.duration,
        swayPhase: Math.random() * Math.PI * 2,
        pulseFreq: (pulseCycles * Math.PI * 2) / config.duration,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    process.stdout.write(`Rendering ${totalFrames} frames for God Rays (${config.variant}): `);
    
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

      // Light source origin
      const originX = config.width / 2;
      const originY = -config.height * 0.1; // Slightly above the top edge
      const rayLength = config.height * 1.5;

      ctx.globalCompositeOperation = 'screen';

      for (const r of rays) {
        const sway = Math.sin(timeSec * r.swayFreq + r.swayPhase) * 0.2; // Sway angle
        const pulse = 1.0 + Math.sin(timeSec * r.pulseFreq + r.pulsePhase) * 0.5; // 0.5x to 1.5x
        
        const centerAngle = Math.PI / 2 + r.angleOffset + sway; // PI/2 is straight down
        
        const angle1 = centerAngle - r.widthAngle / 2;
        const angle2 = centerAngle + r.widthAngle / 2;
        
        const x1 = originX + Math.cos(angle1) * rayLength;
        const y1 = originY + Math.sin(angle1) * rayLength;
        const x2 = originX + Math.cos(angle2) * rayLength;
        const y2 = originY + Math.sin(angle2) * rayLength;

        // Radial gradient for the ray to fade out at the bottom
        // Unfortunately, canvas radial gradients from a point outward can be tricky for slices.
        // A simple linear gradient from origin to center of the bottom works perfectly.
        const endX = originX + Math.cos(centerAngle) * rayLength;
        const endY = originY + Math.sin(centerAngle) * rayLength;

        const grad = ctx.createLinearGradient(originX, originY, endX, endY);
        
        let colorStr = '255, 255, 230'; // Heavenly gold/white
        if (config.variant === 'underwater_shafts') {
          colorStr = '180, 240, 255'; // Cyan/Blue
        }

        const opacity = Math.min(1, r.intensity * pulse);
        
        grad.addColorStop(0, `rgba(${colorStr}, ${opacity})`);
        grad.addColorStop(1, `rgba(${colorStr}, 0)`);

        ctx.fillStyle = grad;
        
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.fill();
      }

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
