import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class StarfieldSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'StarfieldSimulator';

  init(params: VFXSimulationParams): void {
    super.init(params);
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

    const count = 300;
    for (let i = 0; i < count; i++) {
      const sx = (i * 97) % this.width;
      const sy = (i * 193) % this.height;

      if (this.variant === 'warp_speed') {
        const speedX = (sx - this.width / 2) * (1 + (timeSec % 1) * 2);
        const speedY = (sy - this.height / 2) * (1 + (timeSec % 1) * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(this.width / 2 + speedX * 0.5, this.height / 2 + speedY * 0.5);
        ctx.lineTo(this.width / 2 + speedX, this.height / 2 + speedY);
        ctx.stroke();
      } else {
        const alpha = Math.sin(timeSec * (2 * Math.PI / this.duration) * 3 + i) * 0.4 + 0.6;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(sx, sy, 2, 2);
      }
    }
  }
}
