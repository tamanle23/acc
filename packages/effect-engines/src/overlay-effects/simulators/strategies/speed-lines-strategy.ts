import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class SpeedLinesSimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'SpeedLinesSimulator';

  init(params: VFXSimulationParams): void {
    super.init(params);
  }

  update(dt: number, totalTime: number): void {
    super.update(dt, totalTime);
  }

  draw(ctx: CanvasContext2D, totalTime?: number): void {
    const timeSec = totalTime ?? this.currentTimeSec;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;

    if (this.variant === 'radial_burst') {
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      const numLines = 36;
      for (let i = 0; i < numLines; i++) {
        const angle = (i / numLines) * Math.PI * 2 + Math.sin(timeSec * 10) * 0.1;
        ctx.beginPath();
        ctx.moveTo(centerX + Math.cos(angle) * 100, centerY + Math.sin(angle) * 100);
        ctx.lineTo(centerX + Math.cos(angle) * this.width, centerY + Math.sin(angle) * this.height);
        ctx.stroke();
      }
    } else {
      for (let i = 0; i < 20; i++) {
        const lineY = ((i * 57 + timeSec * 1000) % this.height);
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(this.width, lineY);
        ctx.stroke();
      }
    }
  }
}
