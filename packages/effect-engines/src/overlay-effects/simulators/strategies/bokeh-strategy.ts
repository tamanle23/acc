import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class BokehSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'BokehSimulator';

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

    const count = 25;
    for (let i = 0; i < count; i++) {
      const cx = ((i * 137 + timeSec * 30) % this.width + this.width) % this.width;
      const cy = ((i * 241 + Math.sin(timeSec + i) * 20) % this.height + this.height) % this.height;
      const radius = 25 + (i % 5) * 10;
      const alpha = Math.sin(timeSec * 2 + i) * 0.15 + 0.25;

      ctx.fillStyle = `rgba(255, 200, 150, ${alpha})`;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
