import { BaseEffectEngine } from '../../core/BaseEffectEngine';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
export class BubblesEffect extends BaseEffectEngine {
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
    let bubbleCount = 50;
    let baseSpeedY = -this.height * 0.2; // Move up
    let sizeMultiplier = 1;
    switch(this.variantName) {
      case 'underwater_bubbles':
        bubbleCount = 200;
        baseSpeedY = -this.height * 0.4;
        sizeMultiplier = 0.5;
        break;
      case 'floating_bubbles':
        bubbleCount = 40;
        baseSpeedY = -this.height * 0.15;
        sizeMultiplier = 1.5;
        break;
      default:
        console.warn(`Variant '${this.variantName}' not recognized for bubbles, defaulting to floating_bubbles`);
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
      const swayFreq = (swayCycles * Math.PI * 2) / this.duration;
      const scaleCycles = Math.floor(Math.random() * 2) + 1;
      const scaleFreq = (scaleCycles * Math.PI * 2) / this.duration;
      bubbles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        radius: (Math.random() * 20 + 5) * z * sizeMultiplier,
        speedX: (Math.random() - 0.5) * this.width * 0.05,
        speedY: baseSpeedY * z,
        swayFreq,
        swayPhase: Math.random() * Math.PI * 2,
        scaleFreq,
        scalePhase: Math.random() * Math.PI * 2,
      });
    }
    process.stdout.write(`Rendering ${totalFrames} frames for Bubbles (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      const timeSec = frame / this.fps;
      // Bubbles strictly require transparent backgrounds for proper overlay
      ctx.clearRect(0, 0, this.width, this.height);
      for (const b of bubbles) {
        // Continuous movement with seamless wrapping
        const currentX = ((b.x + b.speedX * timeSec) % this.width + this.width) % this.width;
        const currentY = ((b.y + b.speedY * timeSec) % this.height + this.height) % this.height;
        // Sway calculation
        const sway = Math.sin(timeSec * b.swayFreq + b.swayPhase) * (this.width * 0.02);
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
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
