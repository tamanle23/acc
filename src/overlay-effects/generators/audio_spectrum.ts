import { BaseEffectEngine } from '../../core/BaseEffectEngine';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
import { createNoise2D } from 'simplex-noise';
export class AudioSpectrumEffect extends BaseEffectEngine {
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
    const noise2D = createNoise2D();
    // To make 1D noise loop perfectly over time, we map time [0, 1] to a circle in 2D noise space
    const getLoopingNoise = (x: number, tNorm: number, radius: number = 1.0) => {
      const nx = Math.cos(tNorm * Math.PI * 2) * radius;
      const ny = Math.sin(tNorm * Math.PI * 2) * radius;
      // We also offset by 'x' so different bars have different values
      return noise2D(nx + x * 0.1, ny);
    };
    const numBars = this.variantName === 'circular_eq' ? 60 : Math.floor(this.width / 30);
    const maxBarHeight = this.height * 0.3;
    process.stdout.write(`Rendering ${totalFrames} frames for Audio Spectrum (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      const tNorm = frame / totalFrames;
      ctx.clearRect(0, 0, this.width, this.height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      if (this.variantName === 'classic_bars') {
        // Horizontal row of bars at the bottom
        const barWidth = this.width / numBars;
        const padding = barWidth * 0.2;
        for (let i = 0; i < numBars; i++) {
          // Add multiple frequencies of noise to simulate real audio EQ (bass, mid, treble)
          let n = (getLoopingNoise(i, tNorm, 1.0) + 1) / 2; // [0, 1]
          n = Math.pow(n, 1.5); // Make it more punchy
          const h = n * maxBarHeight + 5; // Min height 5
          const x = i * barWidth + padding / 2;
          const y = this.height - h;
          // Draw rounded bar
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth - padding, h, 5);
          ctx.fill();
        }
      } else if (this.variantName === 'circular_eq') {
        // Circle of bars in the center
        const cx = this.width / 2;
        const cy = this.height / 2;
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
          ctx.roundRect(-barWidth / 2, baseRadius, barWidth, h, barWidth / 2);
          ctx.fill();
          ctx.restore();
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
