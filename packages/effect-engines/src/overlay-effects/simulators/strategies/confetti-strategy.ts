import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { ParticlePool } from '../particles/particle-pool';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class ConfettiSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'ConfettiSimulator';
  private pool!: ParticlePool;
  private colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#4caf50', '#ffeb3b', '#ff9800'];

  init(params: VFXSimulationParams): void {
    super.init(params);
    const count = 150;
    this.pool = new ParticlePool(count);

    for (let i = 0; i < count; i++) {
      const z = Math.random() * 0.8 + 0.2;
      this.pool.spawn({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        z,
        size: (Math.random() * 8 + 6) * z,
        vy: (Math.random() * 150 + 80) * z,
        vx: (Math.random() - 0.5) * 50,
        color: this.colors[i % this.colors.length],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 5,
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
      const currentY = (p.y + p.vy * timeSec) % this.height;
      const currentX = ((p.x + p.vx * timeSec) % this.width + this.width) % this.width;
      const rot = p.rotation + p.vRot * timeSec;

      ctx.save();
      ctx.fillStyle = p.color;
      ctx.translate(currentX, currentY);
      ctx.rotate(rot);
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
  }
}
