import { BaseEffectEngine } from '@acc/core';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
export class FilmDamageEffect extends BaseEffectEngine {
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
    // For film damage to be a seamless loop, we can pre-generate the damage events
    // for every single frame in the loop, or rely on the fact that random 1-frame
    // dirt doesn't need to seamlessly interpolate to frame 0 (it's inherently discontinuous).
    // However, for scratching lines that persist for a few frames, we should wrap them.
    interface Scratch {
      x: number;
      width: number;
      opacity: number;
      duration: number;
      startFrame: number;
      color: string;
    }
    const scratches: Scratch[] = [];
    if (this.variantName === 'hairline_scratches') {
      // Generate some persistent scratches
      const numScratches = Math.floor(this.fps * this.duration * 0.2); // e.g. 18 scratches over 3 seconds
      for (let i = 0; i < numScratches; i++) {
        scratches.push({
          x: Math.random() * this.width,
          width: Math.random() * 3 + 1,
          opacity: Math.random() * 0.4 + 0.1,
          duration: Math.floor(Math.random() * 10) + 2, // Lasts 2 to 11 frames
          startFrame: Math.floor(Math.random() * totalFrames),
          color: Math.random() > 0.5 ? '255, 255, 255' : '0, 0, 0' // White or Black scratches
        });
      }
    }
    // Dirt flashes for 1 frame only, so we can just use a seeded random or pre-gen per frame
    const dirtPerFrame: any[][] = [];
    for (let f = 0; f < totalFrames; f++) {
      const dirts = [];
      if (this.variantName === 'film_dirt' || Math.random() > 0.7) {
        // More dirt in film_dirt variant
        const numDirt = this.variantName === 'film_dirt' ? Math.floor(Math.random() * 15) + 5 : Math.floor(Math.random() * 3);
        for (let i = 0; i < numDirt; i++) {
          dirts.push({
            x: Math.random() * this.width,
            y: Math.random() * this.height,
            radius: Math.random() * 5 + 1,
            opacity: Math.random() * 0.8 + 0.2,
            type: Math.random() > 0.5 ? 'circle' : 'hair',
            color: Math.random() > 0.2 ? '0, 0, 0' : '255, 255, 255' // mostly dark dirt, some white dust
          });
        }
      }
      dirtPerFrame.push(dirts);
    }
    // Add a slight global flickering to the entire film
    const flickers = new Array(totalFrames).fill(0).map(() => Math.random() * 0.05);
    process.stdout.write(`Rendering ${totalFrames} frames for Film Damage (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      // Base background (assuming MP4 black background meant for Screen or Multiply blending)
      // Actually, film damage is often used with "Screen" for white scratches and "Multiply" for black dirt.
      // If the user wants black background, we must ensure black scratches are visible.
      // Wait, if it's black BG and meant to be Screened, black dirt is invisible!
      // Usually, film overlays are Grey (128,128,128) and blended with 'Overlay' or 'Hard Light'.
      // But the rule says (MP4 / Black BG). We'll stick to mostly white/grey scratches so they show up on Screen blend.
      // We will adjust colors to be bright.
      if ((this.pipelineConfig.background === 'transparent')) {
        ctx.clearRect(0, 0, this.width, this.height);
      } else {
        ctx.fillStyle = '#000000'; // Black BG
        ctx.fillRect(0, 0, this.width, this.height);
      }
      // Global flicker (adds a slight white/grey wash to the frame)
      if (this.variantName === 'film_dirt') {
        ctx.fillStyle = `rgba(255, 255, 255, ${flickers[frame]})`;
        ctx.fillRect(0, 0, this.width, this.height);
      }
      // Draw Scratches
      for (const scratch of scratches) {
        // Calculate age handling wrap-around
        let age = frame - scratch.startFrame;
        if (age < 0) age += totalFrames; // Wrapped around
        if (age < scratch.duration) {
          // Jitter X slightly
          const jitterX = scratch.x + (Math.random() - 0.5) * 4;
          ctx.fillStyle = `rgba(255, 255, 255, ${scratch.opacity})`; // White for Screen blending
          ctx.fillRect(jitterX, 0, scratch.width, this.height);
        }
      }
      // Draw Dirt
      const dirts = dirtPerFrame[frame];
      for (const dirt of dirts) {
        ctx.fillStyle = `rgba(255, 255, 255, ${dirt.opacity})`; // White dirt for Screen blending
        ctx.strokeStyle = `rgba(255, 255, 255, ${dirt.opacity})`;
        if (dirt.type === 'circle') {
          ctx.beginPath();
          ctx.arc(dirt.x, dirt.y, dirt.radius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Draw a tiny squiggle (hair)
          ctx.beginPath();
          ctx.moveTo(dirt.x, dirt.y);
          ctx.bezierCurveTo(
            dirt.x + Math.random() * 20 - 10, dirt.y + Math.random() * 20 - 10,
            dirt.x + Math.random() * 20 - 10, dirt.y + Math.random() * 20 - 10,
            dirt.x + Math.random() * 10 - 5, dirt.y + Math.random() * 10 - 5
          );
          ctx.lineWidth = Math.random() * 2 + 1;
          ctx.stroke();
        }
      }
      const buffer = canvas.toBuffer('raw');
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
