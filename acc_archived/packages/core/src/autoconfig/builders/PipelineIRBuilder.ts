import type {
  PipelineIR,
  PipelineId,
  ContentChunk,
  AudioComposition,
  VisualAsset,
} from '@acc/ir';
import type {
  DiscoveredAssetManifest,
  ArchetypeScaffoldConfig,
} from '../types';
import type {
  IScriptingFrameworkStrategy,
  ScriptBeat,
} from '../scripting/IScriptingFrameworkStrategy';
import { ScriptingFrameworkRegistry } from '../scripting/ScriptingFrameworkRegistry';

/**
 * PipelineIRBuilder (GoF Builder Pattern)
 *
 * Incrementally constructs compliant, validated PipelineIR v3.0.0 documents.
 * Ensures zero intermediate corrupted states and handles autonomous media mapping
 * between discovered manifest assets and canonical pipeline chunks.
 */
export class PipelineIRBuilder {
  private schemaVersion: '3.0.0' | '3.1.0' = '3.0.0';
  private pipelineId: PipelineId;
  private jobId: string;
  private title: string = 'Untitled Autonomous Project';
  private tags: string[] = ['auto-config'];
  private author?: string;
  private chunks: ContentChunk[] = [];
  private audioComposition: AudioComposition;
  private structuredData?: Record<string, unknown>;
  private supportedExporters: Array<'video' | 'audio' | 'social' | 'static-web' | 'interactive-web' | 'live-stream'> = ['video'];
  private targetAspectRatios: Array<'9:16' | '16:9' | '1:1'> = ['9:16'];
  private scriptingFramework?: IScriptingFrameworkStrategy;
  private scriptBeats?: ScriptBeat[];

