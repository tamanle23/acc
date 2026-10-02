import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class GodRaysSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'GodRaysSimulator';

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

    const numRays = 8;
    for (let i = 0; i < numRays; i++) {
      const angle = (i / numRays) * Math.PI * 0.4 + Math.sin(timeSec + i) * 0.05;
      ctx.fillStyle = 'rgba(255, 240, 200, 0.15)';
      ctx.beginPath();
      ctx.moveTo(this.width * 0.5, 0);
      ctx.lineTo(Math.cos(angle - 0.1) * this.width, this.height);
      ctx.lineTo(Math.cos(angle + 0.1) * this.width, this.height);
      ctx.closePath();
      ctx.fill();
    }
  }
}
