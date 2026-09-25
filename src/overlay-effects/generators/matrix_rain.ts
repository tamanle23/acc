import { BaseEffectEngine } from '../../core/BaseEffectEngine';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
export class MatrixRainEffect extends BaseEffectEngine {
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
    const fontSize = 20;
    const columns = Math.floor(this.width / fontSize);
    interface Column {
      x: number;
      speed: number;
      length: number;
      chars: string[];
    }
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*'.split('');
    const cols: Column[] = [];
    for (let i = 0; i < columns; i++) {
      const length = Math.floor(Math.random() * 20) + 10;
      const colChars = [];
      for (let j = 0; j < length; j++) colChars.push(chars[Math.floor(Math.random() * chars.length)]);
      cols.push({
        x: i * fontSize,
        speed: (Math.random() * 0.5 + 0.5) * this.height * 0.5, // Pixels per second
        length,
        chars: colChars
      });
    }
    process.stdout.write(`Rendering ${totalFrames} frames for Matrix Rain (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) process.stdout.write('.');
      const timeSec = frame / this.fps;
      if ((this.pipelineConfig.background === 'transparent')) {
        ctx.clearRect(0, 0, this.width, this.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.width, this.height);
      }
      ctx.font = `${fontSize}px monospace`;
      const headColor = this.variantName === 'red_alert' ? 'rgba(255, 200, 200, 1)' : 'rgba(200, 255, 200, 1)';
      const tailColorRGB = this.variantName === 'red_alert' ? '255, 0, 0' : '0, 255, 0';
      for (const col of cols) {
        // Ensure seamless looping
        const exactSpeed = (Math.ceil(col.speed * this.duration / this.height) * this.height) / this.duration;
        const headY = (timeSec * exactSpeed) % this.height;
        for (let i = 0; i < col.length; i++) {
          let y = headY - i * fontSize;
          // Wrap around top if needed
          if (y < 0) y += this.height;
          const opacity = 1 - (i / col.length);
          if (i === 0) {
            ctx.fillStyle = headColor; // Bright head
          } else {
            ctx.fillStyle = `rgba(${tailColorRGB}, ${opacity})`;
          }
          // Matrix characters change occasionally, but we can just use static arrays for performance
          ctx.fillText(col.chars[i], col.x, y);
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
