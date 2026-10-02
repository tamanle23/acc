import {
  ICutStrategy,
  StandardCutStrategy,
  JCutLCutStrategy,
  MatchCutStrategy
} from './ICutStrategy';
import { SmashCutStrategy } from './SmashCutStrategy';
import {
  ICompositorStrategy,
  PiPCompositorStrategy,
  SplitScreenCompositorStrategy
} from './ICompositorStrategy';

export class EditingOpFactory {
  private static cutStrategies: Map<string, ICutStrategy> = new Map<string, ICutStrategy>([
    ['standard_cut', new StandardCutStrategy()],
    ['j_cut', new JCutLCutStrategy('j_cut')],
    ['l_cut', new JCutLCutStrategy('l_cut')],
    ['match_cut', new MatchCutStrategy()],
    ['smash_cut', new SmashCutStrategy()],
  ]);

  private static compositorStrategies: Map<string, ICompositorStrategy> = new Map<string, ICompositorStrategy>([
    ['pip', new PiPCompositorStrategy()],
    ['split_screen', new SplitScreenCompositorStrategy('horizontal')],
    ['split_screen_vertical', new SplitScreenCompositorStrategy('vertical')],
  ]);

  public static getCutStrategy(strategyId: string, options?: Record<string, unknown>): ICutStrategy {
    if (strategyId === 'j_cut') {
      return new JCutLCutStrategy('j_cut', (options?.offsetMs as number) ?? 500);
    }
    if (strategyId === 'l_cut') {
      return new JCutLCutStrategy('l_cut', (options?.offsetMs as number) ?? 500);
    }

    const found = this.cutStrategies.get(strategyId);
    if (!found) {
      return this.cutStrategies.get('standard_cut')!;
    }
    return found;
  }

  public static getCompositorStrategy(strategyId: string, options?: Record<string, unknown>): ICompositorStrategy {
    if (strategyId === 'pip') {
      return new PiPCompositorStrategy(
        (options?.scale as number) ?? 0.35,
        (options?.corner as 'bottom_right' | 'top_right' | 'bottom_left' | 'top_left') ?? 'bottom_right'
      );
    }
    if (strategyId === 'split_screen') {
      return new SplitScreenCompositorStrategy(
        (options?.orientation as 'vertical' | 'horizontal') ?? 'horizontal'
      );
    }

    const found = this.compositorStrategies.get(strategyId);
    if (!found) {
      return this.compositorStrategies.get('pip')!;
    }
    return found;
  }

  public static registerCutStrategy(strategy: ICutStrategy): void {
    this.cutStrategies.set(strategy.id, strategy);
  }

  public static registerCompositorStrategy(strategy: ICompositorStrategy): void {
    this.compositorStrategies.set(strategy.id, strategy);
  }
}
