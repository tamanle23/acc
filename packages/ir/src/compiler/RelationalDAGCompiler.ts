import type {
  VideoIRDocument,
  IRSequence,
  ResolvedSequence,
  ResolvedTrack,
  ResolvedTimeline,
  RelationalStart,
  RelationalDuration,
} from '../types/VideoIR';
import { AssetMetadataProber, type AssetMetadata } from '../prober/AssetMetadataProber';
import { VideoIRSchemaValidator } from '../schema/VideoIRSchemaValidator';

export interface DAGCompileOptions {
  prober?: AssetMetadataProber;
}

/**
 * RelationalDAGCompiler:
 * Two-pass deterministic graph compiler that resolves relational timestamps
 * (after, syncWith, matchLengthOf, offsetFrames, paddingFrames, overlapFrames)
 * into an immutable absolute frame integer map.
 * Enforces Kahn's algorithm for circular dependency & deadlock detection.
 */
export class RelationalDAGCompiler {
  private prober: AssetMetadataProber;

  constructor(options: DAGCompileOptions = {}) {
    this.prober = options.prober || new AssetMetadataProber();
  }

  public async compile(doc: VideoIRDocument): Promise<ResolvedTimeline> {
    // 0. Validate Schema
    const validation = VideoIRSchemaValidator.validate(doc);
    if (!validation.valid) {
      throw new Error(`Video IR Schema Validation Failed:\n- ${validation.errors.join('\n- ')}`);
    }

    const fps = doc.meta.globalFps;
    const flatSequences: { seq: IRSequence; trackId: string }[] = [];
    const seqMap = new Map<string, IRSequence>();
    const trackMap = new Map<string, ResolvedTrack>();

    for (const track of doc.tracks) {
      trackMap.set(track.id, {
        id: track.id,
        type: track.type,
        style: track.style,
        modifiers: track.modifiers,
        sequences: [],
      });

      for (const seq of track.sequences) {
        if (seqMap.has(seq.id)) {
          throw new Error(`Duplicate sequence ID "${seq.id}" across tracks`);
        }
        seqMap.set(seq.id, seq);
        flatSequences.push({ seq, trackId: track.id });
      }
    }

    // Pre-probe all assets declared in registry
    const probedAssets = new Map<string, AssetMetadata>();
    if (doc.assets) {
      for (const [assetId, assetDef] of Object.entries(doc.assets)) {
        const meta = await this.prober.probe(assetId, assetDef.src, assetDef.type, fps);
        probedAssets.set(assetId, meta);
      }
    }

    // PASS 1: Resolve Durations (Topological duration resolution)
    const durationMap = new Map<string, number>();
    await this.resolveDurations(flatSequences, probedAssets, durationMap, fps);

    // PASS 2: Resolve Start and End Frames (Topological start position resolution)
    const resolvedSequences = new Map<string, ResolvedSequence>();
    this.resolveStartFrames(flatSequences, durationMap, resolvedSequences);

    // Group resolved sequences into their parent tracks
    let maxEndFrame = 0;
    for (const resSeq of resolvedSequences.values()) {
      const track = trackMap.get(resSeq.trackId);
      if (track) {
        track.sequences.push(resSeq);
      }
      if (resSeq.endFrame > maxEndFrame) {
        maxEndFrame = resSeq.endFrame;
      }
    }

    // Sort sequences in each track by startFrame
    for (const track of trackMap.values()) {
      track.sequences.sort((a, b) => a.startFrame - b.startFrame);
    }

    const totalFrames = maxEndFrame;
    const durationSeconds = totalFrames > 0 ? parseFloat((totalFrames / fps).toFixed(3)) : 0;

    return {
      meta: doc.meta,
      assets: doc.assets,
      tracks: trackMap,
      sequences: resolvedSequences,
      totalFrames,
      durationSeconds,
    };
  }

  /**
   * Pass 1: Resolves durationFrames for each sequence.
   * Handles explicit integer, matchAssetDuration, and relational matchLengthOf.
   */
  private async resolveDurations(
    items: { seq: IRSequence; trackId: string }[],
    assets: Map<string, AssetMetadata>,
    durationMap: Map<string, number>,
    fps: number
  ): Promise<void> {
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const { seq } of items) {
      adj.set(seq.id, []);
      inDegree.set(seq.id, 0);
    }

