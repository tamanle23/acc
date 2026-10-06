import { Logger } from "@acc/core";
import type { IDepthEstimationStrategy, DepthOptions, DepthResult } from './types';
import { DepthAnythingV2SmallStrategy } from './strategies/depth/DepthAnythingV2SmallStrategy';
import { DepthAnythingV2BaseStrategy } from './strategies/depth/DepthAnythingV2BaseStrategy';
import { GlpnMetricStrategy } from './strategies/depth/GlpnMetricStrategy';
import { DptLargeStrategy } from './strategies/depth/DptLargeStrategy';
import { HeuristicDepthStrategy } from './strategies/depth/HeuristicDepthStrategy';

export class DepthEstimationContext {
  private static instance: DepthEstimationContext | null = null;
  private currentStrategy: IDepthEstimationStrategy;
  private fallbackStrategy: HeuristicDepthStrategy;

  private constructor() {
    this.fallbackStrategy = new HeuristicDepthStrategy();
    // Default: Depth Anything v2 Small (95MB)
    this.currentStrategy = new DepthAnythingV2SmallStrategy();
  }

  public static getInstance(): DepthEstimationContext {
    if (!DepthEstimationContext.instance) {
      DepthEstimationContext.instance = new DepthEstimationContext();
    }
    return DepthEstimationContext.instance;
  }

  public setStrategy(strategy: IDepthEstimationStrategy): void {
    this.currentStrategy = strategy;
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

  public async estimateDepth(imageBuffer: Buffer, options?: DepthOptions): Promise<DepthResult> {
    try {
      return await this.currentStrategy.estimateDepth(imageBuffer, options);
    } catch (err) {
      Logger.warn('DepthEstimationContext', `Strategy [${this.currentStrategy.name}] failed, switching to defensive fallback:`, err);
      return await this.fallbackStrategy.estimateDepth(imageBuffer, options);
    }
  }
}
