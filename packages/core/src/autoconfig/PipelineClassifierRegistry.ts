import type {
  IPipelineClassifierStrategy,
  DiscoveredAssetManifest,
  PipelineResolutionResult,
} from './types';
import { ScraperSummarizerClassifierStrategy } from './classifiers/ScraperSummarizerClassifierStrategy';
import { DbTemplatingClassifierStrategy } from './classifiers/DbTemplatingClassifierStrategy';
import { RepurposingClassifierStrategy } from './classifiers/RepurposingClassifierStrategy';
import { GenerativeStoryClassifierStrategy } from './classifiers/GenerativeStoryClassifierStrategy';
import { RuleLogicClassifierStrategy } from './classifiers/RuleLogicClassifierStrategy';
import { AmbientLoopClassifierStrategy } from './classifiers/AmbientLoopClassifierStrategy';

export class PipelineClassifierRegistry {
  private static readonly strategies = new Map<string, IPipelineClassifierStrategy>();
  private static initialized = false;

  public static initialize(): void {
    if (this.initialized) return;

    this.register(new ScraperSummarizerClassifierStrategy());
    this.register(new DbTemplatingClassifierStrategy());
    this.register(new RepurposingClassifierStrategy());
    this.register(new GenerativeStoryClassifierStrategy());
    this.register(new RuleLogicClassifierStrategy());
    this.register(new AmbientLoopClassifierStrategy());

    this.initialized = true;
  }

  public static register(strategy: IPipelineClassifierStrategy): void {
    this.strategies.set(strategy.pipelineId, strategy);
  }

  public static get(pipelineId: string): IPipelineClassifierStrategy | undefined {
    this.initialize();

    // Support numeric ID ('1', '2') or canonical ID ('scraper-summarizer')
    const canonicalMap: Record<string, string> = {
      'scraper-summarizer': '1',
      'db-templating': '2',
      'repurposing-recycler': '3',
      'generative-storytelling': '4',
      'rule-logic': '5',
      'ambient-loops': '6',
    };

    const resolvedId = canonicalMap[pipelineId] || pipelineId;
    return this.strategies.get(resolvedId);
  }

  public static getOrThrow(pipelineId: string): IPipelineClassifierStrategy {
    const strategy = this.get(pipelineId);
    if (!strategy) {
      throw new Error(`[PipelineClassifierRegistry] Unrecognized pipelineId: ${pipelineId}`);
    }
    return strategy;
  }

  public static list(): IPipelineClassifierStrategy[] {
    this.initialize();
    return Array.from(this.strategies.values());
  }

  public static resolve(
    manifest: DiscoveredAssetManifest,
    overridePipelineId?: string
  ): PipelineResolutionResult {
    this.initialize();

    // 1. Manual User Override Handling
    if (overridePipelineId && overridePipelineId !== 'auto') {
      const explicit = this.getOrThrow(overridePipelineId);
      const defaults = explicit.generateArchetypeDefaults(manifest);
      return {
        strategy: explicit,
        confidence: 1.0,
        isOverride: true,
        defaults,
        allCandidates: [
          {
            pipelineId: explicit.pipelineId,
            name: explicit.name,
            confidence: 1.0,
          },
        ],
      };
    }

    // 2. Automated Multi-Strategy Scoring
    const candidates = Array.from(this.strategies.values()).map((strat) => {
      const confidence = strat.calculateConfidence(manifest);
      return {
        strategy: strat,
        pipelineId: strat.pipelineId,
        name: strat.name,
        confidence,
      };
    });

    // Sort descending by confidence
    candidates.sort((a, b) => b.confidence - a.confidence);

    // Fallback to Pipeline 4 (Storytelling) if all confidences are low
    const topCandidate = candidates[0];
    const winningStrategy =
      topCandidate && topCandidate.confidence > 0.1
        ? topCandidate.strategy
        : this.getOrThrow('4');

    const winningConfidence =
      topCandidate && topCandidate.confidence > 0.1 ? topCandidate.confidence : 0.5;

    const defaults = winningStrategy.generateArchetypeDefaults(manifest);

    return {
      strategy: winningStrategy,
      confidence: winningConfidence,
      isOverride: false,
      defaults,
      allCandidates: candidates.map((c) => ({
        pipelineId: c.pipelineId,
        name: c.name,
        confidence: c.confidence,
      })),
    };
  }
}
