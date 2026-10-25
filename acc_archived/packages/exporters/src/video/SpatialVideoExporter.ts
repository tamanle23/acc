export interface SpatialExportOptions {
  outputDir: string;
  eyeDisparityPx?: number; // Distance between left and right eyes in pixels (default 64)
  format?: 'side_by_side' | 'mv_hevc' | 'anaglyph';
  depthDisplacement?: boolean;
}

export class SpatialVideoExporter {
  /**
   * Generates FFmpeg filter chain for stereoscopic / spatial video rendering.
   * Supports side-by-side (SBS), Apple Vision Pro MV-HEVC packing, and anaglyph red-cyan.
   */
  public static generateStereoscopicFFmpegFilter(options: SpatialExportOptions): string {
    const disparity = options.eyeDisparityPx ?? 64;
    const format = options.format ?? 'side_by_side';

    switch (format) {
      case 'mv_hevc': {
        // Dual stream left/right eye packing with metadata tagging
        return `stereo3d=sbsl:sbsr,pad=w=iw*2:h=ih:x=${disparity}:y=0,tag:v=hvc1`;
      }
      case 'anaglyph': {
        return `stereo3d=sbsl:arcc`;
      }
      case 'side_by_side':
      default: {
        return `stereo3d=sbsl:sbsr,pad=w=iw*2:h=ih:x=${disparity}:y=0`;
      }
    }
  }
}
