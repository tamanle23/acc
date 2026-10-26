import {
  VisionDomain,
  DepthStrategyId,
  SegmentationStrategyId,
  IDepthEstimationStrategy,
  ISubjectSegmentationStrategy,
  VisionEngineError,
} from './types';
import { UniversalLogger as Logger } from '../logger';

/**
 * VisionEngineRegistry:
 * Unified isomorphic registry for AI and algorithmic vision engines
 * (Depth Estimation, Subject Segmentation, Matting, Saliency).
 *
 * Coordinates seamlessly with UniversalCanvasProvider, MediaEngineRegistry,
 * and ContentCacheRegistry across client and server environments.
 */
export class VisionEngineRegistry {
  private static depthStrategies: Map<DepthStrategyId, IDepthEstimationStrategy> = new Map();
  private static segmentationStrategies: Map<SegmentationStrategyId, ISubjectSegmentationStrategy> = new Map();
  private static defaultDepthId: string = DepthStrategyId.Heuristic;
  private static defaultSegmentationId: string = SegmentationStrategyId.GrabCutFallback;

  // --- Depth Estimation ---

  public static registerDepthStrategy(strategy: IDepthEstimationStrategy, isDefault: boolean = false): void {
    this.depthStrategies.set(strategy.id, strategy);
    Logger.debug('VisionEngineRegistry', `Registered depth strategy: ${strategy.id} (${strategy.name})`);
    if (isDefault || this.depthStrategies.size === 1) {
      this.defaultDepthId = strategy.id;
    }
  }

  public static hasDepthStrategy(id: DepthStrategyId): boolean {
    return this.depthStrategies.has(id);
  }

  public static getDepthStrategy(id: DepthStrategyId): IDepthEstimationStrategy {
    const strategy = this.depthStrategies.get(id);
    if (!strategy) {
      throw new VisionEngineError(
        VisionDomain.Depth,
        id,
        `No depth strategy registered with ID '${id}'. Available: ${Array.from(this.depthStrategies.keys()).join(', ')}`
      );
    }
    return strategy;
  }

  public static setDefaultDepthStrategy(id: DepthStrategyId): void {
    if (!this.depthStrategies.has(id)) {
      Logger.warn('VisionEngineRegistry', `Setting default depth strategy to '${id}' before registration.`);
    }
    this.defaultDepthId = id;
  }

  public static getDefaultDepthStrategyId(): string {
    return this.defaultDepthId;
  }

  public static getRegisteredDepthStrategies(): string[] {
    return Array.from(this.depthStrategies.keys());
  }

  // --- Subject Segmentation ---

  public static registerSegmentationStrategy(strategy: ISubjectSegmentationStrategy, isDefault: boolean = false): void {
    this.segmentationStrategies.set(strategy.id, strategy);
    Logger.debug('VisionEngineRegistry', `Registered segmentation strategy: ${strategy.id} (${strategy.name})`);
    if (isDefault || this.segmentationStrategies.size === 1) {
      this.defaultSegmentationId = strategy.id;
    }
  }

  public static hasSegmentationStrategy(id: SegmentationStrategyId): boolean {
    return this.segmentationStrategies.has(id);
  }

  public static getSegmentationStrategy(id: SegmentationStrategyId): ISubjectSegmentationStrategy {
    const strategy = this.segmentationStrategies.get(id);
    if (!strategy) {
      throw new VisionEngineError(
        VisionDomain.Segmentation,
        id,
        `No segmentation strategy registered with ID '${id}'. Available: ${Array.from(this.segmentationStrategies.keys()).join(', ')}`
      );
    }
    return strategy;
  }

  public static setDefaultSegmentationStrategy(id: SegmentationStrategyId): void {
    if (!this.segmentationStrategies.has(id)) {
      Logger.warn('VisionEngineRegistry', `Setting default segmentation strategy to '${id}' before registration.`);
    }
    this.defaultSegmentationId = id;
  }

  public static getDefaultSegmentationStrategyId(): string {
    return this.defaultSegmentationId;
  }

  public static getRegisteredSegmentationStrategies(): string[] {
    return Array.from(this.segmentationStrategies.keys());
  }

  // --- Lifecycle & Testing Management ---

  public static unregisterAll(): void {
    this.depthStrategies.clear();
    this.segmentationStrategies.clear();
    this.defaultDepthId = DepthStrategyId.Heuristic;
    this.defaultSegmentationId = SegmentationStrategyId.GrabCutFallback;
  }

  public static reset(): void {
    this.unregisterAll();
  }
}
