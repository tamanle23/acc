import fs from 'fs';
import path from 'path';
import type { ResolvedTimeline, ResolvedTrack, ResolvedSequence } from '../../types/VideoIR';
import { DeterministicAudioClock } from '../../compiler/DeterministicAudioClock';
import { FFIAudioDecoder, type DecodedAudioPCM } from '@acc/core';
import { DynamicAudioDuckingEngine } from './DynamicAudioDuckingEngine';

export interface DecoupledAudioMixResult {
  totalSamples: number;
  sampleRate: number;
  channels: number;
  durationSeconds: number;
  buffer: Float32Array; // Interleaved stereo PCM stream
}

export interface DecoupledAudioMixOptions {
  baseDir?: string;
}

/**
 * DecoupledAudioMixer:
 * Concurrently mixes all audio tracks (voiceover, background music, sound effects)
 * into a single contiguous PCM audio stream in memory.
 * Employs:
 * 1. FFIAudioDecoder: Decodes any format (MP3, WAV, AAC, FLAC) in-memory via bun:ffi
 * 2. DynamicAudioDuckingEngine: Continuous attack/hold/release sidechain gain envelope
 * 3. Infinite BGM looping with smooth cosine fade-in/fade-out
 * 4. Spatial constant-power stereo panning for SFX
 * 5. Tanh soft-clipping master brickwall limiter
 */
export class DecoupledAudioMixer {
  private sampleRate: number;
  private channels: number;
  private audioCache: Map<string, DecodedAudioPCM> = new Map();

  constructor(sampleRate: number = 48000, channels: number = 2) {
    this.sampleRate = sampleRate;
    this.channels = channels;
  }

  /**
   * Helper to decode standard 16/24/32-bit PCM WAV into mono/stereo Float32Array (fallback)
   */
  public async decodeWav(filePath: string): Promise<{ data: Float32Array; sampleRate: number; channels: number } | null> {
    const res = await this.decodeAsset(filePath);
    return res ? { data: res.data, sampleRate: res.sampleRate, channels: res.channels } : null;
  }

  /**
   * Universal audio decoder leveraging FFIAudioDecoder with memory caching.
   */
  public async decodeAsset(filePath: string): Promise<DecodedAudioPCM | null> {
    if (this.audioCache.has(filePath)) {
      return this.audioCache.get(filePath)!;
    }

    try {
      const decoded = await FFIAudioDecoder.decodeToPCM(filePath, this.sampleRate, this.channels);
      if (decoded) {
        this.audioCache.set(filePath, decoded);
        return decoded;
      }
    } catch {
      // Fallback below
    }
    return null;
  }

