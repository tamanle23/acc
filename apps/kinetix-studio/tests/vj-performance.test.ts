import { describe, it, expect, beforeEach } from 'bun:test';
import {
  lerpColorHex,
  lerpPalette,
  DeckCrossfadeMediator,
} from '@/engine/live-stage/deck-crossfader';
import { BroadcastStreamAdapter } from '@/adapters/driven/broadcast-stream.adapter';
import { INITIAL_STUDIO_STATE } from '@/constants/initial-state';
import type { StudioState, PaletteTokens } from '@/types/studio';

describe('Horizon 4: Live Stage "VJ Performance Rig" & Crossfader Suite', () => {
  describe('sRGB Vector Color & Palette Interpolation', () => {
    it('lerpColorHex interpolates endpoints and midpoint accurately in sRGB space', () => {
      // t = 0 -> color A
      expect(lerpColorHex('#000000', '#FFFFFF', 0.0)).toBe('#000000');
      // t = 1 -> color B
      expect(lerpColorHex('#000000', '#FFFFFF', 1.0)).toBe('#FFFFFF');
      // t = 0.5 -> 128 (0x80)
      expect(lerpColorHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');

      // Clamping test
      expect(lerpColorHex('#112233', '#445566', -0.5)).toBe('#112233');
      expect(lerpColorHex('#112233', '#445566', 1.5)).toBe('#445566');
    });

    it('lerpPalette interpolates all 5 harmonic tokens simultaneously', () => {
      const pA: PaletteTokens = {
        bg: '#000000',
        surface: '#202020',
        ink: '#FFFFFF',
        accent: '#FF0000',
        accent2: '#00FF00',
      };
      const pB: PaletteTokens = {
        bg: '#FFFFFF',
        surface: '#E0E0E0',
        ink: '#000000',
        accent: '#0000FF',
        accent2: '#FFFF00',
      };

      const mid = lerpPalette(pA, pB, 0.5);
      expect(mid.bg).toBe('#808080');
      expect(mid.surface).toBe('#808080');
      expect(mid.ink).toBe('#808080');
      // Red (#FF0000) -> Blue (#0000FF) midpoint = #800080 (purple)
      expect(mid.accent).toBe('#800080');
    });
  });

  describe('DeckCrossfadeMediator Pattern', () => {
    let stateA: StudioState;
    let stateB: StudioState;

    beforeEach(() => {
      stateA = {
        ...INITIAL_STUDIO_STATE,
        archetypeId: 'swiss-international',
        bpm: 100,
        playbackSpeed: 1.0,
        stageScale: 1.0,
        palette: {
          bg: '#FFFFFF',
          surface: '#EEEEEE',
          ink: '#000000',
          accent: '#FF0000',
          accent2: '#0000FF',
        },
      };

      stateB = {
        ...INITIAL_STUDIO_STATE,
        archetypeId: 'brutalist-club',
        bpm: 140,
        playbackSpeed: 2.0,
        stageScale: 1.2,
        palette: {
          bg: '#000000',
          surface: '#111111',
          ink: '#00FF66',
          accent: '#FF0055',
          accent2: '#00E5FF',
        },
      };
    });

    it('returns exact Deck A state when crossfader <= 0.01', () => {
      const mediator = new DeckCrossfadeMediator(stateA, stateB, 0.0);
      const blended = mediator.resolveBlendedState();
      expect(blended.archetypeId).toBe('swiss-international');
      expect(blended.bpm).toBe(100);
      expect(blended.playbackSpeed).toBe(1.0);
    });

    it('returns exact Deck B state when crossfader >= 0.99', () => {
      const mediator = new DeckCrossfadeMediator(stateA, stateB, 1.0);
      const blended = mediator.resolveBlendedState();
      expect(blended.archetypeId).toBe('brutalist-club');
      expect(blended.bpm).toBe(140);
      expect(blended.playbackSpeed).toBe(2.0);
    });

    it('blends BPM, speed, scale, and palette vectors at mid crossfader position', () => {
      const mediator = new DeckCrossfadeMediator(stateA, stateB, 0.5);
      const blended = mediator.resolveBlendedState();

      // BPM = (100 + 140) / 2 = 120
      expect(blended.bpm).toBe(120);
      // Speed = (1.0 + 2.0) / 2 = 1.5
      expect(blended.playbackSpeed).toBe(1.5);
      // Scale = (1.0 + 1.2) / 2 = 1.1
      expect(blended.stageScale).toBeCloseTo(1.1, 2);
    });

    it('translates 7-bit MIDI CC 1 values [0, 127] to crossfader positions accurately', () => {
      const mediator = new DeckCrossfadeMediator(stateA, stateB, 0.0);

      mediator.setFromMidiCc(0);
      expect(mediator.position).toBe(0);

      mediator.setFromMidiCc(127);
      expect(mediator.position).toBe(1);

      mediator.setFromMidiCc(64);
      expect(mediator.position).toBeCloseTo(64 / 127, 3);
    });

    it('notifies subscribers reactively upon crossfader shifts', () => {
      const mediator = new DeckCrossfadeMediator(stateA, stateB, 0.0);
      let callCount = 0;
      let lastPos = 0;

      const unsubscribe = mediator.subscribe((_, pos) => {
        callCount++;
        lastPos = pos;
      });

      // Initial subscription notification
      expect(callCount).toBe(1);
      expect(lastPos).toBe(0.0);

      mediator.setPosition(0.75);
      expect(callCount).toBe(2);
      expect(lastPos).toBe(0.75);

      unsubscribe();
      mediator.setPosition(0.25);
      expect(callCount).toBe(2); // no additional calls after unsubscribe
    });
  });

  describe('BroadcastStreamAdapter', () => {
    it('manages active stream state and cleans up resources on stop and dispose', () => {
      const adapter = new BroadcastStreamAdapter();
      expect(adapter.isStreaming).toBe(false);

      // In non-browser environment or without mock canvas stream, start returns null safely
      const stream = adapter.start({} as HTMLCanvasElement);
      expect(stream).toBeNull();
      expect(adapter.isStreaming).toBe(false);

      adapter.stop();
      adapter.dispose();
      expect(adapter.isStreaming).toBe(false);
    });
  });
});
