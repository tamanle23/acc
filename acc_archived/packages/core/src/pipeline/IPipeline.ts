import { PipelineRunner } from '../PipelineRunner';
import { UnifiedPipelineContext } from './UnifiedPipelineContext';

export interface PipelineExecutionOptions {
  outDir?: string;
  dryRun?: boolean;
  format?: 'mp4' | 'mkv' | 'mov' | 'webm' | string;
  targetAspectRatio?: '16:9' | '9:16' | '1:1';
  exporters?: string[];
  rtmpUrl?: string;
  concurrencyLimit?: number;
  [key: string]: any;
}

export interface IPipeline<TInput = any, TOutput = any> {
  readonly id: string;
  readonly name: string;
  readonly description?: string;

  /**
   * Constructs the configured middleware pipeline runner.
   */
  buildRunner(): PipelineRunner<UnifiedPipelineContext<TInput>>;

  /**
   * Executes the entire pipeline through the orchestrator.
   */
  execute(input: TInput, options?: PipelineExecutionOptions): Promise<UnifiedPipelineContext<TInput>>;
}
