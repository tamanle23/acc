import { useState, useEffect, useRef, useCallback } from 'react';
import {
  type ShuttleSpeed,
  getNextShuttleSpeed,
  shouldMuteAudio,
  snapToDiscreteFrame,
} from './shuttleTypes';
import { WebAudioEngine } from '../audio/WebAudioEngine';
import { DeterministicTimelineClock } from '../clock/DeterministicTimelineClock';
import type { IRState } from '../ir/irState';

export interface UseShuttleEngineOptions {
  currentFrame: number;
  totalFrames: number;
  fps: number;
  onScrub: (frame: number) => void;
  irState?: IRState | null;
  enableKeybindings?: boolean;
}

export interface UseShuttleEngineReturn {
  speed: ShuttleSpeed;
  isPlaying: boolean;
  shuttleForward: () => void;
  shuttleReverse: () => void;
  shuttleStop: () => void;
  togglePlay: () => void;
  stepFrame: (delta: number) => void;
  setSpeed: (speed: ShuttleSpeed) => void;
  isAudioMuted: boolean;
}

/**
 * useShuttleEngine:
 * Frame-Accurate J-K-L Shuttle Engine with Discrete Frame Snapping and Audio Hardware Clock Sync.
 * J = reverse [-1x, -2x, -4x, -8x]
 * K = stop [0x]
 * L = forward [1x, 2x, 4x, 8x]
 * Arrow Left/Right = discrete 1-frame jump
 */
