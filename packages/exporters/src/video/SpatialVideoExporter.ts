import type { ExtendedPipelineIR } from '@acc/ir';

export interface SpatialExportOptions {
  outputDir: string;
  eyeDisparityPx?: number; // Distance between left and right eyes in pixels (default 64)
}

export class SpatialVideoExporter {
  public static generateStereoscopicFFmpegFilter(options: SpatialExportOptions): string {
    const disparity = options.eyeDisparityPx ?? 64;
    // Side-by-side stereoscopic 3D frame arrangement for Apple Vision Pro / Meta Quest
    return `stereo3d=sbsl:sbsr,pad=w=iw*2:h=ih:x=${disparity}:y=0`;
  }
}
