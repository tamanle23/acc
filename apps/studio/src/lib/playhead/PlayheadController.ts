/**
 * PlayheadController:
 * High-performance Observer / Subscribable Playhead State Controller for Studio.
 * Decouples 60fps frame advancement from React reconciliation overhead
 * (incorporating architectural patterns from Twick & Motion Canvas).
 */
export type PlayheadSubscriber = (
  frame: number,
  isPlaying: boolean,
  fractionalFrame?: number
) => void;

export class PlayheadController {
  private static instance: PlayheadController;

  private currentFrame = 0;
  private currentFractionalFrame = 0;
  private isPlaying = false;
  private fps = 30;
  private totalFrames = 300;

  // High-frequency subscribers (Canvas render loop, Timeline needle DOM transform, Timecode text)
  private highFreqSubscribers = new Set<PlayheadSubscriber>();

  // Low-frequency throttled subscribers (React inspectors, track details)
  private lowFreqSubscribers = new Set<PlayheadSubscriber>();
  private lastLowFreqSyncTime = 0;
  private lowFreqSyncIntervalMs = 250; // ~4 Hz React updates during playback

  private constructor() { }

  public static getInstance(): PlayheadController {
    if (!PlayheadController.instance) {
      PlayheadController.instance = new PlayheadController();
    }
    return PlayheadController.instance;
  }

  public getFrame = (): number => {
    return this.currentFrame;
  };

  public getFractionalFrame = (): number => {
    return this.currentFractionalFrame;
  };

  public getIsPlaying = (): boolean => {
    return this.isPlaying;
  };

  public setConfig(fps: number, totalFrames: number) {
    this.fps = Math.max(1, fps);
    this.totalFrames = Math.max(0, totalFrames);
  }

  public setIsPlaying(playing: boolean) {
    if (this.isPlaying !== playing) {
      this.isPlaying = playing;
      if (!playing) {
        this.renderTimestamps = [];
        this.renderLatencies = [];
      }
      // On play state changes, immediately force a low-frequency sync so UI updates
      this.notifyLowFreq(true);
    }
  }

  // Real Hardware Render Telemetry (Moving Average over 1s)
  private telemetrySubscribers = new Set<(fps: number, latencyMs: number) => void>();
  private renderTimestamps: number[] = [];
  private renderLatencies: number[] = [];
  private lastTelemetryBroadcast = 0;

  public recordFrameRendered = (_frame: number, latencyMs: number): void => {
    const now = performance.now();
    this.renderTimestamps.push(now);
    this.renderLatencies.push(latencyMs);

    while (this.renderTimestamps.length > 0 && now - this.renderTimestamps[0]! > 1000) {
      this.renderTimestamps.shift();
      this.renderLatencies.shift();
    }

    if (now - this.lastTelemetryBroadcast >= 250) {
      this.lastTelemetryBroadcast = now;
      const count = this.renderTimestamps.length;
      const measuredFps = count > 1
        ? (count * 1000) / (now - this.renderTimestamps[0]!)
        : (count > 0 ? 1000 / Math.max(16.6, latencyMs) : 0);
      const avgLatency = this.renderLatencies.length > 0
        ? this.renderLatencies.reduce((a, b) => a + b, 0) / this.renderLatencies.length
        : latencyMs;

      const roundedFps = Math.round(measuredFps * 10) / 10;
      const roundedLat = Math.round(avgLatency * 10) / 10;
      for (const sub of this.telemetrySubscribers) {
        sub(roundedFps, roundedLat);
      }
    }
  };

  public subscribeTelemetry = (subscriber: (fps: number, latencyMs: number) => void): (() => void) => {
    this.telemetrySubscribers.add(subscriber);
    return () => {
      this.telemetrySubscribers.delete(subscriber);
    };
  };

  /**
   * Subscribes to high-frequency frame ticks (called on every RAF / discrete step).
   * Ideal for direct canvas drawing and CSS translate3d needle movements.
   */
  public subscribeHighFrequency = (subscriber: PlayheadSubscriber): (() => void) => {
    this.highFreqSubscribers.add(subscriber);
    // Initial call
    subscriber(this.currentFrame, this.isPlaying, this.currentFractionalFrame);
    return () => {
      this.highFreqSubscribers.delete(subscriber);
    };
  };

  /**
   * Subscribes to low-frequency throttled updates (~10 Hz during playback, immediate on stop).
   * Ideal for React state setters to prevent virtual DOM diffing on every frame.
   */
  public subscribeLowFrequency = (subscriber: PlayheadSubscriber): (() => void) => {
    this.lowFreqSubscribers.add(subscriber);
    subscriber(this.currentFrame, this.isPlaying, this.currentFractionalFrame);
    return () => {
      this.lowFreqSubscribers.delete(subscriber);
    };
  };

  /**
   * Seeks to an exact frame and dispatches updates.
   */
  public seek(frame: number, immediateUiSync = false, fractionalFrame?: number): void {
    const clamped = Math.max(0, Math.min(Math.round(frame), this.totalFrames));
    this.currentFrame = clamped;
    this.currentFractionalFrame = Math.max(0, Math.min(fractionalFrame ?? clamped, this.totalFrames));

    // 1. Immediately notify high-frequency subscribers (Zero React overhead)
    for (const sub of this.highFreqSubscribers) {
      try {
        sub(this.currentFrame, this.isPlaying, this.currentFractionalFrame);
      } catch (err) {
        console.error('[PlayheadController] HighFreq subscriber error:', err);
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
        sub(this.currentFrame, this.isPlaying, this.currentFractionalFrame);
      } catch (err) {
        console.error('[PlayheadController] LowFreq subscriber error:', err);
      }
    }
  }
}
