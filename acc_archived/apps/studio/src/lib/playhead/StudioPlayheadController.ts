/**
 * StudioPlayheadController:
 * High-performance Observer / Subscribable Playhead State Controller for Studio.
 * Decouples 60fps frame advancement from React reconciliation overhead
 * (incorporating architectural patterns from Twick & Motion Canvas).
 */
export type PlayheadSubscriber = (frame: number, isPlaying: boolean) => void;

export class StudioPlayheadController {
  private static instance: StudioPlayheadController;

  private currentFrame = 0;
  private isPlaying = false;
  private fps = 30;
  private totalFrames = 300;

  // High-frequency subscribers (Canvas render loop, Timeline needle DOM transform, Timecode text)
  private highFreqSubscribers = new Set<PlayheadSubscriber>();

  // Low-frequency throttled subscribers (React inspectors, track details)
  private lowFreqSubscribers = new Set<PlayheadSubscriber>();
  private lastLowFreqSyncTime = 0;
  private lowFreqSyncIntervalMs = 100; // ~10 Hz React updates during playback

  private constructor() {}

  public static getInstance(): StudioPlayheadController {
    if (!StudioPlayheadController.instance) {
      StudioPlayheadController.instance = new StudioPlayheadController();
    }
    return StudioPlayheadController.instance;
  }

  public getFrame(): number {
    return this.currentFrame;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setConfig(fps: number, totalFrames: number) {
    this.fps = Math.max(1, fps);
    this.totalFrames = Math.max(0, totalFrames);
  }

  public setIsPlaying(playing: boolean) {
    if (this.isPlaying !== playing) {
      this.isPlaying = playing;
      // On play state changes, immediately force a low-frequency sync so UI updates
      this.notifyLowFreq(true);
    }
  }

  /**
   * Subscribes to high-frequency frame ticks (called on every RAF / discrete step).
   * Ideal for direct canvas drawing and CSS translate3d needle movements.
   */
  public subscribeHighFrequency(subscriber: PlayheadSubscriber): () => void {
    this.highFreqSubscribers.add(subscriber);
    // Initial call
    subscriber(this.currentFrame, this.isPlaying);
    return () => {
      this.highFreqSubscribers.delete(subscriber);
    };
  }

  /**
   * Subscribes to low-frequency throttled updates (~10 Hz during playback, immediate on stop).
   * Ideal for React state setters to prevent virtual DOM diffing on every frame.
   */
  public subscribeLowFrequency(subscriber: PlayheadSubscriber): () => void {
    this.lowFreqSubscribers.add(subscriber);
    subscriber(this.currentFrame, this.isPlaying);
    return () => {
      this.lowFreqSubscribers.delete(subscriber);
    };
  }

  /**
   * Seeks to an exact frame and dispatches updates.
   */
  public seek(frame: number, immediateUiSync = false): void {
    const clamped = Math.max(0, Math.min(Math.round(frame), this.totalFrames));
    this.currentFrame = clamped;

    // 1. Immediately notify high-frequency subscribers (Zero React overhead)
    for (const sub of this.highFreqSubscribers) {
      try {
        sub(this.currentFrame, this.isPlaying);
      } catch (err) {
        console.error('[StudioPlayheadController] HighFreq subscriber error:', err);
      }
    }

    // 2. Notify low-frequency subscribers (Throttled or immediate)
    const now = performance.now();
    if (immediateUiSync || !this.isPlaying || now - this.lastLowFreqSyncTime >= this.lowFreqSyncIntervalMs) {
      this.notifyLowFreq(true);
    }
  }

  private notifyLowFreq(force = false): void {
    this.lastLowFreqSyncTime = performance.now();
    for (const sub of this.lowFreqSubscribers) {
      try {
        sub(this.currentFrame, this.isPlaying);
      } catch (err) {
        console.error('[StudioPlayheadController] LowFreq subscriber error:', err);
      }
    }
  }
}
