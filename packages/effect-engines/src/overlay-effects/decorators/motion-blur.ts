import { IVFXSimulatorStrategy, VFXSimulationParams } from '../simulators/base';
import { CanvasContext2D } from '../canvas-strategies/base';

/**
 * Decorator pattern that applies accumulation-based motion blur or trail fading.
 */
export class MotionBlurDecorator implements IVFXSimulatorStrategy {
  readonly name: string;
  private innerStrategy: IVFXSimulatorStrategy;
  private fadeAlpha: number;
  private width: number = 1920;
  private height: number = 1080;

  constructor(strategy: IVFXSimulatorStrategy, fadeAlpha: number = 0.25) {
    this.innerStrategy = strategy;
    this.fadeAlpha = fadeAlpha;
    this.name = `MotionBlur_${strategy.name}`;
  }

  init(params: VFXSimulationParams): void {
    this.width = params.width;
    this.height = params.height;
    this.innerStrategy.init(params);
  }

  update(dt: number, totalTime: number): void {
    this.innerStrategy.update(dt, totalTime);
  }

  draw(ctx: CanvasContext2D, totalTime?: number): void {
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`;
    ctx.fillRect(0, 0, this.width, this.height);
    this.innerStrategy.draw(ctx, totalTime);
    ctx.restore();
  }
}
