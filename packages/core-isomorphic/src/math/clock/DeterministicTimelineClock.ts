import { RationalTime } from '../time/RationalTime';

export type ClockSyncMode = 'audio_master' | 'monotonic_worker' | 'manual_step';

export interface ClockOptions {
  fps?: number;
  totalFrames?: number;
  mode?: ClockSyncMode;
}

export interface ClockState {
  currentFrame: number;
  isPlaying: boolean;
  speed: number;
  fps: number;
  totalFrames: number;
  mode: ClockSyncMode;
  timeSec: number;
  rationalTime: RationalTime;
}

/**
 * DeterministicTimelineClock:
 * 100% Deterministic Time-Based Frame Advancement Engine.
 * Decoupled from monitor refresh rates (60Hz, 120Hz, 144Hz) and performance.now() jitter.
 * Slaves video frames to hardware audio clock or discrete mathematical intervals.
 */
export class DeterministicTimelineClock {
  private fps: number;
  private totalFrames: number;
  private currentFrame: number = 0;
  private isPlaying: boolean = false;
  private speed: number = 1.0;
  private mode: ClockSyncMode = 'monotonic_worker';

  // Audio master tracking
  private audioStartSec: number = 0;
  private playbackStartFrame: number = 0;
  private needsAudioReanchor: boolean = false;

  // Monotonic tracking
  private accumulatedElapsedSec: number = 0;

  private listeners: Set<(frame: number, state: ClockState) => void> = new Set();

  constructor(options: ClockOptions = {}) {
    this.fps = Math.max(1, options.fps ?? 30);
    this.totalFrames = Math.max(1, options.totalFrames ?? 1800); // Default 60s @ 30fps
    this.mode = options.mode ?? 'monotonic_worker';
  }

  public getFps(): number {
    return this.fps;
  }

  public setFps(fps: number): void {
    this.fps = Math.max(1, fps);
  }

  public getTotalFrames(): number {
    return this.totalFrames;
  }

  public setTotalFrames(total: number): void {
    this.totalFrames = Math.max(1, total);
    if (this.currentFrame >= this.totalFrames) {
      this.currentFrame = Math.max(0, this.totalFrames - 1);
    }
  }

  public getSpeed(): number {
    return this.speed;
  }

  public setSpeed(speed: number): void {
    if (this.isPlaying) {
      // Re-anchor playback on speed change to avoid jump
      this.playbackStartFrame = this.currentFrame;
      this.accumulatedElapsedSec = 0;
      this.needsAudioReanchor = true;
    }
    this.speed = speed;
  }

  public getSyncMode(): ClockSyncMode {
    return this.mode;
  }

  public setSyncMode(mode: ClockSyncMode): void {
    if (this.mode !== mode) {
      this.playbackStartFrame = this.currentFrame;
      this.accumulatedElapsedSec = 0;
      this.needsAudioReanchor = true;
      this.mode = mode;
    }
  }

  public getState(): ClockState {
    const discreteFrame = Math.round(this.currentFrame);
    const rationalTime = RationalTime.fromFrame(discreteFrame, this.fps);
    return {
      currentFrame: discreteFrame,
      isPlaying: this.isPlaying,
      speed: this.speed,
      fps: this.fps,
      totalFrames: this.totalFrames,
      mode: this.mode,
      timeSec: rationalTime.toSeconds(),
      rationalTime,
    };
  }

  public getRationalTime(): RationalTime {
    return RationalTime.fromFrame(Math.round(this.currentFrame), this.fps);
  }

  public getFrame(): number {
    return Math.round(this.currentFrame);
  }

  public getFractionalFrame(): number {
    return this.currentFrame;
  }

  public play(startFrame?: number, speed?: number): void {
    if (startFrame !== undefined) {
      this.currentFrame = Math.max(0, Math.min(this.totalFrames - 1, Math.round(startFrame)));
    }
    if (speed !== undefined) {
      this.speed = speed;
    }
    this.isPlaying = true;
    this.playbackStartFrame = this.currentFrame;
    this.accumulatedElapsedSec = 0;
    this.needsAudioReanchor = true;
  }

  public pause(): void {
    this.isPlaying = false;
  }

  public seek(frame: number, audioNow?: number): number {
    this.currentFrame = Math.max(0, Math.min(this.totalFrames - 1, Math.round(frame)));
    this.playbackStartFrame = this.currentFrame;
    this.accumulatedElapsedSec = 0;
    if (audioNow !== undefined) {
      this.audioStartSec = audioNow;
      this.needsAudioReanchor = false;
    } else {
      this.needsAudioReanchor = true;
    }
    this.notify();
    return this.currentFrame;
  }

  /**
   * Locks master audio reference time (e.g. AudioContext.currentTime).
   */
  public lockMasterAudio(audioStartSec: number): void {
    this.audioStartSec = audioStartSec;
    this.playbackStartFrame = this.currentFrame;
    this.needsAudioReanchor = audioStartSec <= 0;
    this.mode = 'audio_master';
  }

  /**
   * Re-anchors the audio hardware clock reference to avoid drift after high-jitter events.
   */
  public reanchorAudio(audioCurrentSec: number): void {
    this.audioStartSec = audioCurrentSec;
    this.playbackStartFrame = this.currentFrame;
    this.needsAudioReanchor = false;
  }

  /**
   * Evaluates and advances the clock deterministically.
   * In audio_master mode: pass audioCurrentTimeSec.
   * In monotonic_worker mode: pass deltaSec or accumulated elapsed time.
   */
  public tick(timeOrDeltaSec?: number): number {
    if (!this.isPlaying && this.mode !== 'manual_step') {
      return this.currentFrame;
    }

    let targetFrame = this.currentFrame;

    if (this.mode === 'audio_master') {
      if ((this.needsAudioReanchor || this.audioStartSec <= 0) && timeOrDeltaSec !== undefined) {
        this.audioStartSec = timeOrDeltaSec;
        this.needsAudioReanchor = false;
      }
      const audioNow = timeOrDeltaSec ?? this.audioStartSec;
      // Guard against stale audio reference clock drift: if elapsed time exceeds 0.5s on initial frame, reanchor
      let audioElapsed = audioNow - this.audioStartSec;
      if (audioElapsed < 0 || (this.currentFrame === this.playbackStartFrame && audioElapsed > 0.5)) {
        this.audioStartSec = audioNow;
        audioElapsed = 0;
      }
      const deltaFrames = Math.max(0, audioElapsed) * this.fps * this.speed;
      targetFrame = this.playbackStartFrame + deltaFrames;
    } else if (this.mode === 'monotonic_worker') {
      const delta = timeOrDeltaSec ?? (1 / (this.fps * Math.abs(this.speed || 1)));
      this.accumulatedElapsedSec += delta;
      const deltaFrames = this.accumulatedElapsedSec * this.fps * this.speed;
      targetFrame = this.playbackStartFrame + deltaFrames;
    }

    // Clamp within bounds
    targetFrame = Math.max(0, Math.min(this.totalFrames - 1, targetFrame));

    if (targetFrame !== this.currentFrame) {
      this.currentFrame = targetFrame;
      this.notify();
    }

    // Auto-stop at bounds
    if (this.currentFrame >= this.totalFrames - 1 && this.speed > 0) {
      this.pause();
    } else if (this.currentFrame <= 0 && this.speed < 0) {
      this.pause();
    }

    return this.currentFrame;
  }

  public onTick(callback: (frame: number, state: ClockState) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notify(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      listener(this.currentFrame, state);
    }
  }
}
