import type { IScriptingFrameworkStrategy } from './IScriptingFrameworkStrategy';
import { MysteryBoxExplainerStrategy } from './MysteryBoxExplainerStrategy';
import { BreadcrumbTrailDigitalStrategy } from './BreadcrumbTrailDigitalStrategy';
import { StakesAndEscalationStrategy } from './StakesAndEscalationStrategy';
import { IntimateConfessionalStrategy } from './IntimateConfessionalStrategy';
import { HistoricalParallelsStrategy } from './HistoricalParallelsStrategy';
import { ContrarianThesisStrategy } from './ContrarianThesisStrategy';

/**
 * ScriptingFrameworkRegistry (GoF Registry Pattern)
 *
 * Central registry and heuristic resolver for Narrative Scripting Frameworks.
 * Enables CLI, AutoConfigEngineFacade, and PipelineIRBuilder to dynamically select
 * or auto-classify narrative structures based on style IDs, content keywords,
 * or explicit configuration flags.
 */
export class ScriptingFrameworkRegistry {
  private static instance: ScriptingFrameworkRegistry;
  private readonly strategies: Map<string, IScriptingFrameworkStrategy> = new Map();
  private readonly aliasMap: Map<string, string> = new Map();

  constructor() {
    this.registerDefaults();
  }

  public static getInstance(): ScriptingFrameworkRegistry {
    if (!ScriptingFrameworkRegistry.instance) {
      ScriptingFrameworkRegistry.instance = new ScriptingFrameworkRegistry();
    }
    return ScriptingFrameworkRegistry.instance;
  }

  private registerDefaults(): void {
    const defaultStrategies: IScriptingFrameworkStrategy[] = [
      new MysteryBoxExplainerStrategy(),
      new BreadcrumbTrailDigitalStrategy(),
      new StakesAndEscalationStrategy(),
      new IntimateConfessionalStrategy(),
      new HistoricalParallelsStrategy(),
      new ContrarianThesisStrategy(),
    ];

    for (const strat of defaultStrategies) {
      this.register(strat);
    }
  }

  public register(strategy: IScriptingFrameworkStrategy): void {
    const normalizedId = strategy.id.toLowerCase().trim();
    this.strategies.set(normalizedId, strategy);

    if (strategy.aliases) {
      for (const alias of strategy.aliases) {
        this.aliasMap.set(alias.toLowerCase().trim(), normalizedId);
      }
    }
  }

  public get(idOrAlias: string): IScriptingFrameworkStrategy | undefined {
    if (!idOrAlias) return undefined;
    const key = idOrAlias.toLowerCase().trim();

    if (this.strategies.has(key)) {
      return this.strategies.get(key);
    }

    const resolvedId = this.aliasMap.get(key);
    if (resolvedId && this.strategies.has(resolvedId)) {
      return this.strategies.get(resolvedId);
    }

    return undefined;
  }

  public getAll(): IScriptingFrameworkStrategy[] {
    return Array.from(this.strategies.values());
  }

  public resolveForStyle(styleId: string): IScriptingFrameworkStrategy {
    if (styleId) {
      const normalizedStyle = styleId.toLowerCase().trim();
      for (const strategy of this.strategies.values()) {
        if (
          strategy.targetStyles.some(
            (s) => s.toLowerCase() === normalizedStyle || normalizedStyle.includes(s.toLowerCase())
          )
        ) {
          return strategy;
        }
      }
    }

    // Default fallback
    return (
      this.get('mystery-box-explainer') ||
      this.getAll()[0] ||
      new MysteryBoxExplainerStrategy()
    );
  }

  public resolveForContent(
    topicOrContent: string,
    styleId?: string
  ): IScriptingFrameworkStrategy {
    // 1. If styleId matches directly, prioritize style alignment
    if (styleId) {
      const byStyle = this.resolveForStyle(styleId);
      if (byStyle) return byStyle;
    }

    const text = (topicOrContent || '').toLowerCase();

    // 2. Breadcrumb Trail / Digital
    if (
      /\b(code|terminal|bug|error|log|trace|audit|receipts|screenlife|reverse engineer|data|investigat)\b/.test(
        text
      )
    ) {
      const strat = this.get('breadcrumb-trail-digital');
      if (strat) return strat;
    }

    // 3. Stakes & Escalation / Challenge
    if (
      /\b(challenge|24 hours|timer|speedrun|rule|survive|gameplay|stakes|countdown|score)\b/.test(
        text
      )
    ) {
      const strat = this.get('stakes-and-escalation');
      if (strat) return strat;
    }

    // 4. Intimate Confessional
    if (
      /\b(honest|confession|behind the scenes|vulnerable|failure|personal|my story|lesson|talking head)\b/.test(
        text
      )
    ) {
      const strat = this.get('intimate-confessional');
      if (strat) return strat;
    }

    // 5. Historical Parallels
    if (
      /\b(history|ancient|century|precedent|timeline|rhyme|parallel|archival|origins|past)\b/.test(
        text
      )
    ) {
      const strat = this.get('historical-parallels');
      if (strat) return strat;
    }

    // 6. Contrarian Thesis
    if (
      /\b(lie|myth|wrong|contrarian|debunk|truth about|scam|illusion|paradigm|receipts|bubble)\b/.test(
        text
      )
    ) {
      const strat = this.get('contrarian-thesis');
      if (strat) return strat;
    }

    // Default fallback
    return (
      this.get('mystery-box-explainer') ||
      this.getAll()[0] ||
      new MysteryBoxExplainerStrategy()
    );
  }

  // Static conveniences
  public static get(idOrAlias: string): IScriptingFrameworkStrategy | undefined {
    return ScriptingFrameworkRegistry.getInstance().get(idOrAlias);
  }

  public static getAll(): IScriptingFrameworkStrategy[] {
    return ScriptingFrameworkRegistry.getInstance().getAll();
  }

  public static list(): IScriptingFrameworkStrategy[] {
    return this.getAll();
  }

  public static resolveForStyle(styleId: string): IScriptingFrameworkStrategy {
    return ScriptingFrameworkRegistry.getInstance().resolveForStyle(styleId);
  }

  public static resolveForContent(
    topicOrContent: string,
    styleId?: string
  ): IScriptingFrameworkStrategy {
    return ScriptingFrameworkRegistry.getInstance().resolveForContent(topicOrContent, styleId);
  }
}
