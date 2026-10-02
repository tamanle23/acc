import type { ExtendedPipelineIR } from '@acc/ir';

export interface FacadeRenderOptions {
  outputDir?: string;
  platform?: 'tiktok' | 'youtube' | 'reels' | 'shorts';
  gpuAcceleration?: boolean;
}

export interface FacadeRenderResult {
  jobId: string;
  outputPath: string;
  durationMs: number;
  totalFrames: number;
  format: string;
}

export class EditingEngineFacade {
  public async renderTimeline(
    ir: ExtendedPipelineIR,
    options: FacadeRenderOptions = {}
  ): Promise<FacadeRenderResult> {
    const outputDir = options.outputDir || '/tmp/acc_exports';
    const container = ir.settings.platform === 'tiktok' ? 'mp4' : 'mp4';
    const outputPath = `${outputDir}/${ir.metadata.jobId}.${container}`;

    const durationMs = ir.extendedChunks.reduce((acc, c) => acc + c.durationMs, 0);
    const fps = ir.settings.fps || 30;
    const totalFrames = Math.max(1, Math.ceil((durationMs * fps) / 1000));

    return {
      jobId: ir.metadata.jobId,
      outputPath,
      durationMs,
      totalFrames,
      format: container,
    };
  }
}
