import { useState, useEffect, useRef, useCallback } from 'react';
import {
  type ShuttleSpeed,
  getNextShuttleSpeed,
  shouldMuteAudio,
  snapToDiscreteFrame,
} from './shuttleTypes';
import { WebAudioEngine } from '../audio/WebAudioEngine';

export interface UseShuttleEngineOptions {
  currentFrame: number;
  totalFrames: number;
  fps: number;
  onScrub: (frame: number) => void;
  irState?: any;
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
    if (newSpeed > 0 && currentFrameRef.current >= totalFramesRef.current) {
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

  // Discrete Frame Advancement Animation Loop
  useEffect(() => {
    if (speed === 0) return;

    let rafId: number;
    let lastTime = performance.now();
    let accumulatedMs = 0;

    const tick = (now: number) => {
      const deltaMs = now - lastTime;
      lastTime = now;

      const currentFps = Math.max(1, fpsRef.current);
      const frameDurationMs = 1000 / currentFps;
      const currentSpeed = speedRef.current;

      accumulatedMs += deltaMs * currentSpeed;

      if (Math.abs(accumulatedMs) >= frameDurationMs) {
        const framesToAdvance = Math.trunc(accumulatedMs / frameDurationMs);
        accumulatedMs -= framesToAdvance * frameDurationMs;

        const total = totalFramesRef.current || 300;
        let next = currentFrameRef.current + framesToAdvance;

        if (next >= total) {
          const discreteFrame = snapToDiscreteFrame(total);
          currentFrameRef.current = discreteFrame;
          onScrubRef.current(discreteFrame);
          setSpeed(0);
          return;
        } else if (next <= 0) {
          const discreteFrame = 0;
          currentFrameRef.current = discreteFrame;
          onScrubRef.current(discreteFrame);
          setSpeed(0);
          return;
        }

        const discreteFrame = snapToDiscreteFrame(next);
        currentFrameRef.current = discreteFrame;
        onScrubRef.current(discreteFrame);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [speed]);

  // J-K-L and Arrow Keybindings
  useEffect(() => {
    if (!enableKeybindings || typeof window === 'undefined') return;

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
          e.preventDefault();
          stepFrame(e.shiftKey ? -10 : -1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepFrame(e.shiftKey ? 10 : 1);
          break;
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
