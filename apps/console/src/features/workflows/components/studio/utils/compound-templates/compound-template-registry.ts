import { type DagNodeType } from '../../canvas/dag-node';
import { type CompoundTemplateFactory, type CompoundTemplateOptions, type CompoundTemplateResult } from './types';
import { ForkJoinTemplateFactory } from './factories/fork-join-template';
import { SwitchTemplateFactory } from './factories/switch-template';
import { DoWhileTemplateFactory } from './factories/do-while-template';
import { HumanTemplateFactory } from './factories/human-template';
import { SagaTemplateFactory } from './factories/saga-template';

export class CompoundTemplateRegistry {
  private factories: CompoundTemplateFactory[] = [];

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    this.register(new ForkJoinTemplateFactory());
    this.register(new SwitchTemplateFactory());
    this.register(new DoWhileTemplateFactory());
    this.register(new HumanTemplateFactory());
    this.register(new SagaTemplateFactory());
  }

  register(factory: CompoundTemplateFactory): void {
    this.factories.unshift(factory);
  }

  isCompound(type: DagNodeType, options?: CompoundTemplateOptions): boolean {
    return this.factories.some((f) => f.supports(type));
  }

  create(
    type: DagNodeType,
    basePos: { x: number; y: number },
    options?: CompoundTemplateOptions
  ): CompoundTemplateResult | null {
    const factory = this.factories.find((f) => f.supports(type));
    if (!factory) return null;
    return factory.create(basePos, options);
  }
}

export const compoundTemplateRegistry = new CompoundTemplateRegistry();
