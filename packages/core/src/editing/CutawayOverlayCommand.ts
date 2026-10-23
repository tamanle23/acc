export interface CutawayOverlaySpec {
  primaryClipId: string;
  brollSourcePath: string;
  startMs: number;
  durationMs: number;
}

export class CutawayOverlayCommand {
  private spec: CutawayOverlaySpec;

  constructor(spec: CutawayOverlaySpec) {
    this.spec = spec;
  }

  public generateFFmpegOverlayFilter(
    baseVideoStream = 'v_main',
    brollStream = 'v_broll',
    outputStream = 'v_cutaway'
  ): string {
    const startSec = (this.spec.startMs / 1000).toFixed(2);
    const endSec = ((this.spec.startMs + this.spec.durationMs) / 1000).toFixed(2);

    return `[${brollStream}]setpts=PTS-STARTPTS[broll_pts]; [${baseVideoStream}][broll_pts]overlay=enable='between(t,${startSec},${endSec})':eof_action=pass[${outputStream}]`;
  }
}
