import { BaseEffectEngine } from '@acc/core';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
export class LightLeakEffect extends BaseEffectEngine {
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
    // Light leaks typically use additive blending (screen or lighter)
    // On black BG, standard 'source-over' with high opacity gradients works well for 'screen' blending downstream.
    process.stdout.write(`Rendering ${totalFrames} frames for Light Leak (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      const timeSec = frame / this.fps;
      // Progress from 0.0 to 1.0 representing the loop phase
      const progress = timeSec / this.duration;
      if ((this.pipelineConfig.background === 'transparent')) {
        ctx.clearRect(0, 0, this.width, this.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.width, this.height);
      }
      // We can use a combination of radial gradients pulsing and moving
      // To ensure a seamless loop, we use Math.sin(progress * Math.PI * 2)
      if (this.variantName === 'edge_burns') {
        // Edge burns: Warm colors bleeding from edges, slowly pulsing
        const drawBurn = (baseX: number, baseY: number, radiusBase: number, radiusVar: number, phaseOffset: number, r: number, g: number, b: number) => {
          // Sine wave for pulsing (-1 to 1)
          const pulse = Math.sin(progress * Math.PI * 2 + phaseOffset);
          // Slight movement
          const x = baseX + pulse * (this.width * 0.05);
          const y = baseY + Math.cos(progress * Math.PI * 2 + phaseOffset) * (this.height * 0.05);
          const radius = radiusBase + radiusVar * pulse;
          // Draw radial gradient
          const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
          grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`);
          grad.addColorStop(0.5, `rgba(${r}, ${Math.floor(g * 0.5)}, ${Math.floor(b * 0.5)}, 0.4)`);
          grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        };
        // Draw multiple overlapping burns
        drawBurn(0, 0, this.height * 0.6, this.height * 0.2, 0, 255, 100, 30); // Top left, Orange/Red
        drawBurn(this.width, this.height, this.height * 0.7, this.height * 0.3, Math.PI, 255, 150, 50); // Bottom right, Yellow/Orange
        drawBurn(this.width * 0.8, 0, this.height * 0.5, this.height * 0.1, Math.PI / 2, 255, 80, 80); // Top right, Pinkish
        drawBurn(0, this.height * 0.5, this.height * 0.4, this.height * 0.15, Math.PI * 1.5, 200, 50, 20); // Left edge, Deep Red
      } else if (this.variantName === 'transition_flash') {
        // Transition Flash: Starts black, builds up to intense white/orange in the middle, fades to black
        // Intensity peaks at progress = 0.5
        // Using a smoothstep-like or sine curve for flash
        const intensity = (Math.sin((progress - 0.25) * Math.PI * 2) + 1) / 2; // peaks at 0.5, hits 0 at 0 and 1
        // At peak intensity, the screen should be flooded with white.
        // At medium intensity, orange/red.
        // Linear gradient sliding across the screen
        const slide = (progress - 0.5) * this.width * 2; // Moves from left to right
        const grad = ctx.createLinearGradient(slide, 0, slide + this.width, this.height);
        grad.addColorStop(0, `rgba(255, 50, 0, ${intensity * 0.5})`); // Reddish
        grad.addColorStop(0.5, `rgba(255, 200, 100, ${intensity * 0.8})`); // Orange/Yellow
        grad.addColorStop(1, `rgba(255, 50, 0, ${intensity * 0.5})`); // Reddish
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);
        // Core white flash
        // Only visible strongly around the center of the duration
        let coreWhite = 0;
        if (progress > 0.3 && progress < 0.7) {
          const coreProgress = (progress - 0.3) / 0.4; // 0 to 1
          coreWhite = Math.sin(coreProgress * Math.PI);
        }
        const radial = ctx.createRadialGradient(this.width / 2, this.height / 2, 0, this.width / 2, this.height / 2, this.width * coreWhite);
        radial.addColorStop(0, `rgba(255, 255, 255, ${coreWhite})`);
        radial.addColorStop(0.4, `rgba(255, 200, 100, ${coreWhite * 0.8})`);
        radial.addColorStop(1, `rgba(255, 200, 100, 0)`);
        ctx.fillStyle = radial;
        ctx.fillRect(0, 0, this.width, this.height);
      } else {
        console.warn(`\nVariant '${this.variantName}' not recognized for light_leak, using fallback logic.`);
      }
      const buffer = canvas.toBuffer('raw');
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
