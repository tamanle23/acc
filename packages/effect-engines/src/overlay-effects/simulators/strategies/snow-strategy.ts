import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { ParticlePool } from '../particles/particle-pool';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class SnowSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'SnowSimulator';
  private pool!: ParticlePool;

  init(params: VFXSimulationParams): void {
    super.init(params);
    let flakeCount = 500;
    switch (this.variant) {
      case 'flurries':
        flakeCount = 800;
        break;
      case 'blizzard':
        flakeCount = 1500;
        break;
      case 'light_snow':
      default:
        flakeCount = 500;
        break;
    }

    this.pool = new ParticlePool(flakeCount);
    for (let i = 0; i < flakeCount; i++) {
      const z = Math.random() * 0.8 + 0.2;
      this.pool.spawn({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        z,
        size: (Math.random() * 3 + 1.5) * z,
        vy: (Math.random() * 40 + 30) * z,
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
      const drift = Math.sin(timeSec * (2 * Math.PI / this.duration) + p.customData.phase) * 20 * p.z;
      const currentY = (p.y + p.vy * timeSec) % this.height;
      const currentX = ((p.x + drift) % this.width + this.width) % this.width;

      ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * p.z})`;
      ctx.beginPath();
      ctx.arc(currentX, currentY, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
