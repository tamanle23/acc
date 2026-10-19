import path from 'path';
import type {
  VideoIRDocument,
  IRTrack,
  IRSequence,
  AssetDefinition,
  ModifierNode,
} from '../types/VideoIR';
import type { PipelineIR } from '../PipelineIR';
import type { IConfigToIRAdapter, AdapterOptions } from './IConfigToIRAdapter';
import type {
  FineGrainedVideoDirectorConfig,
  SegmentDirectorOverride,
} from '../types/FineGrainedVideoDirectorConfig';

/**
 * PipelineIRToUniversalIRAdapter:
 * Bridges omnichannel pipeline ASTs (Pipelines 1, 2, 3) into
 * the canonical V1.0-Stable Universal Video IR document format.
 *
 * Implements full 3-Tier Fine-Grained Polymorphic Video Director Control:
 * Tier 1: Global Canvas, Color Grading & Audio Staging
 * Tier 2: Domain Archetype Directives (chart, crypto, talking head)
 * Tier 3: Timeline & Segment Fine-Grained Overrides (3D depth, Ken Burns, transitions, SFX, typography)
 */
export class PipelineIRToUniversalIRAdapter implements IConfigToIRAdapter<PipelineIR> {
  public readonly id = 'pipeline-ir-omnichannel';
  public readonly name = 'Omnichannel PipelineIR Adapter';
  public readonly version = '2.0.0';

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
    const directorConfig = (options?.directorConfig || options?.videoConfig) as FineGrainedVideoDirectorConfig | undefined;
    return PipelineIRToUniversalIRAdapter.adapt(
      ir,
      options?.contentId,
      options?.baseDir as string | undefined,
      directorConfig
    );
  }

  public static adapt(
    ir: PipelineIR,
    contentId = `omnichannel_${Date.now()}`,
    baseDir?: string,
    directorConfig?: FineGrainedVideoDirectorConfig
  ): VideoIRDocument {
    // ─── TIER 1: GLOBAL CANVAS & RESOLUTION ──────────────────────────────
    const aspect =
      directorConfig?.canvas?.aspectRatio ||
      directorConfig?.aspectRatio ||
      ir.distributionHints?.targetAspectRatios?.[0] ||
      '9:16';

    let width = 1080;
    let height = 1920;
    let targetPlatform = 'tiktok';

    if (aspect === '16:9') {
      width = 1920;
      height = 1080;
      targetPlatform = 'youtube';
    } else if (aspect === '1:1') {
      width = 1080;
      height = 1080;
      targetPlatform = 'instagram';
    } else if (aspect === '4:5') {
      width = 1080;
      height = 1350;
      targetPlatform = 'facebook';
    }

    const resolution = directorConfig?.canvas?.resolution;
    if (resolution === '720p') {
      width = Math.round(width * (720 / 1080));
      height = Math.round(height * (720 / 1080));
    } else if (resolution === '4k') {
      width = Math.round(width * 2);
      height = Math.round(height * 2);
    }

    const fps = directorConfig?.canvas?.fps || directorConfig?.fps || 30;

    const assets: Record<string, AssetDefinition> = {};
    const videoSequences: IRSequence[] = [];
    const audioSequences: IRSequence[] = [];
    const bgmSequences: IRSequence[] = [];
    const sfxSequences: IRSequence[] = [];
    const captionSequences: IRSequence[] = [];

    const resolvePath = (p: string | undefined): string => {
      if (!p) return '';
      if (!baseDir || path.isAbsolute(p)) return p;
      return path.resolve(baseDir, p);
    };

    let previousVideoSeqId: string | undefined = undefined;
    let previousAudioSeqId: string | undefined = undefined;
    let totalVideoFrames = 0;

    const chunks = ir.chunks || [];
    const totalChunks = chunks.length;

    // ─── TIER 3: TIMELINE & PER-SEGMENT RESOLUTION ───────────────────────
    for (let idx = 0; idx < totalChunks; idx++) {
      const chunk = chunks[idx];
      const chunkIdx = idx + 1;
      const chunkRole: 'hook' | 'body' | 'outro' =
        idx === 0 ? 'hook' : (idx === totalChunks - 1 && totalChunks > 1 ? 'outro' : 'body');

      // Resolve Segment Director Directives (Explicit Segment > Role > Defaults)
      const allSegments = directorConfig?.segments || (directorConfig as any)?.timeline?.segments;
      const hasZeroIndex = allSegments?.some((s: any) => s.index === 0);
      const explicitOverride =
        allSegments?.find((s: any) =>
          hasZeroIndex ? s.index === idx : s.index === chunkIdx
        ) ||
        (allSegments &&
        allSegments[idx] &&
        allSegments[idx].index === undefined
          ? allSegments[idx]
          : undefined);
      const roleOverride = directorConfig?.roleDirectives?.[chunkRole];

      const segmentDir: SegmentDirectorOverride = {
        ...roleOverride,
        ...explicitOverride,
        depth3d: explicitOverride?.depth3d ?? roleOverride?.depth3d,
        cameraMotion: explicitOverride?.cameraMotion ?? roleOverride?.cameraMotion,
        transition: explicitOverride?.transition ?? roleOverride?.transition,
        captions: explicitOverride?.captions ?? roleOverride?.captions,
        sfxCues: (explicitOverride?.sfxCues || []).concat(roleOverride?.sfxCues || []),
      };

      const durationMs =
        segmentDir.durationMs ||
        (chunk.durationMs && chunk.durationMs > 0 ? chunk.durationMs : 3000);
      const durationSeconds = durationMs / 1000;
      const durationFrames = Math.max(1, Math.round(durationSeconds * fps));
      totalVideoFrames += durationFrames;

      // 1. Visual Asset & Modifiers
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

      const seqModifiers: ModifierNode[] = [];

      // A. 3D Depth Modifier (Parallax 2.5D, Sandwich, Frame Breaker)
      if (segmentDir.depth3d && segmentDir.depth3d.mode !== 'none') {
        seqModifiers.push({
          type: 'vfx/depth3d',
          target: ['video', 'image'],
          params: {
            mode: segmentDir.depth3d.mode,
            parallaxFactor: segmentDir.depth3d.parallaxFactor ?? 0.3,
            focusDepth: segmentDir.depth3d.focusDepth,
            depthMapUrl: segmentDir.depth3d.depthMapUrl
              ? resolvePath(segmentDir.depth3d.depthMapUrl)
              : undefined,
            enabled: segmentDir.depth3d.enabled ?? true,
          },
        });
      }

      // B. Camera & Cinematography Motion (3D Spline, Ken Burns, Pan, Dolly Zoom)
      if (segmentDir.cameraMotion && segmentDir.cameraMotion.type !== 'static') {
        if ((segmentDir.cameraMotion as any).type === '3d_spline' || (segmentDir.cameraMotion as any).keyframes) {
          seqModifiers.push({
            type: 'vfx/camera_3d',
            target: ['video', 'image', 'overlay'],
            params: {
              keyframes: (segmentDir.cameraMotion as any).keyframes,
              rackFocus: (segmentDir.cameraMotion as any).rackFocus,
            },
          });
        } else {
          seqModifiers.push({
            type: 'transform/ken_burns',
            target: ['video', 'image', 'overlay'],
            params: {
              type: segmentDir.cameraMotion.type,
              intensity: segmentDir.cameraMotion.intensity ?? 0.5,
            },
          });
        }
      }

      // C. Transition Modifier (Crossfade, Wipe, Glitch)
      if (segmentDir.transition && segmentDir.transition.type !== 'none') {
        const transFrames = Math.round((segmentDir.transition.durationMs / 1000) * fps);
        seqModifiers.push({
          type:
            segmentDir.transition.type === 'crossfade'
              ? 'transition/crossfade'
              : `transition/${segmentDir.transition.type}`,
          target: ['video', 'image', 'overlay'],
          params: {
            durationFrames: transFrames,
            easing: segmentDir.transition.easing || 'ease-in-out',
            overlapTarget: previousVideoSeqId,
          },
        });
      }

      const videoSeqId = `seq_${chunkIdx}_vis`;
      const videoSeq: IRSequence = {
        id: videoSeqId,
        type: 'video',
        assetId: visualAssetPath ? visualAssetId : undefined,
        time: {
          start: previousVideoSeqId ? { after: previousVideoSeqId } : 0,
          duration: durationFrames,
        },
        modifiers: seqModifiers.length > 0 ? seqModifiers : undefined,
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
          type: 'audio',
          assetId: audioAssetId,
          time: {
            start: previousAudioSeqId ? { after: previousAudioSeqId } : 0,
            duration: durationFrames,
          },
        };
        audioSequences.push(audioSeq);
        previousAudioSeqId = audioSeqId;
      }

      // 3. Segment SFX Cues (Sound design cue staging)
      if (segmentDir.sfxCues && segmentDir.sfxCues.length > 0) {
        segmentDir.sfxCues.forEach((cue, cueIdx) => {
          const sfxAssetId = `asset_sfx_${chunkIdx}_${cueIdx}`;
          assets[sfxAssetId] = {
            src: cue.customAssetPath ? resolvePath(cue.customAssetPath) : `sfx:${cue.sfxType}`,
            type: 'audio',
          };
          const cueOffsetFrames = Math.round((cue.offsetMs / 1000) * fps);
          sfxSequences.push({
            id: `seq_sfx_${chunkIdx}_${cueIdx}`,
            type: 'audio',
            assetId: sfxAssetId,
            time: {
              start: { syncWith: videoSeqId, offsetFrames: cueOffsetFrames },
              duration: Math.round(1.5 * fps),
            },
            modifiers: cue.volume !== undefined ? [
              {
                type: 'audio/gain',
                target: 'audio',
                params: { gain: cue.volume },
              },
            ] : undefined,
          });
        });
      }

      // 4. Captions & Typography Directives
      if (chunk.text && segmentDir.captions?.enabled !== false) {
        const captionText = segmentDir.captions?.text || chunk.text;
        const captionPreset =
          segmentDir.captions?.style ||
          directorConfig?.typography?.preset ||
          'tiktok_karaoke_glow';
        const highlightColor =
          segmentDir.captions?.highlightColor ||
          directorConfig?.typography?.highlightColor ||
          '#FFD700';
        const primaryColor =
          directorConfig?.typography?.primaryColor || '#FFFFFF';
        const yPositionRatio =
          segmentDir.captions?.yPositionRatio ??
          (directorConfig?.typography?.placement === 'top'
            ? 0.15
            : directorConfig?.typography?.placement === 'center'
            ? 0.5
            : 0.85);

        captionSequences.push({
          id: `seq_${chunkIdx}_caption`,
          type: 'text',
          time: {
            start: { syncWith: videoSeqId },
            duration: durationFrames,
          },
          cues: [
            {
              startOffsetMs: 0,
              endOffsetMs: 'end',
              text: captionText,
            },
          ],
          modifiers: [
            {
              type: 'text/typography',
              target: 'text',
              params: {
                preset: captionPreset,
                highlightColor,
                primaryColor,
                yPositionRatio,
                fontSize: directorConfig?.typography?.fontSize || 48,
              },
            },
          ],
        });
      }
    }

    // ─── TIER 1: GLOBAL COLOR GRADING & LUT ──────────────────────────────
    const videoTrackModifiers: ModifierNode[] = [];
    if (directorConfig?.canvas?.colorGrading) {
      const cg = directorConfig.canvas.colorGrading;
      videoTrackModifiers.push({
        type: 'vfx/color_grading',
        target: ['video', 'image', 'overlay'],
        params: {
          lutPreset: cg.lutPreset,
          lutPath: cg.lutPath ? resolvePath(cg.lutPath) : undefined,
          contrast: cg.contrast ?? 1.0,
          saturation: cg.saturation ?? 1.0,
          vignette: cg.vignette ?? 0.0,
        },
      });
    }

    // ─── TIER 2: CONTENT ARCHETYPE DIRECTIVES ─────────────────────────────
    if (directorConfig?.archetypeDirectives) {
      const arch = directorConfig.archetypeDirectives;
      if (arch.chartVisuals) {
        videoTrackModifiers.push({
          type: 'vfx/chart_visuals',
          target: ['video', 'image', 'overlay'],
          params: arch.chartVisuals,
        });
      }
      if (arch.cryptoVisuals) {
        videoTrackModifiers.push({
          type: 'vfx/crypto_ticker',
          target: ['video', 'image', 'overlay'],
          params: arch.cryptoVisuals,
        });
      }
      if (arch.talkingHead) {
        videoTrackModifiers.push({
          type: 'vfx/talking_head',
          target: ['video', 'image', 'overlay'],
          params: arch.talkingHead,
        });
      }
      if (arch.narrativeStory) {
        videoTrackModifiers.push({
          type: 'vfx/cinematic_atmosphere',
          target: ['video', 'image', 'overlay'],
          params: arch.narrativeStory,
        });
      }
    }

    // ─── TIER 1: GLOBAL BGM AUDIO TRACK ──────────────────────────────────
    if (directorConfig?.audioStaging?.bgmTrack) {
      const bgmPath = resolvePath(directorConfig.audioStaging.bgmTrack);
      const bgmAssetId = 'asset_bgm_master';
      assets[bgmAssetId] = {
        src: bgmPath,
        type: 'audio',
      };
      bgmSequences.push({
        id: 'seq_bgm_master',
        type: 'audio',
        assetId: bgmAssetId,
        time: {
          start: 0,
          duration: { matchLengthOf: 'timeline' },
        },
        modifiers: [
          {
            type: 'audio/ducking',
            target: 'audio',
            params: {
              autoDucking: directorConfig.audioStaging.autoDucking ?? true,
              attenuationDb: directorConfig.audioStaging.duckingAttenuationDb ?? -14,
              volume: directorConfig.audioStaging.masterBgmVolume ?? 0.8,
            },
          },
        ],
      });
    }

    // ─── TRACK ASSEMBLY ──────────────────────────────────────────────────
    const tracks: IRTrack[] = [
      {
        id: 'track_v1_main',
        type: 'video',
        modifiers: videoTrackModifiers.length > 0 ? videoTrackModifiers : undefined,
        sequences: videoSequences,
      },
    ];

    if (captionSequences.length > 0) {
      tracks.push({
        id: 'track_t1_captions',
        type: 'timed_text',
        sequences: captionSequences,
      });
    }

    if (audioSequences.length > 0) {
      tracks.push({
        id: 'track_a1_narration',
        type: 'audio',
        sequences: audioSequences,
      });
    }

    if (bgmSequences.length > 0) {
      tracks.push({
        id: 'track_a2_bgm',
        type: 'audio',
        sequences: bgmSequences,
      });
    }

    if (sfxSequences.length > 0) {
      tracks.push({
        id: 'track_a3_sfx',
        type: 'audio',
        sequences: sfxSequences,
      });
    }

    return {
      version: '1.0.0-stable',
      meta: {
        contentId,
        title: ir.metadata?.title || 'Omnichannel Deliverable',
        canvasSize: { w: width, h: height },
        globalFps: fps,
        targetPlatform,
      },
      assets,
      tracks,
    };
  }
}
