import type { ResolvedSequence } from '@acc/ir';

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

/**
 * CanvasHitTester:
 * Computes normalized [0..1] bounding hit boxes for active sequences in the preview viewport.
 * Enables clicking directly on subtitles, shapes, images, and videos to activate their Sequence Inspector.
 */
export class CanvasHitTester {
  /**
   * Resolves hit regions for all sequences active at the given frame.
   * Sorted top-to-bottom according to track index (higher tracks stack above lower tracks).
   */
  public static computeHitRegions(
    activeSequences: ResolvedSequence[],
    tracks: any[] = []
  ): SequenceHitRegion[] {
    const regions: SequenceHitRegion[] = [];

    // Map trackId to track index
    const trackOrderMap = new Map<string, { index: number; track: any }>();
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
   * Resolves the hit-box geometry based on sequence archetype and modifiers.
   */
  public static resolveSequenceRegion(
    seq: ResolvedSequence,
    trackIndex: number,
    trackId: string
  ): SequenceHitRegion | null {
    const modifiers = seq.modifiers || [];
    const transMod = modifiers.find((m: any) => m.type === 'transform');
    const shapeMod = modifiers.find((m: any) => m.type === 'shape/vector' || m.type === 'shape/draw');
    const textMod = modifiers.find((m: any) => m.type === 'text/style');

    const tp = (transMod?.params || {}) as any;
    const normX = Number.isFinite(tp.normX) ? tp.normX : 0.5;
    const normY = Number.isFinite(tp.normY) ? tp.normY : 0.5;

    // 1. Text & Subtitles archetype
    if (textMod || (seq.cues && seq.cues.length > 0) || seq.type === 'text') {
      const p = (textMod?.params || {}) as any;
      const marginV = p.marginV ?? 65;
      const marginVNorm = marginV / 1080;
      const cueText = seq.cues?.[0]?.text || seq.name || 'Subtitle';
      const textLen = Math.max(10, Math.min(80, cueText.length));
      const normW = Math.min(0.85, Math.max(0.25, (textLen * 18) / 1920));
      const normH = 0.08; // ~86px height on 1080p

      let yPos = 1.0 - marginVNorm - normH / 2;
      if (p.position === 'top') yPos = marginVNorm + normH / 2;
      else if (p.position === 'center') yPos = 0.5;

      return {
        sequenceId: seq.id,
        sequenceType: 'text',
        trackIndex,
        trackId,
        normX: 0.5,
        normY: yPos,
        normWidth: normW,
        normHeight: normH,
        label: `Subtitle: "${cueText.slice(0, 20)}${cueText.length > 20 ? '...' : ''}"`,
        zIndex: 100 + trackIndex,
      };
    }

    // 3. Vector Shapes archetype
    if (shapeMod) {
      const sp = (shapeMod.params || {}) as any;
      const rawW = sp.width ?? 320;
      const rawH = sp.height ?? 180;
      return {
        sequenceId: seq.id,
        sequenceType: 'shape',
        trackIndex,
        trackId,
        normX,
        normY,
        normWidth: Math.max(0.04, rawW / 1920),
        normHeight: Math.max(0.04, rawH / 1080),
        label: `Shape: ${sp.shapeType || 'vector'}`,
        zIndex: 50 + trackIndex,
      };
    }

    // 4. Visual Media / Video / Image archetype (Exclude pure audio tracks)
    if (seq.type === 'video' || seq.type === 'image' || (seq.assetId && !trackId.includes('audio') && !trackId.includes('a1') && !trackId.includes('a2'))) {
      const scale = Number.isFinite(tp.scale) ? tp.scale : 1.0;
      return {
        sequenceId: seq.id,
        sequenceType: (seq.type as any) || 'video',
        trackIndex,
        trackId,
        normX,
        normY,
        normWidth: Math.min(1.0, 0.9 * scale),
        normHeight: Math.min(1.0, 0.9 * scale),
        label: seq.name || seq.id,
        zIndex: 10 + trackIndex,
      };
    }

    return null;
  }
}
