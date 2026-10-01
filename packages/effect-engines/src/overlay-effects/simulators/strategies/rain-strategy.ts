import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { ParticlePool } from '../particles/particle-pool';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class RainSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'RainSimulator';
  private pool!: ParticlePool;
  private baseSpeed: number = 1000;
  private windOffsetBase: number = -200;
  private windOffsetVariance: number = -100;

  init(params: VFXSimulationParams): void {
    super.init(params);
    let dropCount = 1000;
    this.baseSpeed = this.height * 1.5;

    switch (this.variant) {
      case 'drizzle':
        dropCount = 300;
        this.baseSpeed = this.height * 0.8;
        this.windOffsetBase = -50;
        this.windOffsetVariance = -50;
        break;
      case 'storm':
        dropCount = 2000;
        this.baseSpeed = this.height * 2.5;
        this.windOffsetBase = -800;
        this.windOffsetVariance = -400;
        break;
      case 'heavy_rain':
      default:
        dropCount = 1000;
        this.baseSpeed = this.height * 1.5;
        this.windOffsetBase = -200;
        this.windOffsetVariance = -100;
        break;
    }

    this.pool = new ParticlePool(dropCount);
    for (let i = 0; i < dropCount; i++) {
      const z = Math.random() * 0.5 + 0.5;
      this.pool.spawn({
        x: Math.random() * (this.width + Math.abs(this.windOffsetBase) * 2),
        y: Math.random() * this.height,
        z,
        size: (Math.random() * 20 + 20) * z,
        vy: (this.baseSpeed * z) + (Math.random() * 200),
        vx: (Math.random() * this.windOffsetVariance + this.windOffsetBase) * z
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

    ctx.lineCap = 'round';
    const particles = this.pool.getActiveParticles();

    for (const p of particles) {
      const totalDistY = p.vy * timeSec;
      const currentY = (p.y + totalDistY) % this.height;

      const totalDistX = p.vx * timeSec;
      const currentX = ((p.x + totalDistX) % this.width + this.width) % this.width;

      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 * p.z})`;
      ctx.lineWidth = 1.5 * p.z;
      ctx.beginPath();
      ctx.moveTo(currentX, currentY);

      const tailX = currentX - (p.vx / this.fps) * 0.5;
      const tailY = currentY - p.size;
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
    }
  }
}
