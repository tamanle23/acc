import { ISoundGenerator, ISmartRouter, ISmartRouterRule } from './interfaces';

export class CategoryMatchRule implements ISmartRouterRule {
  constructor(
    public readonly name: string,
    private categories: string[],
    private generatorSupplier: () => ISoundGenerator
  ) {}

  matches(effect: string): boolean {
    const eff = effect.toLowerCase().trim();
    return this.categories.some(c => c.toLowerCase() === eff);
  }

  getGenerator(_effect: string): ISoundGenerator {
    return this.generatorSupplier();
  }
}

export class SmartRouter implements ISmartRouter {
  private rules: ISmartRouterRule[] = [];
  private fallbackGenerator: ISoundGenerator;

  constructor(fallbackGenerator: ISoundGenerator) {
    this.fallbackGenerator = fallbackGenerator;
  }

  registerRule(rule: ISmartRouterRule): void {
    this.rules.push(rule);
  }

  route(effect: string): ISoundGenerator {
    const eff = effect.toLowerCase().trim();
    for (const rule of this.rules) {
      if (rule.matches(eff)) {
        console.log(`[SmartRouter] Rule '${rule.name}' matched for '${eff}'`);
        return rule.getGenerator(eff);
      }
    }
    console.log(`[SmartRouter] Route '${eff}' (Unrecognized) -> Fallback Engine`);
    return this.fallbackGenerator;
  }
}
