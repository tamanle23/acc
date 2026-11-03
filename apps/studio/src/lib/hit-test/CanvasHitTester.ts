import type { ModifierNode, ResolvedSequence } from '@acc/ir';
import type { StudioTrack } from '../ir/studioTypes';

export interface SequenceHitRegion {
  readonly sequenceId: string;
  readonly sequenceType: 'video' | 'image' | 'text' | 'shape' | 'audio' | 'overlay';
  readonly trackIndex: number;
  readonly trackId: string;
  readonly normX: number; // center 0..1
  readonly normY: number; // center 0..1
  readonly normWidth: number; // 0..1
  readonly normHeight: number; // 0..1
  readonly label: string;
  readonly zIndex: number;
}

export interface SequenceBounds {
  readonly normX: number; // center 0..1
  readonly normY: number; // center 0..1
  readonly normWidth: number; // 0..1 (unscaled base width)
  readonly normHeight: number; // 0..1 (unscaled base height)
  readonly label: string;
  readonly sequenceType: 'video' | 'image' | 'text' | 'shape' | 'audio' | 'overlay';
}

/**
 * CanvasHitTester:
 * Computes normalized [0..1] bounding hit boxes and studio transform bounds for active sequences in the preview viewport.
 * Enables clicking directly on subtitles, shapes, images, and videos to activate their Sequence Inspector.
 */
export class CanvasHitTester {
  private static measurementCanvasCtx: any = null;

