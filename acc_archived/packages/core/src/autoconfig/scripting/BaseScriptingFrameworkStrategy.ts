import type { PipelineIR, ContentChunk, SfxMarker } from '@acc/ir';
import type {
  IScriptingFrameworkStrategy,
  ScriptBeat,
  ScriptPromptPayload,
} from './IScriptingFrameworkStrategy';

/**
 * BaseScriptingFrameworkStrategy
 *
 * Implements common scaling, chunk synchronization, audio ducking,
 * and SFX marker generation for all 6 Master Scripting Frameworks.
 * Adheres strictly to STATE-IMMUTABILITY and DEFENSIVE-CODING principles.
 */
export abstract class BaseScriptingFrameworkStrategy implements IScriptingFrameworkStrategy {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly description: string;
  public abstract readonly targetStyles: string[];
  public readonly aliases: string[] = [];

  /**
   * Framework-specific default ducking profile.
   */
  protected duckingProfile: {
    attenuationDb: number;
    attackMs: number;
    releaseMs: number;
  } = {
    attenuationDb: -14,
    attackMs: 150,
    releaseMs: 300,
  };

  /**
   * Subclasses define their prototypical beats for a default duration.
   */
  protected abstract getNominalBeats(topic: string, rawContent?: string): ScriptBeat[];

  public generateBeatsSync(input: ScriptPromptPayload): ScriptBeat[] {
    const topic = input.topic || 'Untitled Topic';
    const nominalBeats = this.getNominalBeats(topic, input.rawContent);

    if (nominalBeats.length === 0) {
      return [];
    }

    const nominalTotal = nominalBeats[nominalBeats.length - 1].timingSec[1];
    const targetTotal = input.targetDurationSec && input.targetDurationSec > 0
      ? input.targetDurationSec
      : nominalTotal;

    if (Math.abs(nominalTotal - targetTotal) < 0.01) {
      return nominalBeats;
    }

    // Scale beat timings proportionally to fit targetDurationSec
    const scaleFactor = targetTotal / nominalTotal;
    let accumulated = 0;

    return nominalBeats.map((beat, idx) => {
      const isLast = idx === nominalBeats.length - 1;
      const startSec = accumulated;
      const endSec = isLast ? targetTotal : Math.round((beat.timingSec[1] * scaleFactor) * 10) / 10;
      accumulated = endSec;

      return {
        ...beat,
        timingSec: [startSec, endSec],
      };
    });
  }

  public async generateBeats(input: ScriptPromptPayload): Promise<ScriptBeat[]> {
    return this.generateBeatsSync(input);
  }

  public applyToPipelineIR(ir: PipelineIR, beats: ScriptBeat[]): PipelineIR {
    // 1. Deep clone PipelineIR to preserve STATE-IMMUTABILITY
    const clonedIR: PipelineIR = JSON.parse(JSON.stringify(ir));

    if (!beats || beats.length === 0) {
      return clonedIR;
    }

    // 2. Synchronize chunks with beats
    const existingChunks = clonedIR.chunks || [];
    let updatedChunks: ContentChunk[] = [];

    if (existingChunks.length <= 1) {
      // Single chunk or fallback chunk: replace with complete narrative beat chunks
      const baseChunk = existingChunks[0];
      updatedChunks = beats.map((beat, idx) => {
        const durationMs = Math.max(100, Math.round((beat.timingSec[1] - beat.timingSec[0]) * 1000));
        const text = beat.narrationTemplate
          ? beat.narrationTemplate.replace(/{topic}/g, clonedIR.metadata.title || 'the subject')
          : beat.description || beat.name;

        return {
          id: `chunk-${idx + 1}`,
          order: idx + 1,
          text,
          durationMs,
          visualAsset: baseChunk?.visualAsset,
          metadata: {
            ...(baseChunk?.metadata || {}),
            beat: beat.name,
            audioRole: beat.audioRole,
            visualPacing: beat.visualPacing,
            sfxCue: beat.sfxCue,
            cameraPreset: beat.cameraPreset,
            typographyStyle: beat.typographyStyle,
          },
        };
      });
    } else if (existingChunks.length === beats.length) {
      // 1-to-1 match: enrich existing chunks with beat directives and adjusted duration
      updatedChunks = existingChunks.map((chunk, idx) => {
        const beat = beats[idx];
        const durationMs = Math.max(100, Math.round((beat.timingSec[1] - beat.timingSec[0]) * 1000));

        return {
          ...chunk,
          durationMs,
          text: chunk.text || (beat.narrationTemplate
            ? beat.narrationTemplate.replace(/{topic}/g, clonedIR.metadata.title)
            : beat.description || beat.name),
          metadata: {
            ...(chunk.metadata || {}),
            beat: beat.name,
            audioRole: beat.audioRole,
            visualPacing: beat.visualPacing,
            sfxCue: beat.sfxCue,
            cameraPreset: beat.cameraPreset,
            typographyStyle: beat.typographyStyle,
          },
        };
      });
    } else {
      // Chunk count differs from beat count: distribute beats across chunks
      updatedChunks = existingChunks.map((chunk, idx) => {
        const beatIndex = Math.min(
          beats.length - 1,
          Math.floor((idx / existingChunks.length) * beats.length)
        );
        const beat = beats[beatIndex];

        return {
          ...chunk,
          metadata: {
            ...(chunk.metadata || {}),
            beat: beat.name,
            audioRole: beat.audioRole,
            visualPacing: beat.visualPacing,
            sfxCue: beat.sfxCue,
            cameraPreset: beat.cameraPreset,
            typographyStyle: beat.typographyStyle,
          },
        };
      });
    }

    clonedIR.chunks = updatedChunks;

    // 3. Audio Staging: SFX markers & ducking profile
    const existingMarkers: SfxMarker[] = clonedIR.audioComposition.sfxMarkers || [];
    const newMarkers: SfxMarker[] = [...existingMarkers];

    for (const beat of beats) {
      if (beat.sfxCue) {
        const timeMs = Math.round(beat.timingSec[0] * 1000);
        // Avoid duplicate markers at same timestamp and cue
        const exists = newMarkers.some(
          (m) => Math.abs(m.timeMs - timeMs) < 200 && m.sfxId === beat.sfxCue
        );
        if (!exists) {
          newMarkers.push({
            timeMs,
            sfxId: beat.sfxCue,
            volume: 0.8,
          });
        }
      }
    }

    // Sort SFX markers chronologically
    newMarkers.sort((a, b) => a.timeMs - b.timeMs);

    clonedIR.audioComposition = {
      ...clonedIR.audioComposition,
      ducking: {
        enabled: true,
        attenuationDb: this.duckingProfile.attenuationDb,
        attackMs: this.duckingProfile.attackMs,
        releaseMs: this.duckingProfile.releaseMs,
      },
      sfxMarkers: newMarkers,
    };

    // 4. Metadata tags & Framework tracking
    const tags = new Set(clonedIR.metadata.tags || []);
    tags.add(`framework:${this.id}`);
    clonedIR.metadata.tags = Array.from(tags);
    clonedIR.metadata.framework = this.id;
    clonedIR.metadata.scriptBeats = beats;

    return clonedIR;
  }
}