export function useShuttleEngine({
  currentFrame,
  totalFrames,
  fps,
  onScrub,
  irState,
  enableKeybindings = true,
}: UseShuttleEngineOptions): UseShuttleEngineReturn {
  const [speed, setSpeedState] = useState<ShuttleSpeed>(0);
  const speedRef = useRef<ShuttleSpeed>(speed);
  speedRef.current = speed;

  const currentFrameRef = useRef(currentFrame);
  currentFrameRef.current = currentFrame;

  const totalFramesRef = useRef(totalFrames);
  totalFramesRef.current = totalFrames;

  const fpsRef = useRef(fps);
  fpsRef.current = fps;

  const irStateRef = useRef(irState);
  irStateRef.current = irState;

  const onScrubRef = useRef(onScrub);
  onScrubRef.current = onScrub;

  const setSpeed = useCallback((newSpeed: ShuttleSpeed) => {
    // If parked at or past end of timeline and attempting forward playback, restart from frame 0
    const maxBound = Math.max(0, totalFramesRef.current - 1);
    if (newSpeed > 0 && currentFrameRef.current >= maxBound) {
      currentFrameRef.current = 0;
      onScrubRef.current(0);
    }

    setSpeedState(newSpeed);
    speedRef.current = newSpeed;

    if (newSpeed === 0) {
      // Discrete stop: Snap playhead to exact integer frame
      const snapped = snapToDiscreteFrame(currentFrameRef.current);
      currentFrameRef.current = snapped;
      onScrubRef.current(snapped);
      WebAudioEngine.getInstance().stopPlayback();
    } else {
      WebAudioEngine.getInstance().setShuttleSpeed(
        newSpeed,
        currentFrameRef.current,
        fpsRef.current,
        irStateRef.current
      );
    }
  }, []);

  const shuttleForward = useCallback(() => {
    const next = getNextShuttleSpeed(speedRef.current, 'forward');
    setSpeed(next);
  }, [setSpeed]);

  const shuttleReverse = useCallback(() => {
    const next = getNextShuttleSpeed(speedRef.current, 'reverse');
    setSpeed(next);
  }, [setSpeed]);

  const shuttleStop = useCallback(() => {
    setSpeed(0);
  }, [setSpeed]);

  const togglePlay = useCallback(() => {
    if (speedRef.current !== 0) {
      setSpeed(0);
    } else {
      setSpeed(1);
    }
  }, [setSpeed]);

  const stepFrame = useCallback((delta: number) => {
    // Discrete frame jump: halt shuttle and jump exact integer frames
    if (speedRef.current !== 0) {
      setSpeed(0);
    }
    const maxFrame = Math.max(0, totalFramesRef.current);
    const target = snapToDiscreteFrame(currentFrameRef.current + delta);
    const clamped = Math.max(0, Math.min(maxFrame, target));
    currentFrameRef.current = clamped;
    onScrubRef.current(clamped);
    WebAudioEngine.getInstance().playScrubFeedback(clamped, fpsRef.current, irStateRef.current);
  }, [setSpeed]);

  // Deterministic Time-Based Frame Advancement Engine (DeterministicTimelineClock)
  useEffect(() => {
    if (speed === 0) return;

    const clock = new DeterministicTimelineClock({
      fps: fpsRef.current,
      totalFrames: totalFramesRef.current,
      mode: speed === 1 && !shouldMuteAudio(speed) ? 'audio_master' : 'monotonic_worker',
    });

    const currentSpeed = speedRef.current;
    clock.play(currentFrameRef.current, currentSpeed);

    if (clock.getSyncMode() === 'audio_master') {
      const audioStart = WebAudioEngine.getInstance().getPlaybackStartAudioTime();
      clock.lockMasterAudio(audioStart);
    }

    let rafId: number;
    let lastTime = performance.now();
    let lastUiSyncTime = performance.now();

    const tick = (now: number) => {
      let targetFrame: number;

      if (clock.getSyncMode() === 'audio_master' && WebAudioEngine.getInstance().getIsPlaying()) {
        const audioNow = WebAudioEngine.getInstance().getAudioCurrentTime();
        targetFrame = clock.tick(audioNow);
      } else {
        const deltaSec = (now - lastTime) / 1000;
        targetFrame = clock.tick(deltaSec);
      }
      lastTime = now;

      const total = totalFramesRef.current || 300;
      const endFrame = Math.max(0, total - 1);
      if (targetFrame >= endFrame && currentSpeed > 0) {
        const discreteFrame = snapToDiscreteFrame(endFrame);
        currentFrameRef.current = discreteFrame;
        onScrubRef.current(discreteFrame);
        setSpeed(0);
        return;
      } else if (targetFrame <= 0 && currentSpeed < 0) {
        const discreteFrame = 0;
        currentFrameRef.current = discreteFrame;
        onScrubRef.current(discreteFrame);
        setSpeed(0);
        return;
      }

      const discreteFrame = snapToDiscreteFrame(targetFrame);
      currentFrameRef.current = discreteFrame;

      // Throttle React state update to ~15 Hz (every ~66ms) during continuous playback,
      // preventing continuous 60 Hz React reconciliation overhead
      if (now - lastUiSyncTime >= 66) {
        lastUiSyncTime = now;
        onScrubRef.current(discreteFrame);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      clock.pause();
    };
  }, [speed]);

  // J-K-L and Arrow Keybindings with repeat debouncing
  useEffect(() => {
    if (!enableKeybindings || typeof window === 'undefined') return;

    let lastArrowStepTime = 0;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      switch (e.code) {
        case 'KeyJ':
          e.preventDefault();
          shuttleReverse();
          break;
        case 'KeyK':
          e.preventDefault();
          shuttleStop();
          break;
        case 'KeyL':
          e.preventDefault();
          shuttleForward();
          break;
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault();
          const now = performance.now();
          // First keypress is always immediate (zero lag).
          // Repeated keydown events (holding arrow key) throttled to 35ms (~28 Hz) to match display rate
          if (e.repeat && now - lastArrowStepTime < 35) {
            return;
          }
          lastArrowStepTime = now;
          const delta = e.code === 'ArrowRight' ? (e.shiftKey ? 10 : 1) : (e.shiftKey ? -10 : -1);
          stepFrame(delta);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeybindings, shuttleReverse, shuttleStop, shuttleForward, togglePlay, stepFrame]);

  return {
    speed,
    isPlaying: speed !== 0,
    shuttleForward,
    shuttleReverse,
    shuttleStop,
    togglePlay,
    stepFrame,
    setSpeed,
    isAudioMuted: shouldMuteAudio(speed),
  };
}
