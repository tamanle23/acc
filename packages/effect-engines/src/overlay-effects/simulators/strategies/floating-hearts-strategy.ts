import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { ParticlePool } from '../particles/particle-pool';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class FloatingHeartsSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'FloatingHeartsSimulator';
  private pool!: ParticlePool;

  init(params: VFXSimulationParams): void {
    super.init(params);
    const count = 40;
    this.pool = new ParticlePool(count);

    for (let i = 0; i < count; i++) {
      const z = Math.random() * 0.8 + 0.2;
      this.pool.spawn({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        z,
        size: (Math.random() * 15 + 10) * z,
        vy: -(Math.random() * 100 + 50) * z,
        color: '#ff4d6d',
        customData: { phase: Math.random() * Math.PI * 2 }
      });
    }
  }

  update(dt: number, totalTime: number): void {
    super.update(dt, totalTime);
  }

  draw(ctx: CanvasContext2D, totalTime?: number): void {
    const timeSec = totalTime ?? this.currentTimeSec;
    ctx.clearRect(0, 0, this.width, this.height);

    const particles = this.pool.getActiveParticles();
    for (const p of particles) {
      const currentY = ((p.y + p.vy * timeSec) % this.height + this.height) % this.height;
      const sway = Math.sin(timeSec * (2 * Math.PI / this.duration) * 2 + p.customData.phase) * 20;
      const currentX = ((p.x + sway) % this.width + this.width) % this.width;

      ctx.save();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(currentX - p.size / 4, currentY, p.size / 4, Math.PI, 0, false);
      ctx.arc(currentX + p.size / 4, currentY, p.size / 4, Math.PI, 0, false);
      ctx.lineTo(currentX, currentY + p.size / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}
