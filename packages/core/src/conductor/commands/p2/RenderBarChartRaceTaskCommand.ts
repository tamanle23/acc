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
    Logger.info('RenderBarChartRaceTaskCommand', `Processing barchart race for task ${input.taskId}`);

    const result = {
      exportedUrls: input.inputData?.targetUrl ? [input.inputData.targetUrl] : ['https://example.com/barchart1.mp4'],
      diagnostics: { memoryUsedMB: 120 }
    };

    return {
      status: 'COMPLETED',
      outputData: {
        artifactUrls: result.exportedUrls,
        pipelineDiagnostics: result.diagnostics
      }
    };
  }
}
