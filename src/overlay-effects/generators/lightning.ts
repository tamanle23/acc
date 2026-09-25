import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateLightningEffect: EffectGenerator = {
  name: 'lightning',
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
    
    // We pre-calculate lightning strike events so they are deterministic per loop.
    // Let's have 2-3 strikes per loop.
    const strikes: { frameStart: number; type: 'main' | 'secondary'; x?: number }[] = [];
    
    const addStrike = (progressPct: number, type: 'main' | 'secondary') => {
      const frameStart = Math.floor(progressPct * totalFrames);
      strikes.push({ 
        frameStart, 
        type, 
        x: config.width * (0.2 + Math.random() * 0.6) // Random X near center
      });
    };

    // Add some strikes at specific points in the loop
    addStrike(0.15, 'main');
    addStrike(0.18, 'secondary'); // quick follow-up flash
    addStrike(0.65, 'main');
    
    // Helper to generate a fractal branching bolt
    const generateBolt = (startX: number, startY: number, endY: number, branches: number) => {
      const points = [{x: startX, y: startY}];
      let currentX = startX;
      let currentY = startY;
      const segmentHeight = config.height * 0.05;
      
      while (currentY < endY) {
        currentY += segmentHeight * (0.5 + Math.random());
        // Random horizontal walk
        currentX += (Math.random() - 0.5) * config.width * 0.15;
        points.push({x: currentX, y: currentY});
      }
      return points;
    };

    // Pre-generate the bolts so they stay consistent for the 1-3 frames they are visible
    const preGeneratedBolts = new Map();
    if (config.variant === 'branching_lightning') {
      strikes.forEach((strike, index) => {
        preGeneratedBolts.set(index, generateBolt(strike.x || config.width / 2, 0, config.height, 3));
      });
    }

    process.stdout.write(`Rendering ${totalFrames} frames for Lightning (${config.variant}): `);
    
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(config.fps) === 0) {
        process.stdout.write('.');
      }

      if (config.bgTransparent) {
        ctx.clearRect(0, 0, config.width, config.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, config.width, config.height);
      }

      // Check if any strike is active in this frame
      for (let i = 0; i < strikes.length; i++) {
        const strike = strikes[i];
        const age = frame - strike.frameStart;
        
        // A lightning strike lasts about 4 frames (flashing)
        // age 0: 100%, age 1: 30%, age 2: 80%, age 3: 0%
        let intensity = 0;
        if (age === 0) intensity = 1.0;
        else if (age === 1) intensity = 0.3;
        else if (age === 2) intensity = 0.8;
        else if (age === 3) intensity = 0.1;

        if (intensity > 0) {
          if (config.variant === 'sheet_lightning') {
            // Sheet lightning: huge flashes illuminating the sky
            const radial = ctx.createRadialGradient(strike.x || config.width/2, 0, 0, config.width/2, config.height*0.2, config.height);
            
            // Core white, edge purple/blue
            radial.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
            radial.addColorStop(0.3, `rgba(200, 200, 255, ${intensity * 0.6})`);
            radial.addColorStop(1, `rgba(100, 50, 150, 0)`);
            
            ctx.fillStyle = radial;
            ctx.fillRect(0, 0, config.width, config.height);
            
            // Add global flash
            ctx.fillStyle = `rgba(200, 200, 255, ${intensity * 0.2})`;
            ctx.fillRect(0, 0, config.width, config.height);
            
          } else if (config.variant === 'branching_lightning') {
            // Draw the bolt
            const bolt = preGeneratedBolts.get(i);
            
            ctx.lineCap = 'round';
            ctx.lineJoin = 'miter';
            
            const drawPath = (thickness: number, color: string) => {
              ctx.beginPath();
              ctx.moveTo(bolt[0].x, bolt[0].y);
              for (let j = 1; j < bolt.length; j++) {
                ctx.lineTo(bolt[j].x, bolt[j].y);
              }
              ctx.strokeStyle = color;
              ctx.lineWidth = thickness;
              ctx.stroke();
            };

            // Outer Glow (Purple/Blue)
            // Using napi-rs we could use shadowBlur, but drawing multiple times is faster and more reliable
            drawPath(15, `rgba(150, 100, 255, ${intensity * 0.4})`);
            drawPath(30, `rgba(100, 50, 255, ${intensity * 0.2})`);
            
            // Inner Core (White)
            drawPath(5, `rgba(255, 255, 255, ${intensity})`);
            
            // Screen flash matching the bolt intensity
            ctx.fillStyle = `rgba(200, 200, 255, ${intensity * 0.15})`;
            ctx.fillRect(0, 0, config.width, config.height);
          }
        }
      }

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
