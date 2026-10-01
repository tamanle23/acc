import type { ISegmentationStrategy, SegmentationOptions, SegmentationResult } from './types';
import { SlimSamStrategy } from './strategies/segmentation/SlimSamStrategy';
import { SamVitBaseStrategy } from './strategies/segmentation/SamVitBaseStrategy';
import { GrabCutFallbackStrategy } from './strategies/segmentation/GrabCutFallbackStrategy';

export class SubjectSegmentationContext {
  private static instance: SubjectSegmentationContext | null = null;
  private currentStrategy: ISegmentationStrategy;
  private fallbackStrategy: GrabCutFallbackStrategy;

  private constructor() {
    this.fallbackStrategy = new GrabCutFallbackStrategy();
    // Default strategy: SlimSAM (fast, 38MB)
    this.currentStrategy = new SlimSamStrategy();
  }

  public static getInstance(): SubjectSegmentationContext {
    if (!SubjectSegmentationContext.instance) {
      SubjectSegmentationContext.instance = new SubjectSegmentationContext();
    }
    return SubjectSegmentationContext.instance;
  }

  public setStrategy(strategy: ISegmentationStrategy): void {
    this.currentStrategy = strategy;
  }

  public useStrategy(name: 'slimsam' | 'sam-vit-base' | 'grabcut' | string): void {
    switch (name.toLowerCase()) {
      case 'sam-vit-base':
      case 'vit-b':
        this.currentStrategy = new SamVitBaseStrategy();
        break;
      case 'grabcut':
      case 'fallback':
        this.currentStrategy = this.fallbackStrategy;
        break;
      case 'slimsam':
      default:
        this.currentStrategy = new SlimSamStrategy();
        break;
    }
  }

  public getActiveStrategy(): ISegmentationStrategy {
    return this.currentStrategy;
  }

  public getActiveStrategyName(): string {
    return this.currentStrategy.name;
  }

  public async segment(imageBuffer: Buffer, options?: SegmentationOptions): Promise<SegmentationResult> {
    try {
      return await this.currentStrategy.segment(imageBuffer, options);
    } catch (err) {
      console.warn(`[SubjectSegmentationContext] Strategy [${this.currentStrategy.name}] failed, switching to defensive fallback:`, err);
      return await this.fallbackStrategy.segment(imageBuffer, options);
    }
  }
}
