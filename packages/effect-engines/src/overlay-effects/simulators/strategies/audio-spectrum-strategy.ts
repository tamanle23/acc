import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class AudioSpectrumSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'AudioSpectrumSimulator';

  init(params: VFXSimulationParams): void {
    super.init(params);
  }

  update(dt: number, totalTime: number): void {
    super.update(dt, totalTime);
  }

  draw(ctx: CanvasContext2D, totalTime?: number): void {
    const timeSec = totalTime ?? this.currentTimeSec;
    ctx.clearRect(0, 0, this.width, this.height);

    const bars = 32;
    const barWidth = this.width / bars;

    ctx.fillStyle = '#00ffcc';
    for (let i = 0; i < bars; i++) {
      const h = (Math.sin(timeSec * 5 + i * 0.5) * 0.4 + 0.5) * (this.height * 0.5);
      ctx.fillRect(i * barWidth + 2, this.height - h, barWidth - 4, h);
    }
  }
}
