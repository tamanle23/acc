import { BaseEffectEngine } from '@acc/core';
import { CanvasAdapterFactory } from '../canvas-strategies/factory';
import { CanvasAdapter } from '../canvas-strategies/base';
export class SnowEffect extends BaseEffectEngine {
  async renderAndPipe(outputPath: string): Promise<void> {
    const adapter = CanvasAdapterFactory.getAdapter('napi-rs');
    const canvas = adapter.createCanvas(this.width, this.height);
    const ctx = canvas.getContext('2d');
    const totalFrames = Math.ceil(this.fps * this.duration);
    const { stream, promise } = this.initStream(outputPath);
    // Configurable snow parameters based on variant
    let flakeCount = 1500;
    let baseSpeed = this.height * 0.2;
    let swayAmpBase = 40;
    let swayAmpVariance = 20;
    switch (this.variantName) {
      case 'light_snow':
        flakeCount = 500;
        baseSpeed = this.height * 0.15;
        swayAmpBase = 20;
        swayAmpVariance = 10;
        break;
      case 'flurries':
        flakeCount = 1500;
        baseSpeed = this.height * 0.25;
        swayAmpBase = 60;
        swayAmpVariance = 30;
        break;
      case 'blizzard':
        flakeCount = 4000;
        baseSpeed = this.height * 0.8;
        swayAmpBase = 150;
        swayAmpVariance = 100;
        break;
      default:
        console.warn(`Variant '${this.variantName}' not recognized for snow, defaulting to light_snow`);
        flakeCount = 500; // default safe fallback
        break;
    }
    interface Snowflake {
      x: number;
      y: number;
      z: number;
      radius: number;
      speed: number;
      swayFrequency: number;
      swayAmplitude: number;
      swayPhase: number;
    }
    const flakes: Snowflake[] = [];
    for (let i = 0; i < flakeCount; i++) {
      const z = Math.random() * 0.8 + 0.2; // 0.2 to 1.0
      // Frequency must be an integer multiple of (1 / duration) to loop perfectly
      // e.g., if duration is 3s, frequency could be 1/3, 2/3, 3/3 cycles per second.
      const cyclesPerLoop = Math.floor(Math.random() * 3) + 1; // 1 to 3 cycles per duration
      const swayFrequency = (cyclesPerLoop * Math.PI * 2) / this.duration;
      flakes.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        z,
        radius: (Math.random() * 3 + 1) * z,
        speed: (baseSpeed * z) + (Math.random() * 20),
        swayFrequency,
        swayAmplitude: (Math.random() * swayAmpVariance + swayAmpBase) * z,
        swayPhase: Math.random() * Math.PI * 2,
      });
    }
    process.stdout.write(`Rendering ${totalFrames} frames for Snow (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      const timeSec = frame / this.fps;
      if ((this.pipelineConfig.background === 'transparent')) {
        ctx.clearRect(0, 0, this.width, this.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.width, this.height);
      }
      for (const flake of flakes) {
        // Vertical movement (modulo for seamless wrap)
        const totalDistanceY = flake.speed * timeSec;
        const currentY = (flake.y + totalDistanceY) % this.height;
        // Horizontal sway (sine wave loops perfectly if frequency is synced to duration)
        const swayOffset = Math.sin(timeSec * flake.swayFrequency + flake.swayPhase) * flake.swayAmplitude;
        const currentX = ((flake.x + swayOffset) % this.width + this.width) % this.width;
        // Visual properties
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * flake.z})`;
        ctx.beginPath();
        ctx.arc(currentX, currentY, flake.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      const buffer = canvas.toBuffer('raw');
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
