import type { PipelineIR, ExtendedPipelineIR } from '@acc/ir';
import type { MultiExportResults } from '@acc/exporters';
import { AssetContext } from '../AssetContext';
import { VFXCommand } from '../VFXCommand';
import type { PipelineContext } from '../PipelineRunner';

export interface StageError {
  stage: string;
  error: Error;
  timestamp: string;
  recoveredWithFallback?: boolean;
}

export interface UnifiedPipelineContext<TInput = any> extends PipelineContext {
  pipelineId: string;
  executionId: string;
  outDir: string;
  dryRun?: boolean;

  input: TInput;
  ir?: PipelineIR | ExtendedPipelineIR;
  exportResults?: MultiExportResults;
  
  timings: Record<string, number>;
}

export function createUnifiedPipelineContext<TInput = any>(params: {
  pipelineId: string;
  executionId?: string;
  baseDir?: string;
  outDir?: string;
  input: TInput;
  dryRun?: boolean;
  metadata?: Record<string, any>;
}): UnifiedPipelineContext<TInput> {
  const executionId = params.executionId || `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const baseDir = params.baseDir || process.cwd();
  const outDir = params.outDir || baseDir;

  return {
    pipelineId: params.pipelineId,
    executionId,
    storyId: executionId,
    baseDir,
    outDir,
    dryRun: params.dryRun ?? false,
    input: params.input,
    assets: new AssetContext(),
    vfxQueue: [],
    metadata: params.metadata || {},
    errors: [],
    timings: {},
  };
}
