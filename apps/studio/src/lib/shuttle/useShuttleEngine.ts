import { createSignal, createEffect, onCleanup, untrack } from 'solid-js';
import {
  type ShuttleSpeed,
  getNextShuttleSpeed,
  shouldMuteAudio,
  snapToDiscreteFrame,
} from './shuttleTypes';
import { WebAudioEngine } from '../audio/WebAudioEngine';
import { DeterministicTimelineClock } from '../clock/DeterministicTimelineClock';
import { PlayheadController } from '../playhead/PlayheadController';
import type { IRState } from '../ir/irState';

export interface UseShuttleEngineOptions {
  currentFrame: number | (() => number);
  totalFrames: number | (() => number);
  fps: number | (() => number);
  onScrub: (frame: number) => void;
  irState?: IRState | (() => IRState | null) | null;
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

function resolveVal<T>(val: T | (() => T)): T {
  return typeof val === 'function' ? (val as () => T)() : val;
}

/**
 * createShuttleEngine / useShuttleEngine:
 * Frame-Accurate J-K-L Shuttle Engine with Discrete Frame Snapping and Audio Hardware Clock Sync for SolidJS.
 * J = reverse [-1x, -2x, -4x, -8x]
 * K = stop [0x]
 * L = forward [1x, 2x, 4x, 8x]
 * Arrow Left/Right = discrete 1-frame jump
 */
export function createShuttleEngine(options: UseShuttleEngineOptions): UseShuttleEngineReturn {
  const [speed, setSpeedState] = createSignal<ShuttleSpeed>(0);
  let isKDown = false;

  const getCurrentFrame = () => PlayheadController.getInstance().getFrame();
  const getTotalFrames = () => resolveVal(options.totalFrames);
  const getFps = () => resolveVal(options.fps);
  const getIrState = () => resolveVal(options.irState);

  const setSpeed = (newSpeed: ShuttleSpeed) => {
    const total = getTotalFrames();
    const maxBound = Math.max(0, total - 1);
    let cur = getCurrentFrame();

    if (newSpeed > 0 && cur >= maxBound) {
      cur = 0;
      PlayheadController.getInstance().seek(0, true);
      options.onScrub(0);
    }

    setSpeedState(newSpeed);
    PlayheadController.getInstance().setIsPlaying(newSpeed !== 0);

    if (newSpeed === 0) {
      const snapped = snapToDiscreteFrame(cur);
      PlayheadController.getInstance().seek(snapped, true);
      options.onScrub(snapped);
      WebAudioEngine.getInstance().stopPlayback();
    } else {
      WebAudioEngine.getInstance().setShuttleSpeed(
        newSpeed,
        cur,
        getFps(),
        getIrState()
      );
    }
  };

  const shuttleForward = () => {
    const next = getNextShuttleSpeed(speed(), 'forward');
    setSpeed(next);
  };

  const shuttleReverse = () => {
    const next = getNextShuttleSpeed(speed(), 'reverse');
    setSpeed(next);
  };

  const shuttleStop = () => {
    setSpeed(0);
  };

  const togglePlay = () => {
    if (speed() !== 0) {
      setSpeed(0);
    } else {
      setSpeed(1);
    }
  };

  const stepFrame = (delta: number) => {
    if (speed() !== 0) {
      setSpeed(0);
    }
    const maxFrame = Math.max(0, getTotalFrames());
    const current = getCurrentFrame();
    const target = snapToDiscreteFrame(current + delta);
    const clamped = Math.max(0, Math.min(maxFrame, target));
    PlayheadController.getInstance().seek(clamped, true);
    options.onScrub(clamped);
    WebAudioEngine.getInstance().playScrubFeedback(clamped, getFps(), getIrState());
  };

  // Deterministic Time-Based Frame Advancement Engine
  createEffect(() => {
    const currentSpeed = speed();
    if (currentSpeed === 0) return;

    const initialFrame = untrack(getCurrentFrame);
    const initialFps = untrack(getFps);
    const initialTotalFrames = untrack(getTotalFrames);

    const clock = new DeterministicTimelineClock({
      fps: initialFps,
      totalFrames: initialTotalFrames,
      mode: currentSpeed === 1 && !shouldMuteAudio(currentSpeed) ? 'audio_master' : 'monotonic_worker',
    });

    clock.play(initialFrame, currentSpeed);

    if (clock.getSyncMode() === 'audio_master') {
      const audioStart = WebAudioEngine.getInstance().getPlaybackStartAudioTime();
      clock.lockMasterAudio(audioStart);
    }

    let rafId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      let targetFrame: number;
      const deltaSec = Math.max(0, (now - lastTime) / 1000);
      lastTime = now;

      if (
        clock.getSyncMode() === 'audio_master' &&
        WebAudioEngine.getInstance().getIsPlaying() &&
        WebAudioEngine.getInstance().isContextRunning()
      ) {
        const audioNow = WebAudioEngine.getInstance().getAudioCurrentTime();
        targetFrame = clock.tick(audioNow);
      } else {
        if (clock.getSyncMode() === 'audio_master') {
          clock.setSyncMode('monotonic_worker');
        }
        targetFrame = clock.tick(deltaSec);
      }

      const total = getTotalFrames() || 300;
      const endFrame = Math.max(0, total - 1);
      if (targetFrame >= endFrame && currentSpeed > 0) {
        const discreteFrame = snapToDiscreteFrame(endFrame);
        PlayheadController.getInstance().seek(discreteFrame, true);
        options.onScrub(discreteFrame);
        setSpeed(0);
        return;
      } else if (targetFrame <= 0 && currentSpeed < 0) {
        const discreteFrame = 0;
        PlayheadController.getInstance().seek(discreteFrame, true);
        options.onScrub(discreteFrame);
        setSpeed(0);
        return;
      }

      const rawFractionalFrame = targetFrame;
      const discreteFrame = snapToDiscreteFrame(rawFractionalFrame);

      // Advance high-frequency render subscribers (Canvas & Needle) on EVERY RAF frame at full 60 FPS
      PlayheadController.getInstance().seek(discreteFrame, false, rawFractionalFrame);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    onCleanup(() => {
      cancelAnimationFrame(rafId);
      clock.pause();
    });
  });

  // J-K-L and Arrow Keybindings
  if (options.enableKeybindings !== false && typeof window !== 'undefined') {
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
          if (isKDown) {
            stepFrame(-1);
          } else {
            shuttleReverse();
          }
          break;
        case 'KeyK':
          e.preventDefault();
          isKDown = true;
          shuttleStop();
          break;
        case 'KeyL':
          e.preventDefault();
          if (isKDown) {
            stepFrame(1);
          } else {
            shuttleForward();
          }
          break;
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault();
          const now = performance.now();
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

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyK') {
        isKDown = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    });
  }

  // Provide both property and function accessors for max flexibility
  const res: UseShuttleEngineReturn = {
    get speed() {
      return speed();
    },
    get isPlaying() {
      return speed() !== 0;
    },
    shuttleForward,
    shuttleReverse,
    shuttleStop,
    togglePlay,
    stepFrame,
    setSpeed,
    get isAudioMuted() {
      return shouldMuteAudio(speed());
    },
  };

  return res;
}

// Backward-compatible alias
export const useShuttleEngine = createShuttleEngine;
