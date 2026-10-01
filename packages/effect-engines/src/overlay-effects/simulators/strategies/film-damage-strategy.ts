import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class FilmDamageSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'FilmDamageSimulator';

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

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1;

    const scratchPhase = Math.sin(timeSec * (2 * Math.PI / this.duration) * 10);
    const scratchX = ((scratchPhase * 0.5 + 0.5) * this.width);

    ctx.beginPath();
    ctx.moveTo(scratchX, 0);
    ctx.lineTo(scratchX + scratchPhase * 10, this.height);
    ctx.stroke();

    for (let i = 0; i < 5; i++) {
      const spotPhase = Math.sin(timeSec * (2 * Math.PI / this.duration) * (i + 1) * 3);
      if (spotPhase > 0.5) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.beginPath();
        ctx.arc((spotPhase * 1000) % this.width, (spotPhase * 800) % this.height, Math.random() * 3 + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
