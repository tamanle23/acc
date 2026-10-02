import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class DigitalGlitchSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'DigitalGlitchSimulator';

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

    const glitchPhase = Math.sin(timeSec * (2 * Math.PI / this.duration) * 8);
    if (glitchPhase > 0.4) {
      const sliceY = (Math.abs(glitchPhase) * this.height) % this.height;
      const sliceH = 20 + Math.abs(glitchPhase) * 40;
      ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
      ctx.fillRect(glitchPhase * 50, sliceY, this.width, sliceH);
      ctx.fillStyle = 'rgba(255, 0, 128, 0.4)';
      ctx.fillRect(-glitchPhase * 50, sliceY + sliceH * 0.5, this.width, sliceH * 0.5);
    }
  }
}
