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
  private static depthStrategies: Map<string, IDepthEstimationStrategy> = new Map();
  private static segmentationStrategies: Map<string, ISubjectSegmentationStrategy> = new Map();
  private static defaultDepthId: string = DepthStrategyId.Heuristic;
  private static defaultSegmentationId: string = SegmentationStrategyId.GrabCutFallback;

  /**
   * Normalizes strategy identifiers (e.g. trimming or lowercasing).
   */
  private static normalizeId(id: string): string {
    return id.toLowerCase().trim();
  }

  // --- Depth Estimation ---

  public static registerDepthStrategy(strategy: IDepthEstimationStrategy, isDefault: boolean = false): void {
    const norm = this.normalizeId(strategy.id);
    this.depthStrategies.set(norm, strategy);
    Logger.debug('VisionEngineRegistry', `Registered depth strategy: ${strategy.id} (${strategy.name})`);
    if (isDefault || this.depthStrategies.size === 1) {
      this.defaultDepthId = norm;
    }
  }

  public static hasDepthStrategy(id: DepthStrategyId | string): boolean {
    return this.depthStrategies.has(this.normalizeId(id));
  }

  public static getDepthStrategy(id?: DepthStrategyId | string): IDepthEstimationStrategy {
    const target = id ? this.normalizeId(id) : this.defaultDepthId;
    const strategy = this.depthStrategies.get(target);
    if (!strategy) {
      throw new VisionEngineError(
        VisionDomain.Depth,
        target,
        `No depth strategy registered with ID '${target}'. Available: ${Array.from(this.depthStrategies.keys()).join(', ')}`
      );
    }
    return strategy;
  }

  public static setDefaultDepthStrategy(id: DepthStrategyId | string): void {
    const norm = this.normalizeId(id);
    if (!this.depthStrategies.has(norm)) {
      Logger.warn('VisionEngineRegistry', `Setting default depth strategy to '${id}' before registration.`);
    }
    this.defaultDepthId = norm;
  }

  public static getDefaultDepthStrategyId(): string {
    return this.defaultDepthId;
  }

  public static getRegisteredDepthStrategies(): string[] {
    return Array.from(this.depthStrategies.keys());
  }

  // --- Subject Segmentation ---

  public static registerSegmentationStrategy(strategy: ISubjectSegmentationStrategy, isDefault: boolean = false): void {
    const norm = this.normalizeId(strategy.id);
    this.segmentationStrategies.set(norm, strategy);
    Logger.debug('VisionEngineRegistry', `Registered segmentation strategy: ${strategy.id} (${strategy.name})`);
    if (isDefault || this.segmentationStrategies.size === 1) {
      this.defaultSegmentationId = norm;
    }
  }

  public static hasSegmentationStrategy(id: SegmentationStrategyId | string): boolean {
    return this.segmentationStrategies.has(this.normalizeId(id));
  }

  public static getSegmentationStrategy(id?: SegmentationStrategyId | string): ISubjectSegmentationStrategy {
    const target = id ? this.normalizeId(id) : this.defaultSegmentationId;
    const strategy = this.segmentationStrategies.get(target);
    if (!strategy) {
      throw new VisionEngineError(
        VisionDomain.Segmentation,
        target,
        `No segmentation strategy registered with ID '${target}'. Available: ${Array.from(this.segmentationStrategies.keys()).join(', ')}`
      );
    }
    return strategy;
  }

  public static setDefaultSegmentationStrategy(id: SegmentationStrategyId | string): void {
    const norm = this.normalizeId(id);
    if (!this.segmentationStrategies.has(norm)) {
      Logger.warn('VisionEngineRegistry', `Setting default segmentation strategy to '${id}' before registration.`);
    }
    this.defaultSegmentationId = norm;
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
