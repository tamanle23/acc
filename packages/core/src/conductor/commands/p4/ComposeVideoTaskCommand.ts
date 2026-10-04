import { IConductorTaskCommand, ConductorTaskInput, ConductorTaskOutput } from '../../interfaces/IConductorTaskCommand';
import { ConductorPipelineAdapter } from '../../ConductorPipelineAdapter';

export class ComposeVideoTaskCommand implements IConductorTaskCommand {
  readonly taskDefName = 'acc.p4_story.compose_video';

  validate(input: ConductorTaskInput): void {
    if (!input.inputData?.storyConfig) {
      throw new Error('[ComposeVideoTaskCommand] Missing storyConfig in task inputData');
    }
  }

  async execute(input: ConductorTaskInput): Promise<ConductorTaskOutput> {
    const ctx = ConductorPipelineAdapter.createContext(input);
    const storyIR = input.inputData.storyConfig as any;

    // Simulate orchestrator execution for the example
    console.log(`[ComposeVideoTaskCommand] Mocking video edit orchestration for ${ctx.metadata.workflowInstanceId}`);

    // In a real implementation:
    // const orchestrator = new VideoEditPipelineOrchestrator();
    // const renderResult = await orchestrator.executeIR(storyIR, ctx);

    const renderResult = {
        outputFilePath: `/tmp/conductor_output_${ctx.metadata.workflowInstanceId}.mp4`,
        durationSeconds: 15.5,
        renderedScenesCount: 3
    };

    return {
      status: 'COMPLETED',
      outputData: {
        videoPath: renderResult.outputFilePath,
        durationSeconds: renderResult.durationSeconds,
        renderedScenesCount: renderResult.renderedScenesCount
      }
    };
  }
}
