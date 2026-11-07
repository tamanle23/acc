import { type DagNodeType } from '../../canvas/dag-node';
import { type MultiBranchStrategy } from './types';

export class MultiBranchRegistry {
  private readonly strategies = new Map<DagNodeType, MultiBranchStrategy>();

  register(strategy: MultiBranchStrategy): void {
    this.strategies.set(strategy.taskType, strategy);
  }

  get(taskType?: DagNodeType): MultiBranchStrategy | undefined {
    if (!taskType) return undefined;
    return this.strategies.get(taskType);
  }

  supports(taskType?: DagNodeType): boolean {
    if (!taskType) return false;
    return this.strategies.has(taskType);
  }

  getAll(): MultiBranchStrategy[] {
    return Array.from(this.strategies.values());
  }

  clear(): void {
    this.strategies.clear();
  }
}

export const multiBranchRegistry = new MultiBranchRegistry();
