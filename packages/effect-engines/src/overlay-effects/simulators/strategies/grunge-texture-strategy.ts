import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class GrungeTextureSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'GrungeTextureSimulator';

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
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    const seed = Math.sin(timeSec * 12);
    for (let i = 0; i < 50; i++) {
      const rx = Math.abs(Math.sin(seed * i) * this.width);
      const ry = Math.abs(Math.cos(seed * i) * this.height);
      ctx.fillRect(rx, ry, 10 + i, 5);
    }
  }
}
