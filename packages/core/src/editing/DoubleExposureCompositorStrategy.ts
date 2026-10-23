export type BlendModeType = 'screen' | 'lighten' | 'multiply' | 'overlay' | 'soft-light';

export class DoubleExposureCompositorStrategy {
  public static applyDoubleExposureBlend(
    ctx: any,
    blendMode: BlendModeType = 'screen',
    opacity = 0.8
  ): void {
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = blendMode === 'screen' ? 'screen' : blendMode;
  }

  public static generateFFmpegBlendFilter(
    baseStream = 'v0',
    overlayStream = 'v1',
    outputStream = 'v_blend',
    mode: BlendModeType = 'screen'
  ): string {
    const ffMode = mode === 'screen' ? 'screen' : mode === 'multiply' ? 'multiply' : 'overlay';
    return `[${baseStream}][${overlayStream}]blend=all_mode='${ffMode}'[${outputStream}]`;
  }
}
