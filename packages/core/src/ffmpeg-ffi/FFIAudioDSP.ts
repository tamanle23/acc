import { FFI, initFFI } from "./index";
import { ptr, toArrayBuffer } from "bun:ffi";
import fs from "fs";

export class FFIAudioDSP {
  /**
   * Decodes any audio file (MP3, WAV, M4A, OGG, FLAC) directly into a 16kHz mono Float32Array in memory.
   * Completely zero-disk, zero-spawn, zero-dependency.
   */
  public static async decodeTo16kMonoFloat32(audioPath: string): Promise<Float32Array> {
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    initFFI();

    const fmtCtxPtr = new BigUint64Array(1);
    const retOpen = FFI.avformat.avformat_open_input(
      ptr(fmtCtxPtr.buffer),
      Buffer.from(audioPath + "\0"),
      0n,
      0n
    );
    if (retOpen !== 0) {
      throw new Error(`Failed to open audio file: ${audioPath} (code: ${retOpen})`);
    }

    const fmtCtx = fmtCtxPtr[0];
    FFI.avformat.avformat_find_stream_info(fmtCtx, 0n);

    // Locate the first audio stream
    const fmtView = new DataView(toArrayBuffer(fmtCtx, 0, 64));
    const nbStreams = fmtView.getUint32(44, true);
    const streamsArrayPtr = fmtView.getBigUint64(48, true);
    const streamsArray = new DataView(toArrayBuffer(streamsArrayPtr, 0, nbStreams * 8));

    let audioStreamIdx = -1;
    let audioStreamPtr = 0n;
    let audioCodecparPtr = 0n;
    let codecId = 0;
    let inputChannels = 1;
    let inputSampleRate = 44100;

    for (let i = 0; i < nbStreams; i++) {
      const sPtr = streamsArray.getBigUint64(i * 8, true);
      const sView = new DataView(toArrayBuffer(sPtr, 0, 64));
      const cpPtr = sView.getBigUint64(16, true);
      const cpView = new DataView(toArrayBuffer(cpPtr, 0, 160));
      const codecType = cpView.getInt32(0, true); // 1 = AVMEDIA_TYPE_AUDIO

      if (codecType === 1) {
        audioStreamIdx = i;
        audioStreamPtr = sPtr;
        audioCodecparPtr = cpPtr;
        codecId = cpView.getInt32(4, true);
        inputChannels = cpView.getInt32(104, true) || 1;
        inputSampleRate = cpView.getInt32(152, true) || 44100;
        break;
      }
    }

    if (audioStreamIdx === -1) {
      const p = new BigUint64Array([fmtCtx]);
      FFI.avformat.avformat_close_input(ptr(p.buffer));
      throw new Error(`No audio stream found in: ${audioPath}`);
    }

    // Allocate & Open Decoder
    const decoder = FFI.avcodec.avcodec_find_decoder(codecId);
    if (!decoder) {
      const p = new BigUint64Array([fmtCtx]);
      FFI.avformat.avformat_close_input(ptr(p.buffer));
      throw new Error(`No decoder found for codec ID: ${codecId}`);
    }

    const decCtx = BigInt(FFI.avcodec.avcodec_alloc_context3(decoder));
    FFI.avcodec.avcodec_parameters_to_context(decCtx, audioCodecparPtr);
    const retCodecOpen = FFI.avcodec.avcodec_open2(decCtx, decoder, 0n);
    if (retCodecOpen < 0) {
      const p = new BigUint64Array([decCtx]);
      FFI.avcodec.avcodec_free_context(ptr(p.buffer));
      const pFmt = new BigUint64Array([fmtCtx]);
      FFI.avformat.avformat_close_input(ptr(pFmt.buffer));
      throw new Error(`Failed to open audio decoder (code: ${retCodecOpen})`);
    }

    // Setup Resampler (to Mono, 16000Hz, AV_SAMPLE_FMT_FLT = 3)
    const outLayout = new Uint8Array(24);
    FFI.avutil.av_channel_layout_default(ptr(outLayout.buffer), 1); // 1 channel mono

    const inLayout = new Uint8Array(24);
    FFI.avutil.av_channel_layout_default(ptr(inLayout.buffer), Math.max(1, inputChannels));

    const decCtxView = new DataView(toArrayBuffer(decCtx, 0, 200));
    // Sample format in AVCodecContext (offset 132 or default to FLTP = 8)
    const inSampleFmt = decCtxView.getInt32(132, true) >= 0 ? decCtxView.getInt32(132, true) : 8;

    const swrCtxPtr = new BigUint64Array(1);
    FFI.swresample.swr_alloc_set_opts2(
      ptr(swrCtxPtr.buffer),
      ptr(outLayout.buffer),
      3, // AV_SAMPLE_FMT_FLT
      16000,
      ptr(inLayout.buffer),
      inSampleFmt,
      inputSampleRate,
      0,
      0n
    );
    FFI.swresample.swr_init(swrCtxPtr[0]);

    const frame = BigInt(FFI.avutil.av_frame_alloc());
    const pkt = BigInt(FFI.avcodec.av_packet_alloc());
    const sampleChunks: Float32Array[] = [];
    let totalSampleCount = 0;

    try {
      while (FFI.avformat.av_read_frame(fmtCtx, pkt) >= 0) {
        const pktView = new DataView(toArrayBuffer(pkt, 0, 64));
        const streamIdx = pktView.getInt32(36, true);

        if (streamIdx === audioStreamIdx) {
          if (FFI.avcodec.avcodec_send_packet(decCtx, pkt) === 0) {
            while (FFI.avcodec.avcodec_receive_frame(decCtx, frame) === 0) {
              const fView = new DataView(toArrayBuffer(frame, 0, 200));
              const nbSamples = fView.getInt32(112, true);
              const extendedData = fView.getBigUint64(96, true);

              const outCapacity = Math.ceil((nbSamples * 16000) / inputSampleRate) + 256;
              const outBuf = new Float32Array(outCapacity);
              const outPtrs = new BigUint64Array([BigInt(ptr(outBuf))]);

              const converted = FFI.swresample.swr_convert(
                swrCtxPtr[0],
                ptr(outPtrs.buffer),
                outCapacity,
                extendedData,
                nbSamples
              );

              if (converted > 0) {
                const slice = outBuf.slice(0, converted);
                sampleChunks.push(slice);
                totalSampleCount += converted;
              }

              FFI.avutil.av_frame_unref(frame);
            }
          }
        }
        FFI.avcodec.av_packet_unref(pkt);
      }

      // Flush remaining frames in decoder
      FFI.avcodec.avcodec_send_packet(decCtx, 0n);
      while (FFI.avcodec.avcodec_receive_frame(decCtx, frame) === 0) {
        const fView = new DataView(toArrayBuffer(frame, 0, 200));
        const nbSamples = fView.getInt32(112, true);
        const extendedData = fView.getBigUint64(96, true);

        const outCapacity = Math.ceil((nbSamples * 16000) / inputSampleRate) + 256;
        const outBuf = new Float32Array(outCapacity);
        const outPtrs = new BigUint64Array([BigInt(ptr(outBuf))]);

        const converted = FFI.swresample.swr_convert(
          swrCtxPtr[0],
          ptr(outPtrs.buffer),
          outCapacity,
          extendedData,
          nbSamples
        );

        if (converted > 0) {
          const slice = outBuf.slice(0, converted);
          sampleChunks.push(slice);
          totalSampleCount += converted;
        }

        FFI.avutil.av_frame_unref(frame);
      }
    } finally {
      // Free frame & packet
      const pFrame = new BigUint64Array([frame]);
      FFI.avutil.av_frame_free(ptr(pFrame.buffer));

      const pPkt = new BigUint64Array([pkt]);
      FFI.avcodec.av_packet_free(ptr(pPkt.buffer));

      // Free resampler
      FFI.swresample.swr_free(ptr(swrCtxPtr.buffer));

      // Free codec context
      const pDec = new BigUint64Array([decCtx]);
      FFI.avcodec.avcodec_free_context(ptr(pDec.buffer));

      // Close format context
      const pFmt = new BigUint64Array([fmtCtx]);
      FFI.avformat.avformat_close_input(ptr(pFmt.buffer));
    }

    // Combine chunks into single Float32Array
    const result = new Float32Array(totalSampleCount);
    let offset = 0;
    for (const chunk of sampleChunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Generates a valid silent MP3 buffer of specified duration.
   */
  public static createSilentMp3Buffer(seconds: number = 5): Buffer {
    const framesCount = Math.ceil(seconds * 38.28125);
    const frame = Buffer.alloc(417);
    frame[0] = 0xff;
    frame[1] = 0xfb;
    frame[2] = 0x90;
    frame[3] = 0x04;
    return Buffer.concat(Array(framesCount).fill(frame));
  }
}
