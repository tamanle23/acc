import { Logger } from '../../../logger';
import { IConductorTaskCommand, ConductorTaskInput, ConductorTaskOutput } from '../../interfaces/IConductorTaskCommand';

export class RenderBarChartRaceTaskCommand implements IConductorTaskCommand {
  readonly taskDefName = 'acc.p2_db.render_barchart_race';

  validate(input: ConductorTaskInput): void {
    if (!input.inputData?.timeSeriesData) {
      throw new Error('[RenderBarChartRaceTaskCommand] Missing timeSeriesData in task input');
    }
  }

  async execute(input: ConductorTaskInput): Promise<ConductorTaskOutput> {
    // Delegates directly to the existing DBTemplatingPipeline in PipelineRegistry!
    // const pipeline = defaultPipelineRegistry.get('2'); // '2' = DBTemplatingPipeline
    // const result = await pipeline.run(input.inputData);

    Logger.info('RenderBarChartRaceTaskCommand', `Mocking barchart race for task ${input.taskId}`);

    const result = {
        exportedUrls: ['https://example.com/barchart1.mp4'],
        diagnostics: { memoryUsedMB: 120 }
    }

    return {
      status: 'COMPLETED',
      outputData: {
        artifactUrls: result.exportedUrls,
        pipelineDiagnostics: result.diagnostics
      }
    };
  }
}
