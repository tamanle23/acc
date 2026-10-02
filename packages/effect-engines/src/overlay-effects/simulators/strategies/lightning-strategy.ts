import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class LightningSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'LightningSimulator';

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

    const strikePhase = Math.sin(timeSec * (2 * Math.PI / this.duration) * 3);
    if (strikePhase > 0.7) {
      ctx.strokeStyle = '#a2d2ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(this.width * 0.5, 0);

      let curX = this.width * 0.5;
      for (let y = 0; y < this.height; y += 40) {
        curX += (Math.sin(y * 0.1 + strikePhase * 10) * 30);
        ctx.lineTo(curX, y);
      }
      ctx.stroke();
    }
  }
}