  public async mix(
    timeline: ResolvedTimeline,
    options: DecoupledAudioMixOptions = {}
  ): Promise<DecoupledAudioMixResult> {
    const totalSamples = DeterministicAudioClock.totalSamplesForFrames(
      timeline.totalFrames,
      this.sampleRate,
      timeline.meta.globalFps
    );

    // Master bus (Float32 interleaved stereo)
    const masterBuffer = new Float32Array(totalSamples * this.channels);
    // Dedicated voiceover bus for sidechain ducking analysis
    const voiceBuffer = new Float32Array(totalSamples * this.channels);

    // Collect tracks by type
    const voiceTracks: ResolvedTrack[] = [];
    const bgmTracks: ResolvedTrack[] = [];
    const sfxTracks: ResolvedTrack[] = [];

    for (const track of timeline.tracks.values()) {
      if (track.type === 'audio') {
        if (track.id.includes('voiceover') || track.id.includes('a1')) {
          voiceTracks.push(track);
        } else if (track.id.includes('bgm') || track.id.includes('a2')) {
          bgmTracks.push(track);
        } else {
          sfxTracks.push(track);
        }
      }
    }

    const baseDir = options.baseDir || '.';

    // --- PHASE 1: Render Voiceover Dialogue Track ---
    for (const track of voiceTracks) {
      for (const seq of track.sequences) {
        const startSample = Math.round(
          (seq.startFrame * this.sampleRate) / timeline.meta.globalFps
        );
        const durationSamples = Math.round(
          (seq.durationFrames * this.sampleRate) / timeline.meta.globalFps
        );
        const endSample = Math.min(totalSamples, startSample + durationSamples);

        let decoded: DecodedAudioPCM | null = null;
        if (seq.assetId && timeline.assets && timeline.assets[seq.assetId]) {
          const assetSrc = timeline.assets[seq.assetId].src;
          const resolvedPath = path.isAbsolute(assetSrc) ? assetSrc : path.resolve(baseDir, assetSrc);
          decoded = await this.decodeAsset(resolvedPath);
        }

        if (decoded) {
          const srcData = decoded.data;
          const totalSrcSamples = decoded.totalSamplesPerChannel;

          for (let s = startSample; s < endSample; s++) {
            const srcIdx = s - startSample;
            if (srcIdx >= totalSrcSamples) break;

            const outIdx = s * this.channels;
            const inIdx = srcIdx * this.channels;
            const left = srcData[inIdx];
            const right = srcData[inIdx + 1];

            voiceBuffer[outIdx] += left;
            voiceBuffer[outIdx + 1] += right;

            masterBuffer[outIdx] += left;
            masterBuffer[outIdx + 1] += right;
          }
        }
      }
    }

    // --- PHASE 2: Dynamic Sidechain Envelope Calculation ---
    // If ducking modifier is requested, calculate attack/hold/release curve from dialogue
    let duckingEnvelope: Float32Array | null = null;
    const hasDucking = bgmTracks.some(t => t.modifiers?.some(m => m.type === 'sfx/dynamic_ducking'));
    if (hasDucking) {
      duckingEnvelope = DynamicAudioDuckingEngine.generateEnvelope(voiceBuffer, totalSamples, {
        sampleRate: this.sampleRate,
        channels: this.channels,
        attenuationDb: -18.0,
        thresholdDb: -36.0,
        attackMs: 15,
        holdMs: 100,
        releaseMs: 300,
      });
    }

    // --- PHASE 3: Render Background Music (BGM) with Loop, Fade & Ducking ---
    for (const track of bgmTracks) {
      for (const seq of track.sequences) {
        const startSample = Math.round(
          (seq.startFrame * this.sampleRate) / timeline.meta.globalFps
        );
        const durationSamples = Math.round(
          (seq.durationFrames * this.sampleRate) / timeline.meta.globalFps
        );
        const endSample = Math.min(totalSamples, startSample + durationSamples);
        const baseGain = 0.25; // Default BGM volume multiplier

        let decoded: DecodedAudioPCM | null = null;
        if (seq.assetId && timeline.assets && timeline.assets[seq.assetId]) {
          const assetSrc = timeline.assets[seq.assetId].src;
          const resolvedPath = path.isAbsolute(assetSrc) ? assetSrc : path.resolve(baseDir, assetSrc);
          decoded = await this.decodeAsset(resolvedPath);
        }

        const fadeInSamples = Math.round(1.5 * this.sampleRate); // 1.5s smooth fade in
        const fadeOutSamples = Math.round(2.0 * this.sampleRate); // 2.0s smooth fade out

        if (decoded) {
          const srcData = decoded.data;
          const totalSrcSamples = decoded.totalSamplesPerChannel;

          for (let s = startSample; s < endSample; s++) {
            // Infinite looping via modulo
            const loopSampleIdx = (s - startSample) % totalSrcSamples;
            const inIdx = loopSampleIdx * this.channels;

            // Fade curves
            let fadeGain = 1.0;
            const tFromStart = s - startSample;
            const tFromEnd = endSample - s;
            if (tFromStart < fadeInSamples) {
              fadeGain = Math.sin((Math.PI * tFromStart) / (2 * fadeInSamples));
            } else if (tFromEnd < fadeOutSamples) {
              fadeGain = Math.sin((Math.PI * tFromEnd) / (2 * fadeOutSamples));
            }

            // Ducking curve
            let duckMultiplier = 1.0;
            if (duckingEnvelope) {
              duckMultiplier = duckingEnvelope[s];
            }

            const currentBgmGain = baseGain * fadeGain * duckMultiplier;
            const outIdx = s * this.channels;

            masterBuffer[outIdx] += srcData[inIdx] * currentBgmGain;
            masterBuffer[outIdx + 1] += srcData[inIdx + 1] * currentBgmGain;
          }
        } else {
          // Synthetic deterministic tone fallback
          for (let s = startSample; s < endSample; s++) {
            const outIdx = s * this.channels;
            let duckMultiplier = duckingEnvelope ? duckingEnvelope[s] : 1.0;
            const gain = 0.04 * duckMultiplier;
            masterBuffer[outIdx] += gain;
            masterBuffer[outIdx + 1] += gain;
          }
        }
      }
    }

    // --- PHASE 4: Render Sound Effects (SFX) with Stereo Panning ---
    for (const track of sfxTracks) {
      for (const seq of track.sequences) {
        const startSample = Math.round(
          (seq.startFrame * this.sampleRate) / timeline.meta.globalFps
        );
        const durationSamples = Math.round(
          (seq.durationFrames * this.sampleRate) / timeline.meta.globalFps
        );
        const endSample = Math.min(totalSamples, startSample + durationSamples);

        let decoded: DecodedAudioPCM | null = null;
        if (seq.assetId && timeline.assets && timeline.assets[seq.assetId]) {
          const assetSrc = timeline.assets[seq.assetId].src;
          const resolvedPath = path.isAbsolute(assetSrc) ? assetSrc : path.resolve(baseDir, assetSrc);
          decoded = await this.decodeAsset(resolvedPath);
        }

        // Constant power stereo panning math: pan in [-1.0, 1.0]
        const pan = (seq as any).spatialPan ?? 0.0;
        const clampedPan = Math.max(-1.0, Math.min(1.0, pan));
        const panAngle = ((clampedPan + 1.0) * Math.PI) / 4.0;
        const panLeftGain = Math.cos(panAngle);
        const panRightGain = Math.sin(panAngle);
        const sfxVolume = (seq as any).volume ?? 0.8;

        if (decoded) {
          const srcData = decoded.data;
          const totalSrcSamples = decoded.totalSamplesPerChannel;

          for (let s = startSample; s < endSample; s++) {
            const srcIdx = s - startSample;
            if (srcIdx >= totalSrcSamples) break;

            const inIdx = srcIdx * this.channels;
            const outIdx = s * this.channels;

            const monoEnergy = (srcData[inIdx] + srcData[inIdx + 1]) * 0.5;
            masterBuffer[outIdx] += monoEnergy * panLeftGain * sfxVolume;
            masterBuffer[outIdx + 1] += monoEnergy * panRightGain * sfxVolume;
          }
        }
      }
    }

    // --- PHASE 5: Tanh Soft-Clipping Master Bus Brickwall Limiter ---
    // Smoothly rounds any peaks approaching or exceeding ±1.0 to avoid harsh digital overflow: y = tanh(x)
    for (let i = 0; i < masterBuffer.length; i++) {
      masterBuffer[i] = Math.tanh(masterBuffer[i]);
    }

    return {
      totalSamples,
      sampleRate: this.sampleRate,
      channels: this.channels,
      durationSeconds: timeline.durationSeconds,
      buffer: masterBuffer,
    };
  }

