import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
import { createNoise2D } from 'simplex-noise';

export const generateAudioSpectrumEffect: EffectGenerator = {
  name: 'audio_spectrum',
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
    
    const noise2D = createNoise2D();

    // To make 1D noise loop perfectly over time, we map time [0, 1] to a circle in 2D noise space
    const getLoopingNoise = (x: number, tNorm: number, radius: number = 1.0) => {
      const nx = Math.cos(tNorm * Math.PI * 2) * radius;
      const ny = Math.sin(tNorm * Math.PI * 2) * radius;
      // We also offset by 'x' so different bars have different values
      return noise2D(nx + x * 0.1, ny);
    };

    const numBars = config.variant === 'circular_eq' ? 60 : Math.floor(config.width / 30);
    const maxBarHeight = config.height * 0.3;

    process.stdout.write(`Rendering ${totalFrames} frames for Audio Spectrum (${config.variant}): `);
    
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(config.fps) === 0) {
        process.stdout.write('.');
      }

      const tNorm = frame / totalFrames; 

      ctx.clearRect(0, 0, config.width, config.height);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      
      if (config.variant === 'classic_bars') {
        // Horizontal row of bars at the bottom
        const barWidth = config.width / numBars;
        const padding = barWidth * 0.2;
        
        for (let i = 0; i < numBars; i++) {
          // Add multiple frequencies of noise to simulate real audio EQ (bass, mid, treble)
          let n = (getLoopingNoise(i, tNorm, 1.0) + 1) / 2; // [0, 1]
          n = Math.pow(n, 1.5); // Make it more punchy
          
          const h = n * maxBarHeight + 5; // Min height 5
          const x = i * barWidth + padding / 2;
          const y = config.height - h;
          
          // Draw rounded bar
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth - padding, h, 5);
          ctx.fill();
        }
      } else if (config.variant === 'circular_eq') {
        // Circle of bars in the center
        const cx = config.width / 2;
        const cy = config.height / 2;
        const baseRadius = 150;
        const barWidth = 8;
        
        // Slowly rotate the whole EQ
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(tNorm * Math.PI * 2);

        // Draw center circle
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius - 10, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < numBars; i++) {
          const angle = (i / numBars) * Math.PI * 2;
          
          let n = (getLoopingNoise(i, tNorm, 1.5) + 1) / 2;
          n = Math.pow(n, 1.5);
          
          const h = n * maxBarHeight + 5;
          
          ctx.save();
          ctx.rotate(angle);
          
          // Draw bar jutting out from baseRadius
          ctx.beginPath();
          ctx.roundRect(-barWidth/2, baseRadius, barWidth, h, barWidth/2);
          ctx.fill();
          
          ctx.restore();
        }

        ctx.restore();
      }

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
