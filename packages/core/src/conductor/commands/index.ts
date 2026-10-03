import { TaskWorkerFactory } from '../TaskWorkerFactory';
import { ComposeVideoTaskCommand } from './p4/ComposeVideoTaskCommand';
import { RenderBarChartRaceTaskCommand } from './p2/RenderBarChartRaceTaskCommand';

export function registerAllConductorCommands() {
    TaskWorkerFactory.register(new ComposeVideoTaskCommand());
    TaskWorkerFactory.register(new RenderBarChartRaceTaskCommand());
}
