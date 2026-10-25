import { IConductorTaskCommand, ConductorTaskInput, ConductorTaskOutput, Logger } from '@acc/core';
import { BackendHypervisor } from '../hypervisor/BackendHypervisor.js';

export class TtsSynthesizeTaskCommand implements IConductorTaskCommand {
  public readonly taskDefName = 'acc.tts.synthesize_speech';
  private hypervisor: BackendHypervisor;

  constructor(hypervisor: BackendHypervisor) {
    this.hypervisor = hypervisor;
  }

  public validate(input: ConductorTaskInput): void {
    if (!input.inputData?.text) {
      throw new Error(`[${this.taskDefName}] Missing required field 'text' in inputData`);
    }
  }

  public async execute(input: ConductorTaskInput): Promise<ConductorTaskOutput> {
    Logger.info('TtsSynthesizeTaskCommand', `Synthesizing speech for task ${input.taskId}`);
    const text = input.inputData.text;
    const voiceId = input.inputData.voiceId || 'af_sky';

    const result = await this.hypervisor.dispatch('tts', {
      taskId: input.taskId,
      taskDefName: this.taskDefName,
      inputData: { text, voiceId },
    });

    return {
      status: result.success ? 'COMPLETED' : 'FAILED',
      outputData: {
        voiceId,
        sampleRate: result.data?.sampleRate || 24000,
        channels: result.data?.channels || 1,
        bytesLength: result.data?.audioBuffer ? result.data.audioBuffer.length : 0,
        fallback: result.data?.fallback ?? false,
      },
      logs: [`Speech synthesized successfully (taskId: ${input.taskId})`],
    };
  }
}