    for (const { seq } of items) {
      const d = seq.time.duration;
      if (d && typeof d === 'object' && 'matchLengthOf' in d && d.matchLengthOf) {
        const target = d.matchLengthOf;
        if (!inDegree.has(target)) {
          throw new Error(`Sequence "${seq.id}" duration references non-existent sequence "${target}"`);
        }
        adj.get(target)!.push(seq.id);
        inDegree.set(seq.id, inDegree.get(seq.id)! + 1);
      }
    }

    // Kahn's algorithm queue
    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    let processedCount = 0;
    while (queue.length > 0) {
      const currId = queue.shift()!;
      processedCount++;

      const item = items.find(i => i.seq.id === currId)!;
      const seq = item.seq;
      let dur = Math.round(5.0 * fps); // default 5s

      if (seq.time.duration !== undefined) {
        if (typeof seq.time.duration === 'number') {
          dur = Math.max(1, Math.round(seq.time.duration));
        } else {
          const rd = seq.time.duration as RelationalDuration;
          if (rd.matchAssetDuration && seq.assetId && assets.has(seq.assetId)) {
            dur = assets.get(seq.assetId)!.durationFrames;
          } else if (rd.matchLengthOf) {
            const targetDur = durationMap.get(rd.matchLengthOf);
            if (targetDur === undefined) {
              throw new Error(`Target duration for "${rd.matchLengthOf}" not resolved yet`);
            }
            const padding = rd.paddingFrames || 0;
            dur = Math.max(1, targetDur + padding);
          }
        }
      } else if (seq.assetId && assets.has(seq.assetId)) {
        dur = assets.get(seq.assetId)!.durationFrames;
      }

      durationMap.set(currId, dur);

      for (const neighbor of adj.get(currId)!) {
        const newDeg = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (processedCount < items.length) {
      throw new Error('Cycle detected in sequence duration graph (matchLengthOf circular dependency)');
    }
  }

  /**
   * Pass 2: Resolves startFrame and endFrame for each sequence.
   * Handles explicit integer, chained `after`, and synchronized `syncWith`.
   */
  private resolveStartFrames(
    items: { seq: IRSequence; trackId: string }[],
    durationMap: Map<string, number>,
    resolvedSequences: Map<string, ResolvedSequence>
  ): void {
    const adj = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    for (const { seq } of items) {
      adj.set(seq.id, []);
      inDegree.set(seq.id, 0);
    }

    for (const { seq } of items) {
      const s = seq.time.start;
      if (typeof s === 'object') {
        const rs = s as RelationalStart;
        const depTarget = rs.after || rs.syncWith;
        if (depTarget) {
          if (!inDegree.has(depTarget)) {
            throw new Error(`Sequence "${seq.id}" start references non-existent sequence "${depTarget}"`);
          }
          adj.get(depTarget)!.push(seq.id);
          inDegree.set(seq.id, inDegree.get(seq.id)! + 1);
        }
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(id);
    }

    let processedCount = 0;
    while (queue.length > 0) {
      const currId = queue.shift()!;
      processedCount++;

      const item = items.find(i => i.seq.id === currId)!;
      const seq = item.seq;
      const duration = durationMap.get(currId)!;
      let startFrame = 0;

      if (typeof seq.time.start === 'number') {
        startFrame = Math.max(0, Math.round(seq.time.start));
      } else {
        const rs = seq.time.start as RelationalStart;
        if (rs.after) {
          const target = resolvedSequences.get(rs.after);
          if (!target) throw new Error(`Dependency target "${rs.after}" not resolved`);
          const overlap = rs.overlapFrames || 0;
          startFrame = Math.max(0, target.endFrame - overlap);
        } else if (rs.syncWith) {
          const target = resolvedSequences.get(rs.syncWith);
          if (!target) throw new Error(`Sync target "${rs.syncWith}" not resolved`);
          const offset = rs.offsetFrames || 0;
          startFrame = Math.max(0, target.startFrame + offset);
        }
      }

      const endFrame = startFrame + duration;
      resolvedSequences.set(currId, {
        id: currId,
        trackId: item.trackId,
        assetId: seq.assetId,
        startFrame,
        endFrame,
        durationFrames: duration,
        cues: seq.cues,
        modifiers: seq.modifiers,
      });

      for (const neighbor of adj.get(currId)!) {
        const newDeg = inDegree.get(neighbor)! - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (processedCount < items.length) {
      throw new Error('Cycle detected in sequence start timing graph (after/syncWith circular deadlock)');
    }
  }
}
