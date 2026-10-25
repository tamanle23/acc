import type { PipelineIR } from '@acc/ir';

export interface ExportResult {
  exporterId: string;
  outputPath: string | string[];
  format: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ExportOptions {
  outputDir?: string;
  fileNamePrefix?: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  [key: string]: unknown;
}

export interface IExporter<TOptions extends ExportOptions = ExportOptions> {
  readonly id: string;
  export(ir: PipelineIR, options?: TOptions): Promise<ExportResult>;
}
