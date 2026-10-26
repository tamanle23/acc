import {
  UniversalLogger as Logger,
  VisionEngineRegistry,
  SegmentationStrategyId,
  VisionDomain,
  type ISubjectSegmentationStrategy as IIsomorphicSegmentationStrategy,
  type VisionImageInput,
} from "@acc/core-isomorphic";
import type { ISegmentationStrategy, SegmentationOptions, SegmentationResult } from './types';
import { SlimSamStrategy } from './strategies/segmentation/SlimSamStrategy';
import { SamVitBaseStrategy } from './strategies/segmentation/SamVitBaseStrategy';
import { Sam2TinyStrategy } from './strategies/segmentation/Sam2TinyStrategy';
import { RmbgStrategy } from './strategies/segmentation/RmbgStrategy';
import { BiRefNetStrategy } from './strategies/segmentation/BiRefNetStrategy';
import { GrabCutFallbackStrategy } from './strategies/segmentation/GrabCutFallbackStrategy';

/**
 * SubjectSegmentationContext:
 * Backward-compatible facade managing subject segmentation.
 * Delegates strategy registration and lifecycle to `VisionEngineRegistry`
 * while supporting legacy Node Buffer and modern typed input/output formats.
 */
export class SubjectSegmentationContext {
  private static instance: SubjectSegmentationContext | null = null;
  private currentStrategy: ISegmentationStrategy;
  private fallbackStrategy: GrabCutFallbackStrategy;

  private constructor() {
    this.fallbackStrategy = new GrabCutFallbackStrategy();
    if (VisionEngineRegistry.hasSegmentationStrategy(SegmentationStrategyId.Rmbg14)) {
      this.currentStrategy = VisionEngineRegistry.getSegmentationStrategy(SegmentationStrategyId.Rmbg14) as any;
    } else {
      this.currentStrategy = new RmbgStrategy();
    }
  }

  public static getInstance(): SubjectSegmentationContext {
    if (!SubjectSegmentationContext.instance) {
      SubjectSegmentationContext.instance = new SubjectSegmentationContext();
    }
    return SubjectSegmentationContext.instance;
  }

  public setStrategy(strategy: ISegmentationStrategy): void {
    this.currentStrategy = strategy;
    if ((strategy as any).id) {
      VisionEngineRegistry.registerSegmentationStrategy(strategy as any, true);
    }
  }

  public useStrategy(name: 'rmbg-1.4' | 'birefnet-general' | 'sam2-tiny' | 'sam-vit-base' | 'slimsam' | 'grabcut' | string): void {
    switch (name.toLowerCase()) {
      case 'birefnet':
      case 'birefnet-general':
      case 'birefnet-lite':
        this.currentStrategy = new BiRefNetStrategy();
        break;
      case 'sam2-tiny':
      case 'sam2':
      case 'sam2.1':
        this.currentStrategy = new Sam2TinyStrategy();
        break;
      case 'sam-vit-base':
      case 'vit-b':
        this.currentStrategy = new SamVitBaseStrategy();
        break;
      case 'slimsam':
        this.currentStrategy = new SlimSamStrategy();
        break;
      case 'grabcut':
      case 'fallback':
        this.currentStrategy = this.fallbackStrategy;
        break;
      case 'rmbg':
      case 'rmbg-1.4':
      case 'briaai':
      default:
        this.currentStrategy = new RmbgStrategy();
        break;
    }
  }

  public getActiveStrategy(): ISegmentationStrategy {
    return this.currentStrategy;
  }

  public getActiveStrategyName(): string {
    return this.currentStrategy.name;
  }

  public async segment(imageBuffer: Buffer | VisionImageInput, options?: SegmentationOptions): Promise<SegmentationResult> {
    try {
      return await this.currentStrategy.segment(imageBuffer as any, options);
    } catch (err) {
      Logger.warn('SubjectSegmentationContext', `Strategy [${this.currentStrategy.name}] failed, switching to defensive fallback:`, err);
      return await this.fallbackStrategy.segment(imageBuffer as any, options);
    }
  }
}
