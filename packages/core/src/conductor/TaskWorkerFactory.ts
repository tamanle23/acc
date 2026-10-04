import { IConductorTaskCommand } from './interfaces/IConductorTaskCommand';

export class TaskWorkerFactory {
  private static registry = new Map<string, IConductorTaskCommand>();

  public static register(command: IConductorTaskCommand): void {
    this.registry.set(command.taskDefName, command);
  }

  public static getCommand(taskDefName: string): IConductorTaskCommand {
    const cmd = this.registry.get(taskDefName);
    if (!cmd) {
      throw new Error(`[TaskWorkerFactory] Unregistered Conductor task command: ${taskDefName}`);
    }
    return cmd;
  }

  public static getAllRegisteredTaskNames(): string[] {
    return Array.from(this.registry.keys());
  }
}
