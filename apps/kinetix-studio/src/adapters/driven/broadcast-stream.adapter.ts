// ============================================================================
// KINETIX STUDIO v6.0 - BROADCAST CANVAS STREAM ADAPTER (ECMA-429)
// Real-time 60 FPS canvas capture stream for OBS Virtual Camera, NDI & WebRTC.
// ============================================================================

export class BroadcastStreamAdapter {
  private activeStream: MediaStream | null = null;
  private canvasSource: HTMLCanvasElement | null = null;
  private disposed = false;

  public static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof HTMLCanvasElement !== 'undefined' &&
      typeof (HTMLCanvasElement.prototype as any).captureStream === 'function'
    );
  }

  public get isStreaming(): boolean {
    return this.activeStream !== null && this.activeStream.active;
  }

  public get stream(): MediaStream | null {
    return this.activeStream;
  }

  public get canvas(): HTMLCanvasElement | null {
    return this.canvasSource;
  }

  /**
   * Starts capturing 60 FPS video stream from the canvas.
   */
  public start(canvas: HTMLCanvasElement, fps = 60): MediaStream | null {
    if (this.disposed) return null;
    if (this.activeStream) {
      this.stop();
    }

    this.canvasSource = canvas;

    if (typeof (canvas as any).captureStream === 'function') {
      try {
        this.activeStream = (canvas as any).captureStream(fps);
        return this.activeStream;
      } catch (err) {
        console.warn('BroadcastStreamAdapter captureStream failed:', err);
        return null;
      }
    }

    return null;
  }

  /**
   * Stops active video stream and halts all media tracks.
   */
  public stop(): void {
    if (this.activeStream) {
      for (const track of this.activeStream.getTracks()) {
        track.stop();
      }
      this.activeStream = null;
    }
    this.canvasSource = null;
  }

  public dispose(): void {
    this.stop();
    this.disposed = true;
  }

  public [Symbol.dispose](): void {
    this.dispose();
  }
}

export const broadcastStreamAdapter = new BroadcastStreamAdapter();
