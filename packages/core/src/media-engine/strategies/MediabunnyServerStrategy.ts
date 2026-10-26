import fs from 'fs';
import os from 'os';
import { registerMediabunnyServer } from '@mediabunny/server';
import {
  Input,
  Output,
  Mp4OutputFormat,
  FilePathSource,
  FilePathTarget,
  ALL_FORMATS,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  EncodedPacket,
} from 'mediabunny';
import { FFAudioMuxer } from '../../ffmpeg-ffi/FFAudioMuxer';
import type {
  IMediaEngineStrategy,
  MediaEngineType,
  MediaEngineCapabilities,
  IMediaFrameSink,
  IMediaProbeStrategy,
  IMediaConcatStrategy,
  IAudioMuxerStrategy,
  IChunkExecutionPolicy,
  MediaProbeResult,
  SinkInitMetadata,
} from '@acc/core-isomorphic';
import { MediaEngineError } from '@acc/core-isomorphic';
import { MediabunnyServerSink } from '../sinks/MediabunnyServerSink';

export class MediabunnyProbeStrategy implements IMediaProbeStrategy {
  public async probe(filePath: string): Promise<MediaProbeResult> {
    if (!fs.existsSync(filePath)) {
      throw new MediaEngineError('mediabunny-server', `File not found for probing: ${filePath}`);
    }

    try {
      const input = new Input({
        formats: ALL_FORMATS,
        source: new FilePathSource(filePath),
      });

      const durationSeconds = await input.computeDuration();
      const videoTrack = await input.getPrimaryVideoTrack();
      const audioTrack = await input.getPrimaryAudioTrack();

      let fps: number | undefined;
      if (videoTrack) {
        try {
          const metrics = await videoTrack.computeFrameRateMetrics();
          if (metrics && metrics.averageFps) {
            fps = Math.round(metrics.averageFps);
          }
        } catch {}
      }

      return {
        durationSeconds: durationSeconds || 0,
        width: videoTrack ? videoTrack.displayWidth : undefined,
        height: videoTrack ? videoTrack.displayHeight : undefined,
        fps,
        codecVideo: videoTrack ? videoTrack.codec : undefined,
        codecAudio: audioTrack ? audioTrack.codec : undefined,
        hasVideo: videoTrack !== null,
        hasAudio: audioTrack !== null,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new MediaEngineError('mediabunny-server', `Mediabunny probe failed on ${filePath}: ${msg}`);
    }
  }
}

export class MediabunnyConcatStrategy implements IMediaConcatStrategy {
  public async concatenate(inputPaths: string[], outputPath: string): Promise<void> {
    if (inputPaths.length === 0) {
      throw new MediaEngineError('mediabunny-server', 'No input files provided for concatenation.');
    }
    if (inputPaths.length === 1) {
      fs.copyFileSync(inputPaths[0], outputPath);
      return;
    }

    try {
      // Probe initial tracks
      const firstInput = new Input({ formats: ALL_FORMATS, source: new FilePathSource(inputPaths[0]) });
      const firstVideoTrack = await firstInput.getPrimaryVideoTrack();
      const firstAudioTrack = await firstInput.getPrimaryAudioTrack();

      if (!firstVideoTrack && !firstAudioTrack) {
        throw new MediaEngineError('mediabunny-server', 'Input file contains neither video nor audio tracks.');
      }

      let videoSource: EncodedVideoPacketSource | undefined;
      let videoDecoderConfig: unknown;
      if (firstVideoTrack) {
        videoDecoderConfig = await firstVideoTrack.getDecoderConfig();
        videoSource = new EncodedVideoPacketSource(firstVideoTrack.codec);
      }

      let audioSource: EncodedAudioPacketSource | undefined;
      let audioDecoderConfig: unknown;
      if (firstAudioTrack) {
        audioDecoderConfig = await firstAudioTrack.getDecoderConfig();
        audioSource = new EncodedAudioPacketSource(firstAudioTrack.codec);
      }

      const output = new Output({
        format: new Mp4OutputFormat(),
        target: new FilePathTarget(outputPath),
      });

      if (videoSource && firstVideoTrack) {
        output.addVideoTrack(videoSource, {
          width: firstVideoTrack.displayWidth,
          height: firstVideoTrack.displayHeight,
        });
      }

      if (audioSource) {
        output.addAudioTrack(audioSource);
      }

      await output.start();

      let videoTimeOffset = 0;
      let audioTimeOffset = 0;

      for (const inputPath of inputPaths) {
        const input = new Input({ formats: ALL_FORMATS, source: new FilePathSource(inputPath) });

        if (videoSource) {
          const vTrack = await input.getPrimaryVideoTrack();
          if (vTrack) {
            const trackDur = await vTrack.computeDuration();
            const vSink = new EncodedPacketSink(vTrack);
            let first = true;
            for await (const pkt of vSink.packets()) {
              const meta = (first || pkt.isKey) ? { decoderConfig: videoDecoderConfig } : undefined;
              const newPkt = new EncodedPacket(
                pkt.data,
                pkt.type,
                pkt.timestamp + videoTimeOffset,
                pkt.duration
              );
              videoSource.add(newPkt, meta as any);
              first = false;
            }
            videoTimeOffset += (trackDur || 0);
          }
        }

        if (audioSource) {
          const aTrack = await input.getPrimaryAudioTrack();
          if (aTrack) {
            const trackDur = await aTrack.computeDuration();
            const aSink = new EncodedPacketSink(aTrack);
            let first = true;
            for await (const pkt of aSink.packets()) {
              const meta = first ? { decoderConfig: audioDecoderConfig } : undefined;
              const newPkt = new EncodedPacket(
                pkt.data,
                pkt.type,
                pkt.timestamp + audioTimeOffset,
                pkt.duration
              );
              audioSource.add(newPkt, meta as any);
              first = false;
            }
            audioTimeOffset += (trackDur || 0);
          }
        }
      }

      await output.finalize();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new MediaEngineError('mediabunny-server', `Mediabunny lossless concatenation failed: ${msg}`);
    }
  }
}

export class MediabunnyAudioMuxerStrategy implements IAudioMuxerStrategy {
  public async muxAudioVideo(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
    try {
      await FFAudioMuxer.mux(videoPath, audioPath, outputPath);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new MediaEngineError('mediabunny-server', `Mediabunny audio multiplexing failed: ${msg}`);
    }
  }
}

export class MediabunnyServerChunkPolicy implements IChunkExecutionPolicy {
  public readonly supportsParallelExecution = true;
  public readonly executionMode = 'worker-thread';

