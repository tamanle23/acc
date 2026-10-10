import path from 'path';
import type {
  VideoIRDocument,
  IRTrack,
  IRSequence,
  AssetDefinition,
} from '../types/VideoIR';
import type { PipelineIR, ContentChunk } from '../PipelineIR';
import type { IConfigToIRAdapter, AdapterOptions } from './IConfigToIRAdapter';

/**
 * PipelineIRToUniversalIRAdapter:
 * Bridges omnichannel pipeline ASTs (Pipelines 1, 2, 3) into
 * the canonical V1.0-Stable Universal Video IR document format.
 *
 * Enforces the Phase 4 architectural constraint:
 * Only invoked when video output modality is requested.
 */
export class PipelineIRToUniversalIRAdapter implements IConfigToIRAdapter<PipelineIR> {
  public readonly id = 'pipeline-ir-omnichannel';
  public readonly name = 'Omnichannel PipelineIR Adapter';
  public readonly version = '1.0.0';

  public canAdapt(config: unknown): boolean {
    if (!config || typeof config !== 'object') return false;
    const c = config as Record<string, unknown>;
    return Boolean(
      c.chunks &&
      Array.isArray(c.chunks) &&
      c.pipelineId &&
      typeof c.pipelineId === 'string'
    );
  }

  public adapt(ir: PipelineIR, options?: AdapterOptions): VideoIRDocument {
    return PipelineIRToUniversalIRAdapter.adapt(ir, options?.contentId, options?.baseDir as string | undefined);
  }

  public static adapt(
    ir: PipelineIR,
    contentId = `omnichannel_${Date.now()}`,
    baseDir?: string
  ): VideoIRDocument {
    const isVertical = ir.distributionHints?.targetAspectRatios?.includes('9:16') ?? true;
    const width = isVertical ? 1080 : 1920;
    const height = isVertical ? 1920 : 1080;
    const fps = 30;

    const assets: Record<string, AssetDefinition> = {};
    const videoSequences: IRSequence[] = [];
    const audioSequences: IRSequence[] = [];

    const resolvePath = (p: string | undefined): string => {
      if (!p) return '';
      if (!baseDir || path.isAbsolute(p)) return p;
      return path.resolve(baseDir, p);
    };

    let previousVideoSeqId: string | undefined = undefined;
    let previousAudioSeqId: string | undefined = undefined;

    const chunks = ir.chunks || [];
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const chunkIdx = idx + 1;
      const durationSeconds = (chunk.durationMs && chunk.durationMs > 0 ? chunk.durationMs : 3000) / 1000;
      const durationFrames = Math.max(1, Math.round(durationSeconds * fps));

      // 1. Visual Asset & Sequence
      let visualAssetPath = '';
      if (typeof chunk.visualAsset?.sourcePathOrBuffer === 'string') {
        visualAssetPath = resolvePath(chunk.visualAsset.sourcePathOrBuffer);
      }

      const visualAssetId = `asset_chunk_${chunkIdx}_vis`;
      if (visualAssetPath) {
        assets[visualAssetId] = {
          src: visualAssetPath,
          type: 'image',
        };
      }

      const videoSeqId = `seq_${chunkIdx}_vis`;
      const videoSeq: IRSequence = {
        id: videoSeqId,
        assetId: visualAssetPath ? visualAssetId : undefined,
        time: {
          start: previousVideoSeqId ? { after: previousVideoSeqId } : 0,
          duration: durationFrames,
        },
      };
      videoSequences.push(videoSeq);
      previousVideoSeqId = videoSeqId;

      // 2. Audio Asset & Narration Sequence
      const audioPath = resolvePath(chunk.spokenAudioPath);
      if (audioPath) {
        const audioAssetId = `asset_chunk_${chunkIdx}_aud`;
        assets[audioAssetId] = {
          src: audioPath,
          type: 'audio',
        };

        const audioSeqId = `seq_${chunkIdx}_aud`;
        const audioSeq: IRSequence = {
          id: audioSeqId,
          assetId: audioAssetId,
          time: {
            start: previousAudioSeqId ? { after: previousAudioSeqId } : 0,
            duration: durationFrames,
          },
        };
        audioSequences.push(audioSeq);
        previousAudioSeqId = audioSeqId;
      }
    }

    const tracks: IRTrack[] = [
      {
        id: 'track_v1_main',
        type: 'video',
        sequences: videoSequences,
      },
    ];

    if (audioSequences.length > 0) {
      tracks.push({
        id: 'track_a1_narration',
        type: 'audio',
        sequences: audioSequences,
      });
    }

    return {
      version: '1.0.0-stable',
      meta: {
        contentId,
        title: ir.metadata?.title || 'Omnichannel Deliverable',
        canvasSize: { w: width, h: height },
        globalFps: fps,
        targetPlatform: isVertical ? 'tiktok' : 'youtube',
      },
      assets,
      tracks,
    };
  }
}
