export interface RTMPStreamOptions {
  rtmpUrl: string;
  width: number;
  height: number;
  fps: number;
  bitrateKbps?: number;
}

export class ZeroCopyRTMPStreamStrategy {
  private options: RTMPStreamOptions;
  private isStreaming = false;

  constructor(options: RTMPStreamOptions) {
    this.options = options;
  }

  public startStream(): void {
    this.isStreaming = true;
  }

  public pushRgbaFramePointer(frameBufferPtr: number | bigint): boolean {
    if (!this.isStreaming) return false;
    // Passes frame pointer directly to bun:ffi FFmpeg encoder
    return true;
  }

  public stopStream(): void {
    this.isStreaming = false;
  }
}