  public getOptimalConcurrency(totalChunks: number, systemCores: number): number {
    const memFree = os.freemem() / (1024 * 1024 * 1024);
    const memLimit = Math.max(1, Math.floor(memFree / 1.5));
    const cpuLimit = Math.max(1, Math.min(systemCores, 4));
    return Math.min(totalChunks, cpuLimit, memLimit);
  }
}

/**
 * Mediabunny Server Media Engine Strategy.
 * Utilizes pure TypeScript demuxing/muxing combined with NodeAV server-side codecs.
 */
export class MediabunnyServerStrategy implements IMediaEngineStrategy {
  public readonly id: MediaEngineType = 'mediabunny-server';
  public readonly name: string = 'Mediabunny Server Engine (NodeAV & TypeScript Muxer)';

  public readonly capabilities: MediaEngineCapabilities = {
    supportsZeroCopyFFI: false,
    supportsComplexFilters: false,
    supportsRawFrameStream: true,
    supportsBrowserRuntime: false,
    requiresNativeBinaries: false,
  };

  private probeStrategy = new MediabunnyProbeStrategy();
  private concatStrategy = new MediabunnyConcatStrategy();
  private audioMuxerStrategy = new MediabunnyAudioMuxerStrategy();
  private chunkPolicy = new MediabunnyServerChunkPolicy();

  public validatePrerequisites(): void {
    try {
      registerMediabunnyServer();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new MediaEngineError('mediabunny-server', `Failed to initialize server codecs: ${msg}`);
    }
  }

  public createVideoSink(options?: SinkInitMetadata): IMediaFrameSink {
    return new MediabunnyServerSink();
  }

  public getProbeStrategy(): IMediaProbeStrategy {
    return this.probeStrategy;
  }

  public getConcatStrategy(): IMediaConcatStrategy {
    return this.concatStrategy;
  }

  public getAudioMuxerStrategy(): IAudioMuxerStrategy {
    return this.audioMuxerStrategy;
  }

  public getChunkPolicy(): IChunkExecutionPolicy {
    return this.chunkPolicy;
  }
}
