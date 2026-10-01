import { BaseVFXSimulator, VFXSimulationParams } from '../base';
import { CanvasContext2D } from '../../canvas-strategies/base';

export class GenericVFXSimulatorStrategy extends BaseVFXSimulator {
  readonly name: string;
  private effectType: string;

  constructor(effectType: string) {
    super();
    this.effectType = effectType;
    this.name = `${effectType}Simulator`;
  }

  init(params: VFXSimulationParams): void {
    super.init(params);
  }

  update(dt: number, totalTime: number): void {
    super.update(dt, totalTime);
  }

  draw(ctx: CanvasContext2D, totalTime?: number): void {
    const timeSec = totalTime ?? this.currentTimeSec;
    const phase = Math.sin(timeSec * (2 * Math.PI / this.duration));

    if (this.params.bgTransparent) {
      ctx.clearRect(0, 0, this.width, this.height);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    switch (this.effectType) {
      case 'bokeh': {
        for (let i = 0; i < 20; i++) {
          const cx = ((i * 137 + phase * 100) % this.width + this.width) % this.width;
          const cy = ((i * 241 + Math.cos(timeSec) * 50) % this.height + this.height) % this.height;
          ctx.fillStyle = `rgba(255, 200, 150, ${0.1 + (i % 5) * 0.05})`;
          ctx.beginPath();
          ctx.arc(cx, cy, 30 + (i % 7) * 10, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'starfield': {
        for (let i = 0; i < 200; i++) {
          const sx = (i * 97) % this.width;
          const sy = (i * 193) % this.height;
          const alpha = Math.sin(timeSec * 5 + i) * 0.4 + 0.6;
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          ctx.fillRect(sx, sy, 2, 2);
        }
        break;
      }
      case 'camera_ui': {
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(50, 50, this.width - 100, this.height - 100);
        ctx.fillStyle = '#ff0000';
        if (Math.sin(timeSec * 4) > 0) {
          ctx.beginPath();
          ctx.arc(100, 100, 12, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      default: {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(0, 0, this.width, this.height);
        break;
      }
    }
  }
}
