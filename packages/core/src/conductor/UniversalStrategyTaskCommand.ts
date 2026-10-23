import { IConductorTaskCommand, ConductorTaskInput, ConductorTaskOutput } from './interfaces/IConductorTaskCommand';
import { ContentStrategyRegistry } from './strategies/ContentStrategyRegistry';
import { createUnifiedPipelineContext } from '../pipeline/UnifiedPipelineContext';
import { UniversalLogger as Logger } from '@acc/core-isomorphic';

export class UniversalStrategyTaskCommand implements IConductorTaskCommand {
  public readonly taskDefName = 'acc.content.render_strategy';

  public validate(input: ConductorTaskInput): void {
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

  public async execute(input: ConductorTaskInput): Promise<ConductorTaskOutput> {
    const contentTypeId = input.inputData.contentTypeId;
    const strategy = ContentStrategyRegistry.getOrThrow(contentTypeId);

    const ctx = createUnifiedPipelineContext({
      pipelineId: strategy.pipelineId,
      input: input.inputData,
      metadata: {
        taskId: input.taskId,
        workflowInstanceId: input.workflowInstanceId,
        taskDefName: input.taskDefName,
      },
    });

    Logger.info(
      'UniversalStrategyTaskCommand',
      `Dispatching task ${input.taskId} to strategy ${contentTypeId} [Pipeline ${strategy.pipelineId} -> ${strategy.defaultModality}]`
    );

    const result = await strategy.process(ctx);

    return {
      status: 'COMPLETED',
      outputData: {
        contentTypeId,
        pipelineId: strategy.pipelineId,
        targetModality: strategy.defaultModality,
        result: {
          ...result,
          videoIRDoc: result.deliverables?.video?.videoIRDoc,
        },
      },
      logs: [
        `Executed strategy ${contentTypeId}`,
        `Target modality: ${strategy.defaultModality}`,
      ],
    };
  }
}
