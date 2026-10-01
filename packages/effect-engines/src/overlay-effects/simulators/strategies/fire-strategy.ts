import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';
import { SimplexNoise } from '../noise/curl-noise';

export class FireSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'FireSimulator';

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

    const cols = 60;
    const cellW = this.width / cols;
    const phase = Math.sin(timeSec * (2 * Math.PI / this.duration));

    for (let i = 0; i < cols; i++) {
      const noiseH = SimplexNoise.fBm2D(i * 0.1, phase * 2, 3, 0.5);
      const flameH = (noiseH * 0.4 + 0.3) * this.height * 0.5;

      const grad = ctx.createLinearGradient ? ctx.createLinearGradient(0, this.height, 0, this.height - flameH) : null;
      if (grad) {
        grad.addColorStop(0, 'rgba(255, 60, 0, 0.9)');
        grad.addColorStop(0.5, 'rgba(255, 180, 0, 0.6)');
        grad.addColorStop(1, 'rgba(255, 255, 200, 0.0)');
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = 'rgba(255, 100, 0, 0.7)';
      }

      ctx.fillRect(i * cellW, this.height - flameH, cellW + 1, flameH);
    }
  }
}
