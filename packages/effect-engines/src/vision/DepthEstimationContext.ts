import {
  UniversalLogger as Logger,
  VisionEngineRegistry,
  DepthStrategyId,
  VisionDomain,
  type IDepthEstimationStrategy as IIsomorphicDepthStrategy,
  type VisionImageInput,
} from "@acc/core-isomorphic";
import type { IDepthEstimationStrategy, DepthOptions, DepthResult } from './types';
import { DepthAnythingV2SmallStrategy } from './strategies/depth/DepthAnythingV2SmallStrategy';
import { DepthAnythingV2BaseStrategy } from './strategies/depth/DepthAnythingV2BaseStrategy';
import { GlpnMetricStrategy } from './strategies/depth/GlpnMetricStrategy';
import { DptLargeStrategy } from './strategies/depth/DptLargeStrategy';
import { HeuristicDepthStrategy } from './strategies/depth/HeuristicDepthStrategy';

/**
 * DepthEstimationContext:
 * Backward-compatible facade managing depth estimation.
 * Delegates strategy registration and lifecycle to `VisionEngineRegistry`
 * while supporting legacy Node Buffer and modern typed input/output formats.
 */
export class DepthEstimationContext {
  private static instance: DepthEstimationContext | null = null;
  private currentStrategy: IDepthEstimationStrategy;
  private fallbackStrategy: HeuristicDepthStrategy;

  private constructor() {
    this.fallbackStrategy = new HeuristicDepthStrategy();
    if (VisionEngineRegistry.hasDepthStrategy(DepthStrategyId.DepthAnythingV2Small)) {
      this.currentStrategy = VisionEngineRegistry.getDepthStrategy(DepthStrategyId.DepthAnythingV2Small) as any;
    } else {
      this.currentStrategy = new DepthAnythingV2SmallStrategy();
    }
  }

  public static getInstance(): DepthEstimationContext {
    if (!DepthEstimationContext.instance) {
      DepthEstimationContext.instance = new DepthEstimationContext();
    }
    return DepthEstimationContext.instance;
  }

  public setStrategy(strategy: IDepthEstimationStrategy): void {
    this.currentStrategy = strategy;
    if ((strategy as any).id) {
      VisionEngineRegistry.registerDepthStrategy(strategy as any, true);
    }
  }

  public useStrategy(name: 'depth-anything-v2-small' | 'depth-anything-v2-base' | 'glpn-metric' | 'metric-depth' | 'dpt-large' | 'dpt' | 'heuristic' | string): void {
    switch (name.toLowerCase()) {
      case 'depth-anything-v2-base':
      case 'depth-anything-base':
      case 'v2-base':
        this.currentStrategy = new DepthAnythingV2BaseStrategy();
        break;
      case 'glpn-metric':
      case 'metric-depth':
      case 'metric':
      case 'glpn':
        this.currentStrategy = new GlpnMetricStrategy();
        break;
      case 'dpt-large':
      case 'dpt':
        this.currentStrategy = new DptLargeStrategy();
        break;
      case 'heuristic':
      case 'gradient':
        this.currentStrategy = this.fallbackStrategy;
        break;
      case 'depth-anything-v2-small':
      default:
        this.currentStrategy = new DepthAnythingV2SmallStrategy();
        break;
    }
  }

  public getActiveStrategy(): IDepthEstimationStrategy {
    return this.currentStrategy;
  }

  public getActiveStrategyName(): string {
    return this.currentStrategy.name;
  }

  public async estimateDepth(imageBuffer: Buffer | VisionImageInput, options?: DepthOptions): Promise<DepthResult> {
    try {
      return await this.currentStrategy.estimateDepth(imageBuffer as any, options);
    } catch (err) {
      Logger.warn('DepthEstimationContext', `Strategy [${this.currentStrategy.name}] failed, switching to defensive fallback:`, err);
      return await this.fallbackStrategy.estimateDepth(imageBuffer as any, options);
    }
  }
}
