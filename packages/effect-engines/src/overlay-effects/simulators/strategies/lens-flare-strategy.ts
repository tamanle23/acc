import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class LensFlareSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'LensFlareSimulator';

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

    const cx = this.width * 0.5 + Math.sin(timeSec * (2 * Math.PI / this.duration)) * 200;
    const cy = this.height * 0.4;

    ctx.fillStyle = 'rgba(0, 180, 255, 0.4)';
    ctx.fillRect(0, cy - 10, this.width, 20);

    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();
  }
}