  private static getMeasurementContext(): any {
    if (this.measurementCanvasCtx) return this.measurementCanvasCtx;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas');
      this.measurementCanvasCtx = canvas.getContext('2d');
    } else if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(256, 256);
      this.measurementCanvasCtx = canvas.getContext('2d');
    }
    return this.measurementCanvasCtx;
  }

  /**
   * Resolves hit regions for all sequences active at the given frame.
   * Sorted top-to-bottom according to track index (higher tracks stack above lower tracks).
   */
  public static computeHitRegions(
    activeSequences: ResolvedSequence[],
    tracks: StudioTrack[] = []
  ): SequenceHitRegion[] {
    const regions: SequenceHitRegion[] = [];

    // Map trackId to track index
    const trackOrderMap = new Map<string, { index: number; track: StudioTrack }>();
    tracks.forEach((t, idx) => {
      trackOrderMap.set(t.id, { index: idx, track: t });
    });

    for (const seq of activeSequences) {
      const trackMeta = trackOrderMap.get(seq.trackId) || { index: 0, track: null };
      const region = this.resolveSequenceRegion(seq, trackMeta.index, seq.trackId);
      if (region) {
        regions.push(region);
      }
    }

    // Sort descending by zIndex / trackIndex so topmost elements receive hit priority
    return regions.sort((a, b) => b.zIndex - a.zIndex);
  }

  /**
   * Resolves exact unscaled normalized bounds (0..1) for a sequence across all archetypes.
   * Supports configurable visual breathing padding (default: 8px) for studio-grade gizmo wrapping.
   */
  public static resolveSequenceBounds(
    seq: ResolvedSequence,
    canvasWidth: number = 1920,
    canvasHeight: number = 1080,
    paddingPx: number = 8
  ): SequenceBounds {
    const modifiers = seq.modifiers || [];
    const transMod = modifiers.find((m: ModifierNode) => m.type === 'transform');
    const shapeMod = modifiers.find((m: ModifierNode) => m.type === 'shape/vector' || m.type === 'shape/draw');
    const textDrawMod = modifiers.find((m: ModifierNode) => m.type === 'text/draw' || m.type === 'text/overlay');
    const textMod = modifiers.find((m: ModifierNode) => m.type === 'timed_text/style' || m.type === 'text/style');

    const tp = (transMod?.params || {}) as Record<string, unknown>;
    const defaultNormX = typeof tp.normX === 'number' && Number.isFinite(tp.normX) ? tp.normX : 0.5;
    const defaultNormY = typeof tp.normY === 'number' && Number.isFinite(tp.normY) ? tp.normY : 0.5;

    // 1. Standalone Text & Title Overlay archetype ('text/draw')
    if (textDrawMod) {
      const p = (textDrawMod.params || {}) as Record<string, unknown>;
      const text = typeof p.text === 'string' ? p.text : seq.name || 'Title';
      const lines = text.split('\n');
      const fontSize = typeof p.fontSize === 'number' && Number.isFinite(p.fontSize) ? p.fontSize : 56;
      const fontFamily = typeof p.fontFamily === 'string' ? p.fontFamily : 'Inter, -apple-system, sans-serif';
      const fontWeight = typeof p.fontWeight === 'number' || typeof p.fontWeight === 'string' ? p.fontWeight : 700;
      const fontStyle = typeof p.fontStyle === 'string' ? p.fontStyle : 'normal';

      const scaleBase = Math.min(canvasWidth / 1920, canvasHeight / 1080);
      const scaledFont = Math.max(8, Math.round(fontSize * scaleBase));
      const letterSpacing = (typeof p.letterSpacing === 'number' ? p.letterSpacing : 0) * scaleBase;
      const lineHeightMult = typeof p.lineHeight === 'number' ? p.lineHeight : 1.25;
      const lineStep = Math.round(scaledFont * lineHeightMult);
      const padX = (typeof p.paddingX === 'number' ? p.paddingX : 0) * (canvasWidth / 1920);
      const padY = (typeof p.paddingY === 'number' ? p.paddingY : 0) * (canvasHeight / 1080);

      let maxLineWidth = 0;
      const ctx = this.getMeasurementContext();
      if (ctx && typeof ctx.measureText === 'function') {
        ctx.font = `${fontStyle === 'italic' ? 'italic ' : ''}${fontWeight} ${scaledFont}px ${fontFamily}`;
        for (const line of lines) {
          let lineW = 0;
          if (letterSpacing <= 0) {
            lineW = ctx.measureText(line).width;
          } else {
            for (let i = 0; i < line.length; i++) {
              lineW += ctx.measureText(line[i]).width + (i < line.length - 1 ? letterSpacing : 0);
            }
          }
          if (lineW > maxLineWidth) maxLineWidth = lineW;
        }
      } else {
        // High-precision calibrated typographic heuristic for headless environments
        for (const line of lines) {
          let lineW = 0;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            const isUpper = ch >= 'A' && ch <= 'Z';
            const isDigit = ch >= '0' && ch <= '9';
            const isPunctOrSpace = ch === ' ' || ch === '.' || ch === ',' || ch === ':' || ch === '-' || ch === '!';
            let chRatio = 0.55;
            if (isUpper) chRatio = 0.68;
            else if (isDigit) chRatio = 0.58;
            else if (isPunctOrSpace) chRatio = 0.32;
            if (Number(fontWeight) >= 700) chRatio *= 1.08;
            lineW += scaledFont * chRatio + (i < line.length - 1 ? letterSpacing : 0);
          }
          if (lineW > maxLineWidth) maxLineWidth = lineW;
        }
      }

      const totalBlockHeight = (lines.length - 1) * lineStep + scaledFont;
      const hasPlate = Boolean(p.backgroundColor && p.backgroundColor !== 'transparent');
      const platePadX = hasPlate ? padX * 2 : 0;
      const platePadY = hasPlate ? padY * 2 : 0;

      const rawW = maxLineWidth + platePadX + paddingPx * 2;
      const rawH = totalBlockHeight + platePadY + paddingPx * 2;

      return {
        normX: typeof p.normX === 'number' && Number.isFinite(p.normX) ? p.normX : defaultNormX,
        normY: typeof p.normY === 'number' && Number.isFinite(p.normY) ? p.normY : defaultNormY,
        normWidth: Math.min(1.0, Math.max(0.06, rawW / canvasWidth)),
        normHeight: Math.min(1.0, Math.max(0.04, rawH / canvasHeight)),
        label: `Text: "${text.slice(0, 20)}${text.length > 20 ? '...' : ''}"`,
        sequenceType: 'text',
      };
    }

    // 2. Subtitles & Timed Text archetype
    if (textMod || (seq.cues && seq.cues.length > 0) || seq.type === 'text') {
      const p = (textMod?.params || {}) as Record<string, unknown>;
      const cueText = seq.cues?.[0]?.text || seq.name || 'Subtitle';
      const textLen = Math.max(10, Math.min(80, cueText.length));
      const normW = Math.min(0.85, Math.max(0.25, (textLen * 18 + paddingPx * 2) / canvasWidth));
      const normH = Math.min(0.2, Math.max(0.05, (86 + paddingPx * 2) / canvasHeight));

      const marginV = typeof p.marginV === 'number' ? p.marginV : 65;
      const marginVNorm = marginV / canvasHeight;

      let yPos = 1.0 - marginVNorm - normH / 2;
      if (p.position === 'top') yPos = marginVNorm + normH / 2;
      else if (p.position === 'center') yPos = 0.5;

      return {
        normX: defaultNormX,
        normY: yPos,
        normWidth: normW,
        normHeight: normH,
        label: `Subtitle: "${cueText.slice(0, 20)}${cueText.length > 20 ? '...' : ''}"`,
        sequenceType: 'text',
      };
    }

    // 3. Vector Shapes archetype
    if (shapeMod) {
      const sp = (shapeMod.params || {}) as Record<string, unknown>;
      const scaleX = canvasWidth / 1920;
      const scaleY = canvasHeight / 1080;
      const w = (typeof sp.width === 'number' ? sp.width : 320) * scaleX;
      const h = (typeof sp.height === 'number' ? sp.height : 180) * scaleY;
      const rawW = w + paddingPx * 2;
      const rawH = h + paddingPx * 2;
      return {
        normX: typeof sp.normX === 'number' && Number.isFinite(sp.normX) ? sp.normX : defaultNormX,
        normY: typeof sp.normY === 'number' && Number.isFinite(sp.normY) ? sp.normY : defaultNormY,
        normWidth: Math.min(1.0, Math.max(0.04, rawW / canvasWidth)),
        normHeight: Math.min(1.0, Math.max(0.04, rawH / canvasHeight)),
        label: `Shape: ${typeof sp.geometry === 'string' ? sp.geometry : (typeof sp.shapeType === 'string' ? sp.shapeType : 'vector')}`,
        sequenceType: 'shape',
      };
    }

    // 4. Procedural Visual Overlays (e.g. particles, rain, snow, HUDs)
    if (seq.type === 'overlay' || modifiers.some((m: ModifierNode) => m.type.startsWith('overlay/'))) {
      return {
        normX: defaultNormX,
        normY: defaultNormY,
        normWidth: 0.95,
        normHeight: 0.95,
        label: `Overlay: ${seq.name || seq.id}`,
        sequenceType: 'overlay',
      };
    }

    // 5. Visual Media / Video / Image archetype
    const resolvedType: SequenceBounds['sequenceType'] = seq.type === 'image' ? 'image' : 'video';
    return {
      normX: defaultNormX,
      normY: defaultNormY,
      normWidth: 1.0,
      normHeight: 1.0,
      label: seq.name || seq.id,
      sequenceType: resolvedType,
    };
  }

  /**
   * Resolves the hit-box geometry based on sequence archetype and modifiers.
   */
  public static resolveSequenceRegion(
    seq: ResolvedSequence,
    trackIndex: number,
    trackId: string
  ): SequenceHitRegion | null {
    // Exclude pure audio tracks
    if (trackId.includes('audio') || trackId.includes('a1') || trackId.includes('a2')) {
      return null;
    }

    const bounds = this.resolveSequenceBounds(seq, 1920, 1080, 0);
    const modifiers = seq.modifiers || [];
    const transMod = modifiers.find((m: ModifierNode) => m.type === 'transform');
    const tp = (transMod?.params || {}) as Record<string, unknown>;

    const offsetX = typeof tp.x === 'number' ? tp.x / 1920 : 0;
    const offsetY = typeof tp.y === 'number' ? tp.y / 1080 : 0;
    const scale = typeof tp.scale === 'number' && Number.isFinite(tp.scale) ? tp.scale : 1.0;

    let zBase = 10;
    if (bounds.sequenceType === 'text') zBase = 100;
    else if (bounds.sequenceType === 'shape') zBase = 50;
    else if (bounds.sequenceType === 'overlay') zBase = 20;

    return {
      sequenceId: seq.id,
      sequenceType: bounds.sequenceType,
      trackIndex,
      trackId,
      normX: Math.max(0, Math.min(1, bounds.normX + offsetX)),
      normY: Math.max(0, Math.min(1, bounds.normY + offsetY)),
      normWidth: Math.min(1.0, bounds.normWidth * scale),
      normHeight: Math.min(1.0, bounds.normHeight * scale),
      label: bounds.label,
      zIndex: zBase + trackIndex,
    };
  }
}
