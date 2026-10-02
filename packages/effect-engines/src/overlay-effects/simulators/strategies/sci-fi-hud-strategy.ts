import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class SciFiHUDSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'SciFiHUDSimulator';

  init(params: VFXSimulationParams): void {
    super.init(params);
  }

  update(dt: number, totalTime: number): void {
    super.update(dt, totalTime);
  }

  draw(ctx: CanvasContext2D, totalTime?: number): void {
    const timeSec = totalTime ?? this.currentTimeSec;
    ctx.clearRect(0, 0, this.width, this.height);

    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const rot = timeSec * Math.PI;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rot);
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.arc(0, 0, 150, 0, Math.PI * 1.5);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 100, Math.PI, Math.PI * 2.5);
    ctx.stroke();

    ctx.restore();
  }
}
