import { UnifiedPipelineContext } from '../pipeline/UnifiedPipelineContext';
import { AssetContext } from '../AssetContext';
import { ConductorTaskInput } from './interfaces/IConductorTaskCommand';

export class ConductorPipelineAdapter {
  /**
   * Adapts a raw Conductor task input payload into a strongly-typed UnifiedPipelineContext
   */
  public static createContext<TInput>(taskInput: ConductorTaskInput<TInput>): UnifiedPipelineContext<TInput> {
    const assetContext = new AssetContext({
      storyId: taskInput.workflowInstanceId,
      workDir: `./scratch/conductor/${taskInput.workflowInstanceId}/${taskInput.taskId}`
    });

    return {
      input: taskInput.inputData,
      assetContext,
      metadata: {
        taskId: taskInput.taskId,
        workflowInstanceId: taskInput.workflowInstanceId,
        taskDefName: taskInput.taskDefName,
        startTime: Date.now()
      },
      outputs: {}
    };
  }
}
