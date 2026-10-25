/**
 * FrameBackpressureLock:
 * Enforces synchronous producer-consumer frame handshake.
 * Frame t+1 never begins until Frame t has been acknowledged by the encoder.
 * Eliminates frame drops and uncontrolled buffer bloat.
 */
export class FrameBackpressureLock {
  private currentFrame: number = 0;
  private pendingAck: boolean = false;
  private resolveAck?: () => void;

  public async acquire(frameIndex: number): Promise<void> {
    if (this.pendingAck) {
      await new Promise<void>(resolve => {
        this.resolveAck = resolve;
      });
    }
    this.currentFrame = frameIndex;
    this.pendingAck = true;
  }

  public acknowledge(frameIndex: number): void {
    if (this.currentFrame === frameIndex && this.pendingAck) {
      this.pendingAck = false;
      if (this.resolveAck) {
        const resolve = this.resolveAck;
        this.resolveAck = undefined;
        resolve();
      }
    }
  }

  public isLocked(): boolean {
    return this.pendingAck;
  }

  public getCurrentFrame(): number {
    return this.currentFrame;
  }
}
