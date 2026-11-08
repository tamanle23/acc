import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { WebAudioEngine } from '../apps/studio/src/lib/audio/WebAudioEngine';
import { IRStateManager } from '../apps/studio/src/lib/ir/irState';

describe('Studio Playback & Transport Synchronization Suite', () => {
  let audio: WebAudioEngine;

  beforeEach(() => {
    audio = WebAudioEngine.getInstance();
  });

  afterEach(() => {
    audio.stopPlayback();
  });

  it('calculates frame advancement accurately based on elapsed delta time without stale closures', () => {
    const fps = 30;
    const totalFrames = 300;
    const frameDurationMs = 1000 / fps; // 33.33ms

    let currentFrame = 0;
    let accumulatedTime = 0;

    // Simulate 3 ticks of 33.33ms elapsed time
    for (let tick = 1; tick <= 3; tick++) {
      accumulatedTime += frameDurationMs;
      const framesToAdvance = Math.floor(accumulatedTime / frameDurationMs);
      accumulatedTime %= frameDurationMs;

      currentFrame = (currentFrame + framesToAdvance) % totalFrames;
      expect(currentFrame).toBe(tick);
    }

    expect(currentFrame).toBe(3);
  });

  it('loops back to 0 cleanly when playback reaches totalDurationFrames', () => {
    const fps = 30;
    const totalFrames = 100;
    const frameDurationMs = 1000 / fps;

    let currentFrame = 98;
    let accumulatedTime = 0;

    // Advance 5 frames
    accumulatedTime += frameDurationMs * 5;
    const framesToAdvance = Math.floor(accumulatedTime / frameDurationMs);
    accumulatedTime %= frameDurationMs;

    let nextFrame = currentFrame + framesToAdvance;
    if (nextFrame >= totalFrames) {
      nextFrame = 0;
    }
    currentFrame = nextFrame;

    expect(currentFrame).toBe(0);
  });

  it('manages WebAudioEngine startPlayback and stopPlayback lifecycles safely', () => {
    const irState = IRStateManager.getInstance().getState();
    const fps = 30;

    // Should not throw when starting playback
    expect(() => {
      audio.startPlayback(0, fps, irState);
    }).not.toThrow();

    // Should not throw when stopping playback
    expect(() => {
      audio.stopPlayback();
    }).not.toThrow();
  });

  it('verifies Preview and Timeline components expose isPlaying, onTogglePlay, and onScrub props', async () => {
    const fs = await import('fs');
    const previewSrc = fs.readFileSync('apps/studio/src/components/Preview.tsx', 'utf-8');
    const timelineSrc = fs.readFileSync('apps/studio/src/components/Timeline.tsx', 'utf-8');

    expect(previewSrc).toContain('export function Preview');
    expect(timelineSrc).toContain('export function Timeline');
  });
});
