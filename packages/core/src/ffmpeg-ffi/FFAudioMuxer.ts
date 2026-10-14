// Phase 4: Audio Remuxer & FilterGraph Integration
import { FFI, safeArrayBuffer, initFFI } from "./index";
import { ptr } from "bun:ffi";
import fs from "fs";
import { FFmpegManager } from "../FFmpegManager";

export class FFAudioMuxer {
    /**
     * Lossless audio and video multiplexing via pure bun:ffi.
     * Takes an existing video file and an audio file (WAV/AAC/MP3),
     * and multiplexes them into an output MP4/MKV container at the packet level.
     */
    public static async mux(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
        await FFmpegManager.prepare();
        initFFI();

        if (!fs.existsSync(videoPath)) {
            throw new Error(`FFAudioMuxer: Video file does not exist: ${videoPath}`);
        }
        if (!fs.existsSync(audioPath)) {
            throw new Error(`FFAudioMuxer: Audio file does not exist: ${audioPath}`);
        }

        // 1. Open Video Input
        const inVideoPtr = new BigUint64Array(1);
        let ret = FFI.avformat.avformat_open_input(
            ptr(inVideoPtr.buffer),
            ptr(Buffer.from(videoPath + "\0")),
            0n,
            0n
        );
        if (ret < 0) throw new Error(`FFAudioMuxer: Failed to open video input: ${videoPath}`);
        const inVideoCtx = inVideoPtr[0];
        FFI.avformat.avformat_find_stream_info(inVideoCtx, 0n);

        // 2. Open Audio Input
        const inAudioPtr = new BigUint64Array(1);
        ret = FFI.avformat.avformat_open_input(
            ptr(inAudioPtr.buffer),
            ptr(Buffer.from(audioPath + "\0")),
            0n,
            0n
        );
        if (ret < 0) {
            const pV = new BigUint64Array([inVideoCtx]);
            FFI.avformat.avformat_close_input(ptr(pV.buffer));
            throw new Error(`FFAudioMuxer: Failed to open audio input: ${audioPath}`);
        }
        const inAudioCtx = inAudioPtr[0];
        FFI.avformat.avformat_find_stream_info(inAudioCtx, 0n);

        // Find primary video stream
        const vView = new DataView(safeArrayBuffer(inVideoCtx, 0, 64));
        const vNbStreams = vView.getUint32(44, true);
        const vStreamsArrayPtr = vView.getBigUint64(48, true);
        const vStreamsArray = new DataView(safeArrayBuffer(vStreamsArrayPtr, 0, vNbStreams * 8));

        let inVideoStreamIdx = -1;
        let inVideoStreamPtr = 0n;
        for (let i = 0; i < vNbStreams; i++) {
            const sPtr = vStreamsArray.getBigUint64(i * 8, true);
            const cpPtr = new DataView(safeArrayBuffer(sPtr, 0, 64)).getBigUint64(16, true);
            const cpView = new DataView(safeArrayBuffer(cpPtr, 0, 64));
            if (cpView.getInt32(0, true) === 0) { // AVMEDIA_TYPE_VIDEO = 0
                inVideoStreamIdx = i;
                inVideoStreamPtr = sPtr;
                break;
            }
        }

        // Find primary audio stream
        const aView = new DataView(safeArrayBuffer(inAudioCtx, 0, 64));
        const aNbStreams = aView.getUint32(44, true);
        const aStreamsArrayPtr = aView.getBigUint64(48, true);
        const aStreamsArray = new DataView(safeArrayBuffer(aStreamsArrayPtr, 0, aNbStreams * 8));

        let inAudioStreamIdx = -1;
        let inAudioStreamPtr = 0n;
        for (let i = 0; i < aNbStreams; i++) {
            const sPtr = aStreamsArray.getBigUint64(i * 8, true);
            const cpPtr = new DataView(safeArrayBuffer(sPtr, 0, 64)).getBigUint64(16, true);
            const cpView = new DataView(safeArrayBuffer(cpPtr, 0, 64));
            if (cpView.getInt32(0, true) === 1) { // AVMEDIA_TYPE_AUDIO = 1
                inAudioStreamIdx = i;
                inAudioStreamPtr = sPtr;
                break;
            }
        }

        // 3. Allocate Output Format Context
        const outCtxPtr = new BigUint64Array(1);
        ret = FFI.avformat.avformat_alloc_output_context2(
            ptr(outCtxPtr.buffer),
            0n,
            0n,
            ptr(Buffer.from(outputPath + "\0"))
        );
        if (ret < 0) {
            const pV = new BigUint64Array([inVideoCtx]);
            FFI.avformat.avformat_close_input(ptr(pV.buffer));
            const pA = new BigUint64Array([inAudioCtx]);
            FFI.avformat.avformat_close_input(ptr(pA.buffer));
            throw new Error(`FFAudioMuxer: Failed to allocate output context for: ${outputPath}`);
        }
        const outCtx = outCtxPtr[0];

        // Output stream 0: Video
        let outVideoStream = 0n;
        if (inVideoStreamIdx >= 0) {
            outVideoStream = BigInt(FFI.avformat.avformat_new_stream(outCtx, 0n));
            const inStreamView = new DataView(safeArrayBuffer(inVideoStreamPtr, 0, 64));
            const outStreamView = new DataView(safeArrayBuffer(outVideoStream, 0, 64));

            const inCodecpar = inStreamView.getBigUint64(16, true);
            const outCodecpar = outStreamView.getBigUint64(16, true);
            FFI.avcodec.avcodec_parameters_copy(outCodecpar, inCodecpar);

            // Copy timebase
            outStreamView.setInt32(32, inStreamView.getInt32(32, true), true);
            outStreamView.setInt32(36, inStreamView.getInt32(36, true), true);

            const outCpView = new DataView(safeArrayBuffer(outCodecpar, 0, 64));
            outCpView.setUint32(8, 0, true); // Reset codec tag
        }

        // Output stream 1: Audio
        let outAudioStream = 0n;
        let isTranscodingAudio = false;
        let aCodecCtx: any = 0;
        let inDecCtx: any = 0;

        if (inAudioStreamIdx >= 0) {
            const inStreamView = new DataView(safeArrayBuffer(inAudioStreamPtr, 0, 64));
            const inCodecpar = inStreamView.getBigUint64(16, true);
            const inCpView = new DataView(safeArrayBuffer(inCodecpar, 0, 160));
            const inCodecId = inCpView.getInt32(4, true);

            // In MP4 containers, raw PCM audio (e.g. pcm_s16le, codec id 65536) is unsupported.
            // Transcode to AAC if container is MP4/MOV and audio is uncompressed PCM.
            const isMp4Container = outputPath.toLowerCase().endsWith('.mp4') || outputPath.toLowerCase().endsWith('.mov') || outputPath.toLowerCase().endsWith('.m4v');
            const isPcmAudio = inCodecId >= 65536 && inCodecId < 69632;

            if (isMp4Container && isPcmAudio) {
                const aacEncoder = FFI.avcodec.avcodec_find_encoder_by_name(ptr(Buffer.from("aac\0")));
                const inDecoder = FFI.avcodec.avcodec_find_decoder(inCodecId);

                if (aacEncoder && inDecoder) {
                    aCodecCtx = FFI.avcodec.avcodec_alloc_context3(aacEncoder);
                    FFI.avutil.av_opt_set_int(aCodecCtx, ptr(Buffer.from("ar\0")), 48000n, 0);
                    FFI.avutil.av_opt_set_int(aCodecCtx, ptr(Buffer.from("b\0")), 192000n, 0);
                    FFI.avutil.av_opt_set(aCodecCtx, ptr(Buffer.from("time_base\0")), ptr(Buffer.from("1/48000\0")), 0);
                    FFI.avutil.av_opt_set(aCodecCtx, ptr(Buffer.from("flags\0")), ptr(Buffer.from("+global_header\0")), 0);

                    const aacLayout = new Uint8Array(24);
                    FFI.avutil.av_channel_layout_default(ptr(aacLayout.buffer), 2);
                    FFI.avutil.av_opt_set_chlayout(aCodecCtx, ptr(Buffer.from("ch_layout\0")), ptr(aacLayout.buffer), 0);

                    const aCtxData = new DataView(safeArrayBuffer(aCodecCtx, 0, 500));
                    aCtxData.setInt32(348, 8, true); // sample_fmt = AV_SAMPLE_FMT_FLTP (8)

                    const retAOpen = FFI.avcodec.avcodec_open2(aCodecCtx, aacEncoder, 0n);

                    inDecCtx = BigInt(FFI.avcodec.avcodec_alloc_context3(inDecoder));
                    FFI.avcodec.avcodec_parameters_to_context(inDecCtx, inCodecpar);
                    const retDecOpen = FFI.avcodec.avcodec_open2(inDecCtx, inDecoder, 0n);

                    if (retAOpen >= 0 && retDecOpen >= 0) {
                        isTranscodingAudio = true;
                        outAudioStream = BigInt(FFI.avformat.avformat_new_stream(outCtx, 0n));
                        const outStreamView = new DataView(safeArrayBuffer(outAudioStream, 0, 64));
                        outStreamView.setInt32(32, 1, true);
                        outStreamView.setInt32(36, 48000, true);

                        const outCodecpar = outStreamView.getBigUint64(16, true);
                        FFI.avcodec.avcodec_parameters_from_context(outCodecpar, aCodecCtx);
                        const outCpView = new DataView(safeArrayBuffer(outCodecpar, 0, 64));
                        outCpView.setUint32(8, 0, true);
                    }
                }
            }

            if (!isTranscodingAudio) {
                outAudioStream = BigInt(FFI.avformat.avformat_new_stream(outCtx, 0n));
                const outStreamView = new DataView(safeArrayBuffer(outAudioStream, 0, 64));
                const outCodecpar = outStreamView.getBigUint64(16, true);
                FFI.avcodec.avcodec_parameters_copy(outCodecpar, inCodecpar);

                // Copy timebase
                outStreamView.setInt32(32, inStreamView.getInt32(32, true), true);
                outStreamView.setInt32(36, inStreamView.getInt32(36, true), true);

                const outCpView = new DataView(safeArrayBuffer(outCodecpar, 0, 64));
                outCpView.setUint32(8, 0, true); // Reset codec tag
            }
        }

        // Open AVIO output
        ret = FFI.avformat.avio_open(outCtx + 32n, ptr(Buffer.from(outputPath + "\0")), 2);
        if (ret < 0) {
            const pV = new BigUint64Array([inVideoCtx]);
            FFI.avformat.avformat_close_input(ptr(pV.buffer));
            const pA = new BigUint64Array([inAudioCtx]);
            FFI.avformat.avformat_close_input(ptr(pA.buffer));
            throw new Error(`FFAudioMuxer: Failed to open output AVIO: ${outputPath}`);
        }

        // Write container header
        ret = FFI.avformat.avformat_write_header(outCtx, 0n);
        if (ret < 0) {
            const pV = new BigUint64Array([inVideoCtx]);
            FFI.avformat.avformat_close_input(ptr(pV.buffer));
            const pA = new BigUint64Array([inAudioCtx]);
            FFI.avformat.avformat_close_input(ptr(pA.buffer));
            throw new Error(`FFAudioMuxer: Failed to write output header: ${outputPath}`);
        }

        const pkt = BigInt(FFI.avcodec.av_packet_alloc?.() || FFI.avcodec.avpacket_alloc());

        // Stream video packets (stream index 0)
        if (inVideoStreamIdx >= 0) {
            while (FFI.avformat.av_read_frame(inVideoCtx, pkt) >= 0) {
                const pktView = new DataView(safeArrayBuffer(pkt, 0, 128));
                const sIdx = pktView.getInt32(36, true);
                if (sIdx === inVideoStreamIdx) {
                    pktView.setInt32(36, 0, true); // target stream 0
                    FFI.avformat.av_interleaved_write_frame(outCtx, pkt);
                }
                FFI.avcodec.av_packet_unref(pkt);
            }
        }

        // Stream audio packets (stream index 1)
        if (inAudioStreamIdx >= 0) {
            if (isTranscodingAudio) {
                // Decode incoming PCM audio and encode to AAC stereo
                const outLayout = new Uint8Array(24);
                FFI.avutil.av_channel_layout_default(ptr(outLayout.buffer), 2);
                let swrCtx: bigint = 0n;

                const aFrame = BigInt(FFI.avutil.av_frame_alloc());
                const aFrameView = new DataView(safeArrayBuffer(aFrame, 0, 512));
                aFrameView.setInt32(112, 1024, true);
                aFrameView.setInt32(116, 8, true); // AV_SAMPLE_FMT_FLTP
                aFrameView.setInt32(180, 48000, true);
                FFI.avutil.av_channel_layout_default(aFrame + 384n, 2);
                FFI.avutil.av_frame_get_buffer(aFrame, 0);

                const inFrame = BigInt(FFI.avutil.av_frame_alloc());
                const aPkt = BigInt(FFI.avcodec.av_packet_alloc?.() || FFI.avcodec.avpacket_alloc());

                let fifoL: number[] = [];
                let fifoR: number[] = [];
                let audioFrameCount = 0n;

                const pushSamplesToEncoder = (flushAll = false) => {
                    while (fifoL.length >= 1024 || (flushAll && fifoL.length > 0)) {
                        const count = Math.min(1024, fifoL.length);
                        const fv = new DataView(safeArrayBuffer(aFrame, 0, 200));
                        fv.setInt32(112, 1024, true);

                        const dataPtrL = fv.getBigUint64(0, true);
                        const dataPtrR = fv.getBigUint64(8, true);

                        const arrL = new Float32Array(safeArrayBuffer(dataPtrL, 0, 1024 * 4));
                        const arrR = new Float32Array(safeArrayBuffer(dataPtrR, 0, 1024 * 4));

                        for (let i = 0; i < 1024; i++) {
                            if (i < count) {
                                arrL[i] = fifoL[i];
                                arrR[i] = fifoR[i];
                            } else {
                                arrL[i] = 0;
                                arrR[i] = 0;
                            }
                        }
                        fifoL.splice(0, count);
                        fifoR.splice(0, count);

                        fv.setBigInt64(136, audioFrameCount * 1024n, true);
                        audioFrameCount++;

                        FFI.avcodec.avcodec_send_frame(aCodecCtx, aFrame);
                        while (FFI.avcodec.avcodec_receive_packet(aCodecCtx, aPkt) === 0) {
                            const pktV = new DataView(safeArrayBuffer(aPkt, 0, 128));
                            pktV.setInt32(36, 1, true); // target audio stream 1
                            FFI.avformat.av_interleaved_write_frame(outCtx, aPkt);
                            FFI.avcodec.av_packet_unref(aPkt);
                        }
                    }
                };

                while (FFI.avformat.av_read_frame(inAudioCtx, pkt) >= 0) {
                    const pktView = new DataView(safeArrayBuffer(pkt, 0, 128));
                    const sIdx = pktView.getInt32(36, true);
                    if (sIdx === inAudioStreamIdx) {
                        if (FFI.avcodec.avcodec_send_packet(inDecCtx, pkt) === 0) {
                            while (FFI.avcodec.avcodec_receive_frame(inDecCtx, inFrame) === 0) {
                                const inFView = new DataView(safeArrayBuffer(inFrame, 0, 512));
                                const nbSamples = inFView.getInt32(112, true);
                                const inSampleFmt = inFView.getInt32(116, true);
                                const inSampleRate = inFView.getInt32(180, true) || 44100;
                                const extendedData = inFView.getBigUint64(96, true);

                                if (!swrCtx) {
                                    const swrPtr = new BigUint64Array(1);
                                    FFI.swresample.swr_alloc_set_opts2(
                                        ptr(swrPtr.buffer),
                                        ptr(outLayout.buffer),
                                        3, // AV_SAMPLE_FMT_FLT
                                        48000,
                                        inFrame + 384n,
                                        inSampleFmt,
                                        inSampleRate,
                                        0,
                                        0n
                                    );
                                    FFI.swresample.swr_init(swrPtr[0]);
                                    swrCtx = swrPtr[0];
                                }

                                const outCapacity = Math.max(8192, Math.ceil((nbSamples * 48000) / inSampleRate) + 2048);
                                const outInterleaved = new Float32Array(outCapacity * 2);
                                const outPtrs = new BigUint64Array([BigInt(ptr(outInterleaved))]);

                                const converted = FFI.swresample.swr_convert(
                                    swrCtx,
                                    ptr(outPtrs.buffer),
                                    outCapacity,
                                    extendedData,
                                    nbSamples
                                );

                                if (converted > 0) {
                                    for (let s = 0; s < converted; s++) {
                                        fifoL.push(outInterleaved[s * 2]);
                                        fifoR.push(outInterleaved[s * 2 + 1]);
                                    }
                                    pushSamplesToEncoder(false);
                                }
                                FFI.avutil.av_frame_unref(inFrame);
                            }
                        }
                    }
                    FFI.avcodec.av_packet_unref(pkt);
                }

                // Flush resampler
                if (swrCtx) {
                    const flushCap = 8192;
                    const flushInterleaved = new Float32Array(flushCap * 2);
                    const flushPtrs = new BigUint64Array([BigInt(ptr(flushInterleaved))]);
                    const flushedSwr = FFI.swresample.swr_convert(swrCtx, ptr(flushPtrs.buffer), flushCap, 0n, 0);
                    if (flushedSwr > 0) {
                        for (let s = 0; s < flushedSwr; s++) {
                            fifoL.push(flushInterleaved[s * 2]);
                            fifoR.push(flushInterleaved[s * 2 + 1]);
                        }
                    }
                }
                pushSamplesToEncoder(true);

                // Flush encoder
                FFI.avcodec.avcodec_send_frame(aCodecCtx, 0n);
                while (FFI.avcodec.avcodec_receive_packet(aCodecCtx, aPkt) === 0) {
                    const pktV = new DataView(safeArrayBuffer(aPkt, 0, 128));
                    pktV.setInt32(36, 1, true);
                    FFI.avformat.av_interleaved_write_frame(outCtx, aPkt);
                    FFI.avcodec.av_packet_unref(aPkt);
                }

                // Free audio transcode contexts
                const pDec = new BigUint64Array([inDecCtx]);
                FFI.avcodec.avcodec_free_context(ptr(pDec.buffer));
                const pEnc = new BigUint64Array([BigInt(aCodecCtx)]);
                FFI.avcodec.avcodec_free_context(ptr(pEnc.buffer));
                if (swrCtx) {
                    const pSwr = new BigUint64Array([swrCtx]);
                    FFI.swresample.swr_free(ptr(pSwr.buffer));
                }
                const pAF = new BigUint64Array([aFrame]);
                FFI.avutil.av_frame_free(ptr(pAF.buffer));
                const pInF = new BigUint64Array([inFrame]);
                FFI.avutil.av_frame_free(ptr(pInF.buffer));
                const pAP = new BigUint64Array([aPkt]);
                FFI.avcodec.av_packet_free(ptr(pAP.buffer));
            } else {
                while (FFI.avformat.av_read_frame(inAudioCtx, pkt) >= 0) {
                    const pktView = new DataView(safeArrayBuffer(pkt, 0, 128));
                    const sIdx = pktView.getInt32(36, true);
                    if (sIdx === inAudioStreamIdx) {
                        pktView.setInt32(36, 1, true); // target stream 1
                        FFI.avformat.av_interleaved_write_frame(outCtx, pkt);
                    }
                    FFI.avcodec.av_packet_unref(pkt);
                }
            }
        }

        // Write trailer & flush
        FFI.avformat.av_write_trailer(outCtx);

        // Cleanup
        const pPkt = new BigUint64Array([pkt]);
        FFI.avcodec.av_packet_free(ptr(pPkt.buffer));

        const outView = new DataView(safeArrayBuffer(outCtx, 0, 64));
        const pb = outView.getBigUint64(32, true);
        if (pb) {
            FFI.avformat.avio_close(pb);
        }
        FFI.avformat.avformat_free_context(outCtx);

        const pV = new BigUint64Array([inVideoCtx]);
        FFI.avformat.avformat_close_input(ptr(pV.buffer));
        const pA = new BigUint64Array([inAudioCtx]);
        FFI.avformat.avformat_close_input(ptr(pA.buffer));
    }
}
