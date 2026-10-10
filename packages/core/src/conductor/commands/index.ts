import { TaskWorkerFactory } from '../TaskWorkerFactory';
import { ComposeVideoTaskCommand } from './p4/ComposeVideoTaskCommand';
import { RenderBarChartRaceTaskCommand } from './p2/RenderBarChartRaceTaskCommand';
import { UniversalStrategyTaskCommand } from './UniversalStrategyTaskCommand';

export function registerAllConductorCommands() {
    TaskWorkerFactory.register(new ComposeVideoTaskCommand());
    TaskWorkerFactory.register(new RenderBarChartRaceTaskCommand());
    TaskWorkerFactory.register(new UniversalStrategyTaskCommand());
}
export * from './p4/ComposeVideoTaskCommand';
export * from './p2/RenderBarChartRaceTaskCommand';
export * from './UniversalStrategyTaskCommand';
