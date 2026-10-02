import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { ParticlePool } from '../particles/particle-pool';
import { CanvasContext2D } from '../../canvas-strategies/base';
import { CurlNoise } from '../noise/curl-noise';

export class DustSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'DustSimulator';
  private pool!: ParticlePool;
  private curlNoise = new CurlNoise();

  init(params: VFXSimulationParams): void {
    super.init(params);
    const count = this.variant === 'sunshaft_dust' ? 400 : 200;
    this.pool = new ParticlePool(count);

    for (let i = 0; i < count; i++) {
      const z = Math.random() * 0.8 + 0.2;
      this.pool.spawn({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        z,
        size: (Math.random() * 2 + 1) * z,
        alpha: Math.random() * 0.5 + 0.2,
        customData: { seed: Math.random() * 1000 }
      });
    }
  }

  update(dt: number, totalTime: number): void {
    super.update(dt, totalTime);
  }

  draw(ctx: CanvasContext2D, totalTime?: number): void {
    const timeSec = totalTime ?? this.currentTimeSec;
    if (this.params.bgTransparent) {
      ctx.clearRect(0, 0, this.width, this.height);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    const particles = this.pool.getActiveParticles();

    for (const p of particles) {
      const curl = this.curlNoise.getCurl2D(p.x * 0.002, p.y * 0.002, timeSec * (2 * Math.PI / this.duration));
      const currentX = ((p.x + curl.vx * 50 * timeSec) % this.width + this.width) % this.width;
      const currentY = ((p.y + curl.vy * 50 * timeSec) % this.height + this.height) % this.height;

      const alphaPulse = Math.sin(timeSec * (2 * Math.PI / this.duration) + p.customData.seed) * 0.2 + p.alpha;
      ctx.fillStyle = `rgba(235, 225, 200, ${Math.max(0, Math.min(1, alphaPulse)) * p.z})`;
      ctx.beginPath();
      ctx.arc(currentX, currentY, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
