import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class LightLeakSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'LightLeakSimulator';

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

    const leakAlpha = Math.sin(timeSec * (2 * Math.PI / this.duration)) * 0.3 + 0.4;
    ctx.fillStyle = `rgba(255, 120, 0, ${leakAlpha})`;
    ctx.beginPath();
    ctx.arc(0, 0, this.height * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
}
