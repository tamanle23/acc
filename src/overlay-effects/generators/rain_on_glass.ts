import { BaseEffectEngine } from '../../core/BaseEffectEngine';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
export class RainOnGlassEffect extends BaseEffectEngine {
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
    const { stream, promise } = this.setupFFmpegStream(outputPath);
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
    const numStatic = this.variantName === 'static_drops' ? 4000 : 1500;
    for (let i = 0; i < numStatic; i++) {
      drops.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        r: Math.random() * 2 + 0.5, // Tiny
        speedY: 0,
        wobbleFreq: 0,
        wobblePhase: 0,
        opacityScale: Math.random() * 0.5 + 0.5
      });
    }
    // Generate medium static drops
    const numMedium = this.variantName === 'static_drops' ? 300 : 100;
    for (let i = 0; i < numMedium; i++) {
      drops.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        r: Math.random() * 6 + 2, // Medium
        speedY: 0,
        wobbleFreq: 0,
        wobblePhase: 0,
        opacityScale: 1
      });
    }
    // Generate sliding drops if variant is sliding_drops
    if (this.variantName === 'sliding_drops') {
      const numSliding = 40;
      for (let i = 0; i < numSliding; i++) {
        const cycles = Math.floor(Math.random() * 3) + 1; // 1 to 3 wobbles per loop
        drops.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          r: Math.random() * 8 + 5, // Large
          speedY: this.height * (0.2 + Math.random() * 0.4), // Slide down
          wobbleFreq: (cycles * Math.PI * 2) / this.duration,
          wobblePhase: Math.random() * Math.PI * 2,
          opacityScale: 1
        });
      }
    }
    process.stdout.write(`Rendering ${totalFrames} frames for Rain on Glass (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      const timeSec = frame / this.fps;
      if ((this.pipelineConfig.background === 'transparent')) {
        ctx.clearRect(0, 0, this.width, this.height);
      } else {
        // We use a dark grey/black background. When composited with 'Screen', black disappears.
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.width, this.height);
      }
      for (const d of drops) {
        let currentX = d.x;
        // Modulo Y for seamless looping of sliding drops
        let currentY = ((d.y + d.speedY * timeSec) % this.height + this.height) % this.height;
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
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