  /**
   * Encodes a DecoupledAudioMixResult into a valid 16-bit stereo PCM WAV file on disk.
   */
  public static async exportToWav(filePath: string, mixResult: DecoupledAudioMixResult): Promise<void> {
    const totalFrames = mixResult.totalSamples;
    const channels = mixResult.channels;
    const sampleRate = mixResult.sampleRate;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = channels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = totalFrames * blockAlign;
    const totalBufferSize = 44 + dataSize;

    const buffer = Buffer.alloc(totalBufferSize);

    // RIFF chunk descriptor
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(totalBufferSize - 8, 4);
    buffer.write('WAVE', 8);

    // "fmt " sub-chunk
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // subchunk1 size (16 for PCM)
    buffer.writeUInt16LE(1, 20);  // audio format 1 = PCM
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(16, 34); // bits per sample

    // "data" sub-chunk
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Write 16-bit PCM samples with clipping protection
    let byteOffset = 44;
    const floatSamples = mixResult.buffer;
    const len = floatSamples.length;

    for (let i = 0; i < len; i++) {
      let s = floatSamples[i];
      if (s > 1.0) s = 1.0;
      else if (s < -1.0) s = -1.0;
      const int16 = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
      buffer.writeInt16LE(int16, byteOffset);
      byteOffset += 2;
    }

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }

    await fs.promises.writeFile(filePath, buffer);
  }
}
