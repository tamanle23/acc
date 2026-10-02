import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class MatrixRainSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'MatrixRainSimulator';

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

    const cols = 40;
    const cellW = this.width / cols;
    const color = this.variant === 'red_alert' ? '#ff0033' : '#00ff66';

    ctx.fillStyle = color;
    for (let i = 0; i < cols; i++) {
      const dropY = ((i * 123 + timeSec * 300) % this.height);
      ctx.fillRect(i * cellW + cellW / 4, dropY, cellW / 2, 20);
    }
  }
}
