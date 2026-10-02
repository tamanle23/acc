import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { ParticlePool } from '../particles/particle-pool';
import { CanvasContext2D } from '../../canvas-strategies/base';
import { CurlNoise } from '../noise/curl-noise';

export class EmbersSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'EmbersSimulator';
  private pool!: ParticlePool;
  private curlNoise = new CurlNoise();

  init(params: VFXSimulationParams): void {
    super.init(params);
    const count = this.variant === 'windy_sparks' ? 600 : 300;
    this.pool = new ParticlePool(count);

    for (let i = 0; i < count; i++) {
      const z = Math.random() * 0.8 + 0.2;
      this.pool.spawn({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        z,
        size: (Math.random() * 3 + 1) * z,
        vy: -(Math.random() * 80 + 40) * z,
        customData: { phase: Math.random() * Math.PI * 2 }
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
      const curl = this.curlNoise.getCurl2D(p.x * 0.003, p.y * 0.003, timeSec * (2 * Math.PI / this.duration));
      const currentY = ((p.y + p.vy * timeSec) % this.height + this.height) % this.height;
      const currentX = ((p.x + curl.vx * 40 * timeSec) % this.width + this.width) % this.width;

      const alphaPulse = Math.sin(timeSec * (2 * Math.PI / this.duration) * 5 + p.customData.phase) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255, 140, 0, ${Math.max(0, Math.min(1, alphaPulse)) * p.z})`;
      ctx.beginPath();
      ctx.arc(currentX, currentY, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
