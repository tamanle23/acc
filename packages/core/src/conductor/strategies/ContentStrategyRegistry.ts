import type { IContentTaskStrategy } from '../interfaces/IContentTaskStrategy';

/**
 * ContentStrategyRegistry:
 * Thread-safe central registry indexing all 250 concrete content variations
 * by unique contentTypeId, pipelineId ('1' - '6'), and targetModality.
 */
export class ContentStrategyRegistry {
  private static strategies = new Map<string, IContentTaskStrategy<any, any>>();

  public static register(strategy: IContentTaskStrategy<any, any>): void {
    if (this.strategies.has(strategy.contentTypeId)) {
      throw new Error(
        `[ContentStrategyRegistry] Duplicate registration for strategy: ${strategy.contentTypeId}`
      );
    }
    this.strategies.set(strategy.contentTypeId, strategy);
  }

  public static registerAll(strategies: IContentTaskStrategy<any, any>[]): void {
    for (const s of strategies) {
      this.register(s);
    }
  }

  public static get(contentTypeId: string): IContentTaskStrategy<any, any> | undefined {
    return this.strategies.get(contentTypeId);
  }

  public static getOrThrow(contentTypeId: string): IContentTaskStrategy<any, any> {
    const strategy = this.get(contentTypeId);
    if (!strategy) {
      throw new Error(
        `[ContentStrategyRegistry] Content strategy not found for contentTypeId: ${contentTypeId}`
      );
    }
    return strategy;
  }

  public static getByPipeline(pipelineId: string): IContentTaskStrategy<any, any>[] {
    return Array.from(this.strategies.values()).filter((s) => s.pipelineId === pipelineId);
  }

  public static getByModality(modality: string): IContentTaskStrategy<any, any>[] {
    return Array.from(this.strategies.values()).filter((s) => {
      const defMod = (s as any).defaultModality || (s as any).targetModality;
      const supp = (s as any).supportedModalities;
      return defMod === modality || (Array.isArray(supp) && supp.includes(modality));
    });
  }

  public static getAll(): IContentTaskStrategy<any, any>[] {
    return Array.from(this.strategies.values());
  }

  public static count(): number {
    return this.strategies.size;
  }

  public static clear(): void {
    this.strategies.clear();
  }
}
