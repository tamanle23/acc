// ============================================================================
// KINETIX STUDIO v6.0 - DUAL-DECK CROSSFADER MEDIATOR (ECMA-429)
// Mediator pattern managing Deck A & Deck B state vector interpolation for live VJ performance.
// ============================================================================

import type { StudioState, PaletteTokens } from '@/types/studio';
import { hexToRgb } from '@/core/domain/color/color-math';

/**
 * Linearly interpolates between two 6-digit or 3-digit hex colors in sRGB space.
 */
export function lerpColorHex(hexA: string, hexB: string, t: number): string {
  const clampedT = Math.max(0, Math.min(1, t));
  const [rA, gA, bA] = hexToRgb(hexA);
  const [rB, gB, bB] = hexToRgb(hexB);

  const r = Math.round(rA + (rB - rA) * clampedT);
  const g = Math.round(gA + (gB - gA) * clampedT);
  const b = Math.round(bA + (bB - bA) * clampedT);

  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Interpolates an entire 5-token harmonic palette vector.
 */
export function lerpPalette(pA: PaletteTokens, pB: PaletteTokens, t: number): PaletteTokens {
  return {
    bg: lerpColorHex(pA.bg, pB.bg, t),
    surface: lerpColorHex(pA.surface, pB.surface, t),
    ink: lerpColorHex(pA.ink, pB.ink, t),
    accent: lerpColorHex(pA.accent, pB.accent, t),
    accent2: lerpColorHex(pA.accent2, pB.accent2, t),
  };
}

export type CrossfaderSubscriber = (blendedState: StudioState, position: number) => void;

export class DeckCrossfadeMediator {
  private _deckA: StudioState;
  private _deckB: StudioState;
  private _position = 0; // [0, 1]: 0 = Deck A 100%, 1 = Deck B 100%
  private readonly subscribers = new Set<CrossfaderSubscriber>();
  private disposed = false;

  public constructor(deckA: StudioState, deckB: StudioState, initialPosition = 0) {
    this._deckA = { ...deckA };
    this._deckB = { ...deckB };
    this._position = Math.max(0, Math.min(1, initialPosition));
  }

  public get deckA(): StudioState {
    return this._deckA;
  }

  public set deckA(state: StudioState) {
    this._deckA = { ...state };
    this.notify();
  }

  public get deckB(): StudioState {
    return this._deckB;
  }

  public set deckB(state: StudioState) {
    this._deckB = { ...state };
    this.notify();
  }

  public get position(): number {
    return this._position;
  }

  /**
   * Sets crossfader position [0, 1] and notifies all subscribers.
   */
  public setPosition(pos: number): void {
    if (this.disposed) return;
    const clamped = Math.max(0, Math.min(1, Number.isFinite(pos) ? pos : 0));
    if (this._position !== clamped) {
      this._position = clamped;
      this.notify();
    }
  }

  /**
   * Sets crossfader position from standard 7-bit MIDI CC value [0, 127].
   */
  public setFromMidiCc(ccValue: number): void {
    const clamped = Math.max(0, Math.min(127, Math.round(ccValue)));
    this.setPosition(clamped / 127);
  }

  /**
   * Subscribes to crossfader changes with automatic initial broadcast.
   */
  public subscribe(fn: CrossfaderSubscriber): () => void {
    this.subscribers.add(fn);
    fn(this.resolveBlendedState(), this._position);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private notify(): void {
    const blended = this.resolveBlendedState();
    for (const sub of this.subscribers) {
      try {
        sub(blended, this._position);
      } catch (err) {
        console.error('DeckCrossfadeMediator subscriber error:', err);
      }
    }
  }

  /**
   * Computes the mathematical vector blend between Deck A and Deck B.
   */
  public resolveBlendedState(): StudioState {
    const t = this._position;

    // Fast-path endpoints
    if (t <= 0.01) return { ...this._deckA };
    if (t >= 0.99) return { ...this._deckB };

    const dominantDeck = t < 0.5 ? this._deckA : this._deckB;
    const blendedPalette = lerpPalette(this._deckA.palette, this._deckB.palette, t);
    const blendedBpm = Math.round(this._deckA.bpm + (this._deckB.bpm - this._deckA.bpm) * t);
    const blendedSpeed = Number(
      (this._deckA.playbackSpeed + (this._deckB.playbackSpeed - this._deckA.playbackSpeed) * t).toFixed(2)
    );
    const scaleA = this._deckA.stageScale ?? 1.0;
    const scaleB = this._deckB.stageScale ?? 1.0;
    const blendedScale = Number((scaleA + (scaleB - scaleA) * t).toFixed(3));

    return {
      ...dominantDeck,
      palette: blendedPalette,
      bpm: blendedBpm,
      playbackSpeed: blendedSpeed,
      stageScale: blendedScale,
      // Retain active media / video loop from dominant deck
      bgGraphicId: dominantDeck.bgGraphicId,
      bgVideoUrl: dominantDeck.bgVideoUrl,
    };
  }

  public dispose(): void {
    this.subscribers.clear();
    this.disposed = true;
  }

  public [Symbol.dispose](): void {
    this.dispose();
  }
}
