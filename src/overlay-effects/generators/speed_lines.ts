import { BaseEffectEngine } from '../../core/BaseEffectEngine';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
export class SpeedLinesEffect extends BaseEffectEngine {
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
    // Anime speed lines are basically just lots of lines.
    // They usually flicker or change slightly every frame or every 2 frames.
    // We can just generate them dynamically per frame.
    const cx = this.width / 2;
    const cy = this.height / 2;
    const maxRadius = Math.sqrt(cx*cx + cy*cy); // Distance to corner
    process.stdout.write(`Rendering ${totalFrames} frames for Speed Lines (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      if (this.variantName === 'radial_burst') {
        const numLines = Math.floor(Math.random() * 20) + 100; // 100-120 lines
        const innerRadiusBase = Math.min(this.width, this.height) * 0.25;
        for (let i = 0; i < numLines; i++) {
          const angle = Math.random() * Math.PI * 2;
          const length = Math.random() * maxRadius * 0.5 + maxRadius * 0.5;
          const innerR = innerRadiusBase + Math.random() * 100;
          const startX = cx + Math.cos(angle) * innerR;
          const startY = cy + Math.sin(angle) * innerR;
          const endX = cx + Math.cos(angle) * (innerR + length);
          const endY = cy + Math.sin(angle) * (innerR + length);
          // Draw a very thin, sharp triangle for manga look
          const thickness = Math.random() * 4 + 1;
          const anglePerp = angle + Math.PI / 2;
          ctx.beginPath();
          // Tip points to center
          ctx.moveTo(startX, startY);
          // Base is wide on the outside
          ctx.lineTo(endX + Math.cos(anglePerp) * thickness, endY + Math.sin(anglePerp) * thickness);
          ctx.lineTo(endX - Math.cos(anglePerp) * thickness, endY - Math.sin(anglePerp) * thickness);
          ctx.fill();
        }
      } else if (this.variantName === 'horizontal_rush') {
        const numLines = Math.floor(Math.random() * 30) + 60;
        for (let i = 0; i < numLines; i++) {
          const y = Math.random() * this.height;
          // Randomly appear from left or right edge, or span whole screen
          const length = Math.random() * this.width + this.width * 0.5;
          const thickness = Math.random() * 6 + 1;
          const xOffset = Math.random() > 0.5 ? 0 : this.width - length;
          ctx.fillRect(xOffset, y, length, thickness);
        }
      } else {
        console.warn(`Variant '${this.variantName}' not recognized for speed_lines`);
      }
      const buffer = canvas.toBuffer('raw');
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
