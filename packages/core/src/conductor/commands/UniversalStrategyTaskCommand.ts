import { IConductorTaskCommand, ConductorTaskInput, ConductorTaskOutput } from '../interfaces/IConductorTaskCommand';
import { ConductorPipelineAdapter } from '../ConductorPipelineAdapter';
import { ContentStrategyRegistry } from '../strategies/ContentStrategyRegistry';
import { Logger } from '../../logger';

/**
 * UniversalStrategyTaskCommand:
 * Universal Atomic Conductor task command bridging the Conductor worker polling loop
 * dynamically to any of the 250 concrete IContentTaskStrategy implementations.
 */
export class UniversalStrategyTaskCommand implements IConductorTaskCommand {
  readonly taskDefName = 'acc.content.render_strategy';

  validate(input: ConductorTaskInput): void {
    const contentTypeId = input.inputData?.contentTypeId;
    if (!contentTypeId || typeof contentTypeId !== 'string') {
      throw new Error(
        `[UniversalStrategyTaskCommand] Missing or invalid contentTypeId in task inputData`
      );
    }

    const strategy = ContentStrategyRegistry.get(contentTypeId);
    if (!strategy) {
      throw new Error(
        `[UniversalStrategyTaskCommand] Strategy not found in ContentStrategyRegistry: ${contentTypeId}`
      );
    }
  }

  async execute(input: ConductorTaskInput): Promise<ConductorTaskOutput> {
    const contentTypeId = input.inputData.contentTypeId;
    const strategy = ContentStrategyRegistry.getOrThrow(contentTypeId);
    const ctx = ConductorPipelineAdapter.createContext(input);

    const modality = (strategy as any).defaultModality || (strategy as any).targetModality || 'video';

    Logger.info(
      'UniversalStrategyTaskCommand',
      `Dispatching task ${input.taskId} to strategy ${contentTypeId} [Pipeline ${strategy.pipelineId} -> ${modality}]`
    );

    const result = await strategy.process(ctx);

    return {
      status: 'COMPLETED',
      outputData: {
        contentTypeId,
        pipelineId: strategy.pipelineId,
        targetModality: modality,
        result,
      },
      logs: [
        `Executed strategy ${contentTypeId}`,
        `Target modality: ${modality}`,
      ],
    };
  }
}
