import fs from 'fs';
import path from 'path';
import { ptr, toArrayBuffer } from 'bun:ffi';
import { FFI, Structs, safeArrayBuffer, initFFI } from './index';
import { FFmpegManager } from '../FFmpegManager';

export interface DecodedAudioPCM {
  data: Float32Array; // Interleaved stereo Float32 PCM samples (L, R, L, R...)
  sampleRate: number; // e.g. 48000
  channels: number;   // e.g. 2
  totalSamplesPerChannel: number;
  durationSeconds: number;
}

/**
 * FFIAudioDecoder:
 * High-performance, zero-process in-memory audio decoder leveraging libavcodec, libavformat,
 * and libswresample via pure bun:ffi.
 * Decodes any audio format (MP3, WAV, AAC, FLAC, OGG, M4A) and standardizes directly
 * into 48,000 Hz 32-bit Float Stereo (AV_SAMPLE_FMT_FLT).
 */
export class FFIAudioDecoder {
  private static isInitialized = false;

  public static async prepare(): Promise<void> {
    if (this.isInitialized) return;
    await FFmpegManager.prepare();
    initFFI();
    this.isInitialized = true;
  }

  /**
   * Decodes an audio file completely into an interleaved 32-bit Float Stereo PCM buffer.
   */
  public static async decodeToPCM(
    filePath: string,
    targetSampleRate = 48000,
    targetChannels = 2
  ): Promise<DecodedAudioPCM | null> {
    await this.prepare();

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const inFmtPtr = new BigUint64Array(1);
    const url = Buffer.from(path.resolve(filePath) + '\0');
    const retAIn = FFI.avformat.avformat_open_input(ptr(inFmtPtr.buffer), ptr(url), 0n, 0n);
    if (retAIn !== 0) {
      return null;
    }

    const inAudioCtx = inFmtPtr[0];
    FFI.avformat.avformat_find_stream_info(inAudioCtx, 0n);

    const inFmtView = new DataView(safeArrayBuffer(inAudioCtx, 0, 64));
    const inNbStreams = inFmtView.getUint32(44, true);
    const inStreamsPtr = inFmtView.getBigUint64(48, true);
    const inStreamsArray = new DataView(safeArrayBuffer(inStreamsPtr, 0, inNbStreams * 8));

    let inAudioStreamIdx = -1;
    let inAudioCodecpar = 0n;
    for (let i = 0; i < inNbStreams; i++) {
      const sPtr = inStreamsArray.getBigUint64(i * 8, true);
      const cpPtr = new DataView(safeArrayBuffer(sPtr, 0, 64)).getBigUint64(16, true);
      const cpView = new DataView(safeArrayBuffer(cpPtr, 0, 160));
      if (cpView.getInt32(0, true) === 1) { // AVMEDIA_TYPE_AUDIO = 1
        inAudioStreamIdx = i;
        inAudioCodecpar = cpPtr;
        break;
      }
    }

    if (inAudioStreamIdx < 0 || !inAudioCodecpar) {
      const pInA = new BigUint64Array([inAudioCtx]);
      FFI.avformat.avformat_close_input(ptr(pInA.buffer));
      return null;
    }

    const inCpView = new DataView(safeArrayBuffer(inAudioCodecpar, 0, 160));
    const inCodecId = inCpView.getInt32(4, true);

    const inDecoder = FFI.avcodec.avcodec_find_decoder(inCodecId);
    if (!inDecoder) {
      const pInA = new BigUint64Array([inAudioCtx]);
      FFI.avformat.avformat_close_input(ptr(pInA.buffer));
      return null;
    }

    const inDecCtx = BigInt(FFI.avcodec.avcodec_alloc_context3(inDecoder));
    FFI.avcodec.avcodec_parameters_to_context(inDecCtx, inAudioCodecpar);
    if (FFI.avcodec.avcodec_open2(inDecCtx, inDecoder, 0n) < 0) {
      const pDec = new BigUint64Array([inDecCtx]);
      FFI.avcodec.avcodec_free_context(ptr(pDec.buffer));
      const pInA = new BigUint64Array([inAudioCtx]);
      FFI.avformat.avformat_close_input(ptr(pInA.buffer));
      return null;
    }

    // Configure Stereo output layout for resampler
    const outLayout = new Uint8Array(24);
    FFI.avutil.av_channel_layout_default(ptr(outLayout.buffer), targetChannels);
    let swrCtx: bigint = 0n;

    const inFrame = BigInt(FFI.avutil.av_frame_alloc());
    const readPkt = BigInt(FFI.avcodec.av_packet_alloc?.() || FFI.avcodec.avpacket_alloc());

    const chunks: Float32Array[] = [];
    let totalSamples = 0;

    try {
      while (FFI.avformat.av_read_frame(inAudioCtx, readPkt) >= 0) {
        const pView = new DataView(safeArrayBuffer(readPkt, 0, 64));
        if (pView.getInt32(36, true) === inAudioStreamIdx) {
          if (FFI.avcodec.avcodec_send_packet(inDecCtx, readPkt) === 0) {
            while (FFI.avcodec.avcodec_receive_frame(inDecCtx, inFrame) === 0) {
              const inFView = new DataView(safeArrayBuffer(inFrame, 0, 512));
              const nbSamples = inFView.getInt32(112, true);
              const inSampleFmt = inFView.getInt32(116, true);
              const inSampleRate = inFView.getInt32(180, true) || targetSampleRate;
              const extendedData = inFView.getBigUint64(96, true);

              if (!swrCtx) {
                const swrPtr = new BigUint64Array(1);
                FFI.swresample.swr_alloc_set_opts2(
                  ptr(swrPtr.buffer),
                  ptr(outLayout.buffer),
                  3, // AV_SAMPLE_FMT_FLT (Interleaved 32-bit float stereo)
                  targetSampleRate,
                  inFrame + 384n,
                  inSampleFmt,
                  inSampleRate,
                  0,
                  0n
                );
                FFI.swresample.swr_init(swrPtr[0]);
                swrCtx = swrPtr[0];
              }

              const outCapacity = Math.max(4096, Math.ceil((nbSamples * targetSampleRate) / inSampleRate) + 1024);
              const outInterleaved = new Float32Array(outCapacity * targetChannels);
              const outPtrs = new BigUint64Array([BigInt(ptr(outInterleaved))]);

              const converted = FFI.swresample.swr_convert(
                swrCtx,
                ptr(outPtrs.buffer),
                outCapacity,
                extendedData,
                nbSamples
              );

              if (converted > 0) {
                const slice = outInterleaved.slice(0, converted * targetChannels);
                chunks.push(slice);
                totalSamples += converted;
              }
              FFI.avutil.av_frame_unref(inFrame);
            }
          }
        }
        FFI.avcodec.av_packet_unref(readPkt);
      }

      // Flush resampler
      if (swrCtx) {
        const flushCap = 4096;
        const flushInterleaved = new Float32Array(flushCap * targetChannels);
        const flushPtrs = new BigUint64Array([BigInt(ptr(flushInterleaved))]);
        const flushed = FFI.swresample.swr_convert(swrCtx, ptr(flushPtrs.buffer), flushCap, 0n, 0);
        if (flushed > 0) {
          chunks.push(flushInterleaved.slice(0, flushed * targetChannels));
          totalSamples += flushed;
        }
      }
    } finally {
      if (swrCtx) {
        const pSwr = new BigUint64Array([swrCtx]);
        FFI.swresample.swr_free(ptr(pSwr.buffer));
      }
      const pFrame = new BigUint64Array([inFrame]);
      FFI.avutil.av_frame_free(ptr(pFrame.buffer));
      const pPkt = new BigUint64Array([readPkt]);
      FFI.avcodec.av_packet_free(ptr(pPkt.buffer));
      const pDec = new BigUint64Array([inDecCtx]);
      FFI.avcodec.avcodec_free_context(ptr(pDec.buffer));
      const pInA = new BigUint64Array([inAudioCtx]);
      FFI.avformat.avformat_close_input(ptr(pInA.buffer));
    }

    // Merge chunks into contiguous master Float32Array
    const merged = new Float32Array(totalSamples * targetChannels);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return {
      data: merged,
      sampleRate: targetSampleRate,
      channels: targetChannels,
      totalSamplesPerChannel: totalSamples,
      durationSeconds: totalSamples / targetSampleRate,
    };
  }
}
