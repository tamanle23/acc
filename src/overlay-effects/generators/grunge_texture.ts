import { EffectGenerator, OverlayEffectConfig } from '../types';
import { EffectPipeline } from '../pipeline';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';

export const generateGrungeTextureEffect: EffectGenerator = {
  name: 'grunge_texture',
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
    
    // Stop motion means we don't update the texture every frame, but every N frames (e.g., 4 frames = 7.5fps)
    const holdFrames = 4;
    
    // We will generate a few unique textures and loop through them randomly or sequentially
    // to keep the file size low and the loop seamless. Since it's stop motion, 
    // a sequence of 6 distinct textures played repeatedly works perfectly.
    const numTextures = Math.ceil(totalFrames / holdFrames);
    const textures: any[] = [];

    process.stdout.write(`Generating ${numTextures} stop-motion textures... `);

    for (let i = 0; i < numTextures; i++) {
      const texCanvas = adapter.createCanvas(config.width, config.height);
      const texCtx = texCanvas.getContext('2d') as any;

      if (config.bgTransparent) {
        texCtx.clearRect(0, 0, config.width, config.height);
      } else {
        texCtx.fillStyle = '#000000';
        texCtx.fillRect(0, 0, config.width, config.height);
      }

      if (config.variant === 'stop_motion_paper') {
        // Draw crumpled paper lines, scratches, and dust
        
        // Base wash
        texCtx.fillStyle = `rgba(255, 240, 220, 0.1)`; // Warm paper tone
        texCtx.fillRect(0, 0, config.width, config.height);

        // Random thick scuffs
        const numScuffs = Math.floor(Math.random() * 20) + 10;
        texCtx.fillStyle = `rgba(255, 255, 255, 0.4)`;
        for (let s = 0; s < numScuffs; s++) {
          texCtx.beginPath();
          const x = Math.random() * config.width;
          const y = Math.random() * config.height;
          texCtx.arc(x, y, Math.random() * 50 + 10, 0, Math.PI * 2);
          texCtx.fill();
        }

        // Random thin scratches
        const numScratches = Math.floor(Math.random() * 100) + 50;
        texCtx.strokeStyle = `rgba(255, 255, 255, 0.6)`;
        for (let s = 0; s < numScratches; s++) {
          texCtx.beginPath();
          const x = Math.random() * config.width;
          const y = Math.random() * config.height;
          texCtx.moveTo(x, y);
          texCtx.lineTo(x + (Math.random() - 0.5) * 100, y + (Math.random() - 0.5) * 100);
          texCtx.lineWidth = Math.random() * 2 + 0.5;
          texCtx.stroke();
        }
        
      } else if (config.variant === 'flickering_halftone') {
        // Halftone dots (comic style)
        // We draw a grid of circles. To make it flicker, we randomly shift the grid or change dot sizes.
        const gridSize = 15;
        const offsetX = Math.random() * gridSize;
        const offsetY = Math.random() * gridSize;
        const dotBase = Math.random() * 3 + 2;
        
        texCtx.fillStyle = `rgba(255, 255, 255, 0.5)`;
        for (let y = 0; y < config.height; y += gridSize) {
          for (let x = 0; x < config.width; x += gridSize) {
            // Add some noise to the dot size to create texture
            const noise = (Math.random() - 0.5) * 2;
            const r = Math.max(0.5, dotBase + noise);
            
            texCtx.beginPath();
            texCtx.arc(x + offsetX, y + offsetY, r, 0, Math.PI * 2);
            texCtx.fill();
          }
        }
      } else {
        console.warn(`Variant '${config.variant}' not recognized for grunge_texture`);
      }

      textures.push((texCanvas as any).getRawCanvas ? (texCanvas as any).getRawCanvas() : texCanvas);
    }
    console.log(`Done.`);

    process.stdout.write(`Rendering ${totalFrames} frames for Grunge Texture (${config.variant}): `);
    
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(config.fps) === 0) {
        process.stdout.write('.');
      }

      // Determine which stop-motion texture to use for this frame
      const texIndex = Math.floor(frame / holdFrames) % numTextures;
      const currentTexture = textures[texIndex];

      if (config.bgTransparent) {
        ctx.clearRect(0, 0, config.width, config.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, config.width, config.height);
      }

      (ctx as any).drawImage(currentTexture, 0, 0, config.width, config.height);

      const buffer = canvas.toBuffer('raw');
      pipeline.pushFrame(buffer);
    }
    
    process.stdout.write(' Done!\n');
  }
};
