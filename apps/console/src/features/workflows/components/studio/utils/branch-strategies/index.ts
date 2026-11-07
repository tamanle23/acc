import { multiBranchRegistry } from './multi-branch-registry';
import { SwitchBranchStrategy } from './strategies/switch-branch-strategy';
import { ForkJoinBranchStrategy } from './strategies/fork-join-branch-strategy';
import { DoWhileBranchStrategy } from './strategies/do-while-branch-strategy';

export * from './types';
export * from './multi-branch-registry';
export * from './strategies/switch-branch-strategy';
export * from './strategies/fork-join-branch-strategy';
export * from './strategies/do-while-branch-strategy';

// Self-registering standard multi-branch strategies
multiBranchRegistry.register(new SwitchBranchStrategy());
multiBranchRegistry.register(new ForkJoinBranchStrategy());
multiBranchRegistry.register(new DoWhileBranchStrategy());
