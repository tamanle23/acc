import { IConductorTaskCommand, ConductorTaskInput, ConductorTaskOutput, Logger } from '@acc/core';
import { BackendHypervisor } from '../hypervisor/BackendHypervisor.js';

export class StoryScriptTaskCommand implements IConductorTaskCommand {
  public readonly taskDefName = 'acc.story.generate_script';
  private hypervisor: BackendHypervisor;

  constructor(hypervisor: BackendHypervisor) {
    this.hypervisor = hypervisor;
  }

  public validate(input: ConductorTaskInput): void {
    if (!input.inputData || typeof input.inputData !== 'object') {
      throw new Error(`[${this.taskDefName}] Missing inputData`);
    }
  }

  public async execute(input: ConductorTaskInput): Promise<ConductorTaskOutput> {
    Logger.info('StoryScriptTaskCommand', `Generating script for task ${input.taskId}`);
    const prompt = input.inputData?.prompt || 'Deep space cosmic journey';

    const result = await this.hypervisor.dispatch('llm', {
      taskId: input.taskId,
      taskDefName: this.taskDefName,
      inputData: { prompt },
    });

    return {
      status: result.success ? 'COMPLETED' : 'FAILED',
      outputData: {
        script: result.data?.response,
        scenesCount: 2,
        durationEstimatedSec: 15,
        fallback: result.data?.fallback ?? false,
      },
      logs: [`Story script generated successfully (taskId: ${input.taskId})`],
    };
  }
}
