import { BaseEffectEngine } from '@acc/core';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
export class GrungeTextureEffect extends BaseEffectEngine {
  async renderAndPipe(outputPath: string): Promise<void> {
    let adapter: CanvasAdapter;
    if ('napi-rs' === 'napi-rs') {
      adapter = new NapiRsCanvasAdapter();
    } else {
      throw new Error(`Canvas engine ${'napi-rs'} not supported yet.`);
    }
    const canvas = adapter.createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    const totalFrames = Math.ceil(this.fps * this.duration);
    const { stream, promise } = this.initStream(outputPath);
    // Stop motion means we don't update the texture every frame, but every N frames (e.g., 4 frames = 7.5fps)
    const holdFrames = 4;
    // We will generate a few unique textures and loop through them randomly or sequentially
    // to keep the file size low and the loop seamless. Since it's stop motion, 
    // a sequence of 6 distinct textures played repeatedly works perfectly.
    const numTextures = Math.ceil(totalFrames / holdFrames);
    const textures: any[] = [];
    process.stdout.write(`Generating ${numTextures} stop-motion textures... `);
    for (let i = 0; i < numTextures; i++) {
      const texCanvas = adapter.createCanvas(this.width, this.height);
      const texCtx = texCanvas.getContext('2d') as any;
      if ((this.pipelineConfig.background === 'transparent')) {
        texCtx.clearRect(0, 0, this.width, this.height);
      } else {
        texCtx.fillStyle = '#000000';
        texCtx.fillRect(0, 0, this.width, this.height);
      }
      if (this.variantName === 'stop_motion_paper') {
        // Draw crumpled paper lines, scratches, and dust
        // Base wash
        texCtx.fillStyle = `rgba(255, 240, 220, 0.1)`; // Warm paper tone
        texCtx.fillRect(0, 0, this.width, this.height);
        // Random thick scuffs
        const numScuffs = Math.floor(Math.random() * 20) + 10;
        texCtx.fillStyle = `rgba(255, 255, 255, 0.4)`;
        for (let s = 0; s < numScuffs; s++) {
          texCtx.beginPath();
          const x = Math.random() * this.width;
          const y = Math.random() * this.height;
          texCtx.arc(x, y, Math.random() * 50 + 10, 0, Math.PI * 2);
          texCtx.fill();
        }
        // Random thin scratches
        const numScratches = Math.floor(Math.random() * 100) + 50;
        texCtx.strokeStyle = `rgba(255, 255, 255, 0.6)`;
        for (let s = 0; s < numScratches; s++) {
          texCtx.beginPath();
          const x = Math.random() * this.width;
          const y = Math.random() * this.height;
          texCtx.moveTo(x, y);
          texCtx.lineTo(x + (Math.random() - 0.5) * 100, y + (Math.random() - 0.5) * 100);
          texCtx.lineWidth = Math.random() * 2 + 0.5;
          texCtx.stroke();
        }
      } else if (this.variantName === 'flickering_halftone') {
        // Halftone dots (comic style)
        // We draw a grid of circles. To make it flicker, we randomly shift the grid or change dot sizes.
        const gridSize = 15;
        const offsetX = Math.random() * gridSize;
        const offsetY = Math.random() * gridSize;
        const dotBase = Math.random() * 3 + 2;
        texCtx.fillStyle = `rgba(255, 255, 255, 0.5)`;
        for (let y = 0; y < this.height; y += gridSize) {
          for (let x = 0; x < this.width; x += gridSize) {
            // Add some noise to the dot size to create texture
            const noise = (Math.random() - 0.5) * 2;
            const r = Math.max(0.5, dotBase + noise);
            texCtx.beginPath();
            texCtx.arc(x + offsetX, y + offsetY, r, 0, Math.PI * 2);
            texCtx.fill();
          }
        }
      } else {
        console.warn(`Variant '${this.variantName}' not recognized for grunge_texture`);
      }
      textures.push((texCanvas as any).getRawCanvas ? (texCanvas as any).getRawCanvas() : texCanvas);
    }
    console.log(`Done.`);
    process.stdout.write(`Rendering ${totalFrames} frames for Grunge Texture (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      // Determine which stop-motion texture to use for this frame
      const texIndex = Math.floor(frame / holdFrames) % numTextures;
      const currentTexture = textures[texIndex];
      if ((this.pipelineConfig.background === 'transparent')) {
        ctx.clearRect(0, 0, this.width, this.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.width, this.height);
      }
      (ctx as any).drawImage(currentTexture, 0, 0, this.width, this.height);
      const buffer = canvas.toBuffer('raw');
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
