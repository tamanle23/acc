import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { ParticlePool } from '../particles/particle-pool';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class LeavesSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'LeavesSimulator';
  private pool!: ParticlePool;

  init(params: VFXSimulationParams): void {
    super.init(params);
    const count = this.variant === 'sakura_petals' ? 120 : 80;
    this.pool = new ParticlePool(count);

    for (let i = 0; i < count; i++) {
      this.pool.spawn({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 60,
        vy: Math.random() * 80 + 40,
        size: Math.random() * 12 + 8,
        color: this.variant === 'sakura_petals' ? '#ffb7c5' : '#d2691e',
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 3,
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
      const currentY = (p.y + p.vy * timeSec) % this.height;
      const driftX = Math.sin(timeSec * (2 * Math.PI / this.duration) + p.customData.phase) * 30;
      const currentX = ((p.x + p.vx * timeSec + driftX) % this.width + this.width) % this.width;
      const rot = p.rotation + Math.sin(timeSec * (2 * Math.PI / this.duration) + p.customData.phase) * 2;

      ctx.save();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (typeof (ctx as any).ellipse === 'function') {
        (ctx as any).ellipse(currentX, currentY, p.size, p.size * 0.5, rot, 0, Math.PI * 2);
      } else {
        ctx.arc(currentX, currentY, p.size * 0.5, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }
  }
}
