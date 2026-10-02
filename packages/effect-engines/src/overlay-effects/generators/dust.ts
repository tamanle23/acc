import { BaseEffectEngine } from '@acc/core';
import { NapiRsCanvasAdapter } from '../canvas-strategies/napi-rs';
import { CanvasAdapter } from '../canvas-strategies/base';
export class DustEffect extends BaseEffectEngine {
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
    let particleCount = 1000;
    let baseSpeedY = this.height * 0.05; // Very slow moving down
    let baseSpeedX = this.width * 0.02;  // Very slow moving right
    let sizeMultiplier = 1;
    let baseOpacity = 0.5;
    switch (this.variantName) {
      case 'ambient_dust':
        particleCount = 1000;
        baseSpeedY = this.height * 0.03;
        baseSpeedX = this.width * 0.03;
        sizeMultiplier = 1.0;
        baseOpacity = 0.6;
        break;
      case 'sunshaft_dust':
        particleCount = 2000;
        baseSpeedY = this.height * 0.1;
        baseSpeedX = this.width * 0.1; // Diagonal drift matching a light beam
        sizeMultiplier = 1.2;
        baseOpacity = 0.8;
        break;
      default:
        console.warn(`Variant '${this.variantName}' not recognized for dust, defaulting to ambient_dust`);
        break;
    }
    interface DustParticle {
      x: number;
      y: number;
      z: number;
      radius: number;
      speedX: number;
      speedY: number;
      pulseFrequency: number;
      pulsePhase: number;
    }
    const particles: DustParticle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const z = Math.random() * 0.8 + 0.2; // 0.2 to 1.0
      // Frequency must be an integer multiple of (1 / duration) to loop perfectly
      const cyclesPerLoop = Math.floor(Math.random() * 2) + 1; // 1 or 2 cycles
      const pulseFrequency = (cyclesPerLoop * Math.PI * 2) / this.duration;
      // Add variance to speed
      const speedX = (baseSpeedX * z) + ((Math.random() - 0.5) * this.width * 0.02);
      const speedY = (baseSpeedY * z) + ((Math.random() - 0.5) * this.height * 0.02);
      particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        z,
        radius: (Math.random() * 2 + 0.5) * z * sizeMultiplier,
        speedX,
        speedY,
        pulseFrequency,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
    process.stdout.write(`Rendering ${totalFrames} frames for Dust (${this.variantName}): `);
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
      // Draw dust
      for (const p of particles) {
        // Continuous movement with seamless wrapping
        const currentX = ((p.x + p.speedX * timeSec) % this.width + this.width) % this.width;
        const currentY = ((p.y + p.speedY * timeSec) % this.height + this.height) % this.height;
        // Pulsing opacity for fade in/out (sine wave normalized to 0-1)
        const pulse = (Math.sin(timeSec * p.pulseFrequency + p.pulsePhase) + 1) / 2;
        // pulse is 0.0 to 1.0
        // Some particles twinkle fully, some just slightly dim
        const opacity = baseOpacity * p.z * (0.3 + 0.7 * pulse);
        ctx.fillStyle = `rgba(255, 235, 200, ${opacity})`; // Slightly warm/golden dust
        ctx.beginPath();
        ctx.arc(currentX, currentY, p.radius, 0, Math.PI * 2);
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
