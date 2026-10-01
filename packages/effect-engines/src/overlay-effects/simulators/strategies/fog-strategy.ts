import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';
import { SimplexNoise } from '../noise/curl-noise';

export class FogSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'FogSimulator';

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

    const cols = 48;
    const rows = 27;
    const cellW = this.width / cols;
    const cellH = this.height / rows;

    const phase = Math.sin(timeSec * (2 * Math.PI / this.duration));

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const noiseVal = SimplexNoise.fBm2D(x * 0.1 + phase * 0.5, y * 0.1 + phase * 0.3, 3, 0.5);
        if (noiseVal > 0.1) {
          ctx.fillStyle = `rgba(200, 210, 220, ${Math.min(0.5, noiseVal * 0.4)})`;
          ctx.fillRect(x * cellW, y * cellH, cellW + 1, cellH + 1);
        }
      }
    }
  }
}
