import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { ParticlePool } from '../particles/particle-pool';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class RainOnGlassSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'RainOnGlassSimulator';
  private pool!: ParticlePool;

  init(params: VFXSimulationParams): void {
    super.init(params);
    const count = this.variant === 'sliding_drops' ? 100 : 400;
    this.pool = new ParticlePool(count);

    for (let i = 0; i < count; i++) {
      const z = Math.random() * 0.8 + 0.2;
      const isSliding = this.variant === 'sliding_drops' && i < 30;
      this.pool.spawn({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        z,
        size: isSliding ? (Math.random() * 6 + 4) : (Math.random() * 3 + 1),
        vy: isSliding ? this.height * (0.2 + Math.random() * 0.3) : 0,
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
      const currentY = p.vy > 0 ? ((p.y + p.vy * timeSec) % this.height) : p.y;
      const wobble = p.vy > 0 ? Math.sin(timeSec * (2 * Math.PI / this.duration) * 3 + p.customData.phase) * (p.size * 0.5) : 0;
      const currentX = p.x + wobble;

      ctx.save();
      ctx.beginPath();
      ctx.arc(currentX, currentY, p.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }
}
