import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class CameraUISimulatorStrategy extends BaseVFXSimulator {
  readonly name = 'CameraUISimulator';

  init(params: VFXSimulationParams): void {
    super.init(params);
  }

  update(dt: number, totalTime: number): void {
    super.update(dt, totalTime);
  }

  draw(ctx: CanvasContext2D, totalTime?: number): void {
    const timeSec = totalTime ?? this.currentTimeSec;
    ctx.clearRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 2;

    switch (this.variant) {
      case 'cctv_security': {
        ctx.strokeStyle = '#00ff00';
        ctx.fillStyle = '#00ff00';
        ctx.strokeRect(40, 40, this.width - 80, this.height - 80);
        if (Math.floor(timeSec * 2) % 2 === 0) {
          ctx.beginPath();
          ctx.arc(80, 80, 10, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'dslr_viewfinder': {
        const corner = 30;
        ctx.strokeRect(corner, corner, this.width - corner * 2, this.height - corner * 2);
        ctx.strokeRect(this.width / 2 - 50, this.height / 2 - 50, 100, 100);
        break;
      }
      case 'camcorder_rec':
      default: {
        ctx.fillStyle = '#ff0000';
        if (Math.floor(timeSec * 2) % 2 === 0) {
          ctx.beginPath();
          ctx.arc(80, 80, 12, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(50, 50, this.width - 100, this.height - 100);
        break;
      }
    }
    ctx.restore();
  }
}