  constructor(pipelineId: PipelineId = 'generative-storytelling') {
    this.pipelineId = pipelineId;
    this.jobId = `job-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    this.audioComposition = {
      ducking: {
        enabled: true,
        attenuationDb: -14,
        attackMs: 200,
        releaseMs: 350,
      },
      sfxMarkers: [],
    };
  }

  public setPipelineId(pipelineId: PipelineId): this {
    this.pipelineId = pipelineId;
    return this;
  }

  public setJobId(jobId: string): this {
    this.jobId = jobId;
    return this;
  }

  public setTitle(title: string): this {
    if (title && title.trim().length > 0) {
      this.title = title.trim();
    }
    return this;
  }

  public setAuthor(author: string): this {
    this.author = author;
    return this;
  }

  public setTags(tags: string[]): this {
    this.tags = [...tags];
    return this;
  }

  public addTag(tag: string): this {
    if (tag && !this.tags.includes(tag)) {
      this.tags.push(tag);
    }
    return this;
  }

  public addChunk(chunk: ContentChunk): this {
    this.chunks.push(chunk);
    return this;
  }

  public setChunks(chunks: ContentChunk[]): this {
    this.chunks = [...chunks];
    return this;
  }

  public setAudioComposition(composition: Partial<AudioComposition>): this {
    this.audioComposition = {
      ...this.audioComposition,
      ...composition,
      ducking: {
        ...this.audioComposition.ducking,
        ...(composition.ducking || {}),
      },
      sfxMarkers: composition.sfxMarkers || this.audioComposition.sfxMarkers,
    };
    return this;
  }

  public setStructuredData(data: Record<string, unknown>): this {
    this.structuredData = { ...data };
    return this;
  }

  public setDistributionHints(hints: {
    supportedExporters?: Array<'video' | 'audio' | 'social' | 'static-web' | 'interactive-web' | 'live-stream'>;
    targetAspectRatios?: Array<'9:16' | '16:9' | '1:1'>;
  }): this {
    if (hints.supportedExporters) {
      this.supportedExporters = [...hints.supportedExporters];
    }
    if (hints.targetAspectRatios) {
      this.targetAspectRatios = [...hints.targetAspectRatios];
    }
    return this;
  }

  public applyScriptingFramework(
    framework: IScriptingFrameworkStrategy | string,
    beats?: ScriptBeat[]
  ): this {
    if (typeof framework === 'string') {
      const resolved = ScriptingFrameworkRegistry.get(framework);
      if (!resolved) {
        throw new Error(`PipelineIRBuilder: Unknown scripting framework '${framework}'`);
      }
      this.scriptingFramework = resolved;
    } else {
      this.scriptingFramework = framework;
    }
    if (beats && beats.length > 0) {
      this.scriptBeats = [...beats];
    }
    return this;
  }

  public setScriptBeats(beats: ScriptBeat[]): this {
    this.scriptBeats = [...beats];
    return this;
  }

  /**
   * Autonomous mapping of DiscoveredAssetManifest assets to PipelineIR chunks & audio staging.
   */
  public populateFromManifest(
    manifest: DiscoveredAssetManifest,
    archetypeDefaults: ArchetypeScaffoldConfig
  ): this {
    // 1. Title and Pipeline ID
    this.setTitle(manifest.suggestedTitle || archetypeDefaults.suggestedTitle);
    this.setPipelineId(archetypeDefaults.canonicalPipelineId);

    // 2. Audio Composition
    const bgmAsset = manifest.audio.find(
      (a) => a.classification === 'music' || a.classification === 'ambient'
    );
    if (bgmAsset) {
      this.audioComposition.backgroundMusic = {
        audioPath: bgmAsset.relativePath,
        volume: archetypeDefaults.pipelineId === '6' ? 0.8 : 0.25,
        loop: true,
      };
    }

    if (manifest.hasVoiceover) {
      this.audioComposition.narrationTrack = {
        sampleRate: 44100,
        channels: 2,
        loudnessLufs: -14,
      };
    }

    // 3. Modality & Aspect distribution hints
    const exporters: Array<'video' | 'audio' | 'social' | 'static-web' | 'interactive-web' | 'live-stream'> = [];
    for (const mod of archetypeDefaults.suggestedModalities) {
      if (mod === 'video') exporters.push('video');
      else if (mod === 'audio') exporters.push('audio');
      else if (mod === 'social') exporters.push('social');
      else if (mod === 'web') exporters.push('static-web');
      else if (mod === 'interactive') exporters.push('interactive-web');
    }
    if (!exporters.includes('video')) exporters.unshift('video');

    this.setDistributionHints({
      supportedExporters: exporters,
      targetAspectRatios: [archetypeDefaults.defaultAspect],
    });

    // 4. Structured Data (if Pipeline 2 or data present)
    if (manifest.data.length > 0) {
      const primaryData = manifest.data[0];
      this.setStructuredData({
        sourceFile: primaryData.relativePath,
        format: primaryData.extension,
        rowCount: primaryData.rowCount,
        headers: primaryData.headers,
        sampleData: primaryData.sampleData,
      });
    }

    // 5. Synthesize Chunks
    this.chunks = [];

    if (manifest.pairedPairs.length > 0) {
      // High-precision pairing discovered by prober
      for (const pair of manifest.pairedPairs) {
        const visualAsset: VisualAsset | undefined = pair.visual
          ? {
              type: pair.visual.type === 'video' ? 'video' : 'image',
              sourcePathOrBuffer: pair.visual.relativePath,
              resolution: {
                width:
                  pair.visual.width ||
                  (archetypeDefaults.defaultAspect === '9:16' ? 1080 : 1920),
                height:
                  pair.visual.height ||
                  (archetypeDefaults.defaultAspect === '9:16' ? 1920 : 1080),
              },
            }
          : undefined;

        this.addChunk({
          id: `chunk-${pair.index}`,
          order: pair.index,
          text: pair.scriptText || '',
          spokenAudioPath: pair.audio?.relativePath,
          durationMs:
            pair.audio?.durationMs ||
            archetypeDefaults.chunkDurationMs ||
            3500,
          visualAsset,
          metadata: {
            sourceVisual: pair.visual?.fileName,
            sourceAudio: pair.audio?.fileName,
          },
        });
      }
    } else if (manifest.visuals.length > 0) {
      // Sequence images/videos chronologically
      const defaultDuration = archetypeDefaults.chunkDurationMs || 3500;
      for (let i = 0; i < manifest.visuals.length; i++) {
        const visual = manifest.visuals[i];
        const matchingAudio = manifest.audio[i];
        const duration =
          visual.durationMs && visual.durationMs > 0
            ? visual.durationMs
            : matchingAudio?.durationMs || defaultDuration;

        this.addChunk({
          id: `chunk-${i + 1}`,
          order: i + 1,
          text: manifest.scripts[0]?.lines[i] || '',
          spokenAudioPath: matchingAudio?.relativePath,
          durationMs: duration,
          visualAsset: {
            type: visual.type === 'video' ? 'video' : 'image',
            sourcePathOrBuffer: visual.relativePath,
            resolution: {
              width:
                visual.width ||
                (archetypeDefaults.defaultAspect === '9:16' ? 1080 : 1920),
              height:
                visual.height ||
                (archetypeDefaults.defaultAspect === '9:16' ? 1920 : 1080),
            },
          },
          metadata: {
            sourceVisual: visual.fileName,
          },
        });
      }
    } else if (manifest.scripts.length > 0) {
      // Text-driven chunking (Pipeline 1)
      const script = manifest.scripts[0];
      const validLines = script.lines.filter((l) => l.trim().length > 0);
      const lines = validLines.length > 0 ? validLines : [script.content];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const words = line.trim().split(/\s+/).length;
        // ~150 words per minute => ~400ms per word + 500ms pause
        const estimatedDurationMs = Math.max(2000, words * 400 + 500);

        this.addChunk({
          id: `chunk-${i + 1}`,
          order: i + 1,
          text: line,
          durationMs: estimatedDurationMs,
          metadata: {
            wordCount: words,
          },
        });
      }
    } else {
      // Default fallback chunk
      this.addChunk({
        id: 'chunk-1',
        order: 1,
        text: archetypeDefaults.suggestedTitle,
        durationMs: archetypeDefaults.chunkDurationMs || 4000,
      });
    }

    return this;
  }

  /**
   * Final validation and assembly of PipelineIR (v3.0.0).
   */
  public build(): PipelineIR {
    if (!this.pipelineId) {
      throw new Error('PipelineIRBuilder: pipelineId must be specified.');
    }
    if (!this.jobId) {
      throw new Error('PipelineIRBuilder: jobId must be specified.');
    }
    if (this.chunks.length === 0) {
      if (this.scriptingFramework || (this.scriptBeats && this.scriptBeats.length > 0)) {
        this.addChunk({
          id: 'chunk-1',
          order: 1,
          text: this.title,
          durationMs: 4000,
        });
      } else {
        throw new Error('PipelineIRBuilder: At least one chunk must be defined.');
      }
    }

    // Ensure chunks are sorted by order and have valid non-negative durations
    const sortedChunks = [...this.chunks]
      .sort((a, b) => a.order - b.order)
      .map((c, idx) => ({
        ...c,
        order: idx + 1,
        durationMs: Math.max(100, Math.round(c.durationMs)),
      }));

    const result: PipelineIR = {
      schemaVersion: this.schemaVersion,
      pipelineId: this.pipelineId,
      metadata: {
        jobId: this.jobId,
        title: this.title,
        createdAt: new Date().toISOString(),
        tags: [...this.tags],
        ...(this.author ? { author: this.author } : {}),
      },
      chunks: sortedChunks,
      audioComposition: {
        ...this.audioComposition,
      },
      ...(this.structuredData ? { structuredData: this.structuredData } : {}),
      distributionHints: {
        supportedExporters: [...this.supportedExporters],
        targetAspectRatios: [...this.targetAspectRatios],
      },
    };

    let finalResult = result;
    if (this.scriptingFramework) {
      let beats = this.scriptBeats;
      if (!beats && this.scriptingFramework.generateBeatsSync) {
        beats = this.scriptingFramework.generateBeatsSync({ topic: this.title });
      }
      if (beats && beats.length > 0) {
        finalResult = this.scriptingFramework.applyToPipelineIR(finalResult, beats);
      }
    } else if (this.scriptBeats && this.scriptBeats.length > 0) {
      const defaultFramework = ScriptingFrameworkRegistry.resolveForStyle('');
      finalResult = defaultFramework.applyToPipelineIR(finalResult, this.scriptBeats);
    }

    return finalResult;
  }
}
