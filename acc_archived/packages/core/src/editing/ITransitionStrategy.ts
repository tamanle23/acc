export interface TransitionOptions {
  durationMs: number;
}

export interface ITransitionStrategy {
  readonly id: string;
  generateFFmpegXfadeFilter(
    streamA: string,
    streamB: string,
    outputStream: string,
    offsetSeconds: number,
    durationSeconds: number
  ): string;
}

export class XFadeTransition implements ITransitionStrategy {
  public readonly id: string;

  constructor(type = 'fade') {
    this.id = type;
  }

  public generateFFmpegXfadeFilter(
    streamA: string,
    streamB: string,
    outputStream: string,
    offsetSeconds: number,
    durationSeconds: number
  ): string {
    return `[${streamA}][${streamB}]xfade=transition=${this.id}:duration=${durationSeconds.toFixed(2)}:offset=${offsetSeconds.toFixed(2)}[${outputStream}]`;
  }
}

export class GlitchDissolveTransition implements ITransitionStrategy {
  public readonly id = 'glitch_dissolve';

  public generateFFmpegXfadeFilter(
    streamA: string,
    streamB: string,
    outputStream: string,
    offsetSeconds: number,
    durationSeconds: number
  ): string {
    return `[${streamA}][${streamB}]xfade=transition=pixelize:duration=${durationSeconds.toFixed(2)}:offset=${offsetSeconds.toFixed(2)}[${outputStream}]`;
  }
}
