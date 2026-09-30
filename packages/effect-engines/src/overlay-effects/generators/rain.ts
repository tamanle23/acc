import { BaseEffectEngine } from '@acc/core';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter, CanvasInstance } from '../canvas-strategies/base';
// Simple PRNG to replace Math.random for deterministic loops if needed, 
// though for rain, standard random might be fine since we warp the positions.
export class RainEffect extends BaseEffectEngine {
  async renderAndPipe(outputPath: string): Promise<void> {
    // Choose adapter based on config
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
    // Configurable rain parameters based on variant
    let dropCount = 1000;
    let baseSpeed = this.height * 1.5; // Distance per second (pixels)
    let windOffsetBase = -200;
    let windOffsetVariance = -100;
    switch (this.variantName) {
      case 'drizzle':
        dropCount = 300;
        baseSpeed = this.height * 0.8;
        windOffsetBase = -50;
        windOffsetVariance = -50;
        break;
      case 'heavy_rain':
        dropCount = 1000;
        baseSpeed = this.height * 1.5;
        windOffsetBase = -200;
        windOffsetVariance = -100;
        break;
      case 'storm':
        dropCount = 2000;
        baseSpeed = this.height * 2.5;
        windOffsetBase = -800; // Strong wind
        windOffsetVariance = -400;
        break;
      default:
        console.warn(`Variant '${this.variantName}' not recognized for rain, defaulting to heavy_rain`);
        break;
    }
    // Initialize drops
    interface Drop {
      x: number;
      y: number;
      z: number; // For pseudo-3D parallax (closer = faster, thicker)
      length: number;
      speed: number;
      windOffset: number; // Horizontal drift per second
    }
    const drops: Drop[] = [];
    for (let i = 0; i < dropCount; i++) {
      const z = Math.random() * 0.5 + 0.5; // 0.5 to 1.0
      drops.push({
        x: Math.random() * (this.width + Math.abs(windOffsetBase) * 2), // Extra width to account for wind
        y: Math.random() * this.height,
        z,
        length: (Math.random() * 20 + 20) * z,
        speed: (baseSpeed * z) + (Math.random() * 200), // Pixel/sec
        windOffset: (Math.random() * windOffsetVariance + windOffsetBase) * z,   // Negative for leftward slant
      });
    }
    // Render loop
    process.stdout.write(`Rendering ${totalFrames} frames for Rain (${this.variantName}): `);
    for (let frame = 0; frame < totalFrames; frame++) {
      // Progress indicator
      if (frame % Math.floor(this.fps) === 0) {
        process.stdout.write('.');
      }
      const timeSec = frame / this.fps;
      // Clear background
      if ((this.pipelineConfig.background === 'transparent')) {
        ctx.clearRect(0, 0, this.width, this.height);
      } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, this.width, this.height);
      }
      ctx.lineCap = 'round';
      // Draw drops
      for (const drop of drops) {
        // Calculate new position based on speed and time
        // We use modulo to ensure the drop wraps around seamlessly
        // Vertical movement
        const totalDistanceY = drop.speed * timeSec;
        const currentY = (drop.y + totalDistanceY) % this.height;
        // Horizontal movement (wind)
        const totalDistanceX = drop.windOffset * timeSec;
        // Since wind is negative, we need positive modulo math
        const currentX = ((drop.x + totalDistanceX) % this.width + this.width) % this.width;
        // Visual properties based on depth (z)
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * drop.z})`;
        ctx.lineWidth = 1.5 * drop.z;
        ctx.beginPath();
        ctx.moveTo(currentX, currentY);
        // Draw the tail of the drop (opposite to the falling direction)
        const tailX = currentX - (drop.windOffset / this.fps) * 0.5; // Simplified angle calc
        const tailY = currentY - drop.length;
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }
      // Extract raw buffer and push to pipeline
      const buffer = canvas.toBuffer('raw');
      stream.write(buffer);
    }
    process.stdout.write(' Done!\n');
    stream.end();
    await promise;
  }
}
