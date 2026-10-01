import { IVFXSimulatorStrategy, VFXSimulationParams } from '../simulators/base';
import { CanvasContext2D } from '../canvas-strategies/base';

/**
 * Decorator pattern that wraps an IVFXSimulatorStrategy to enforce seamless looping
 * using smooth phase blending or position wrapping.
 */
export class SeamlessLoopDecorator implements IVFXSimulatorStrategy {
  readonly name: string;
  private innerStrategy: IVFXSimulatorStrategy;
  private duration: number = 5;

  constructor(strategy: IVFXSimulatorStrategy) {
    this.innerStrategy = strategy;
    this.name = `SeamlessLoop_${strategy.name}`;
  }

  init(params: VFXSimulationParams): void {
    this.duration = params.duration;
    this.innerStrategy.init(params);
  }

  update(dt: number, totalTime: number): void {
    const wrappedTime = totalTime % this.duration;
    this.innerStrategy.update(dt, wrappedTime);
  }

  draw(ctx: CanvasContext2D, totalTime?: number): void {
    const wrappedTime = totalTime !== undefined ? totalTime % this.duration : undefined;
    this.innerStrategy.draw(ctx, wrappedTime);
  }
}
