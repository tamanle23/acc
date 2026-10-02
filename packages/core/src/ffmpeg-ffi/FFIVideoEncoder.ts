import { FFI, Structs, freePtr, makeAVRational, AV_PIX_FMT_YUV420P, AV_PIX_FMT_RGBA } from "./index";
import { ptr, toArrayBuffer } from "bun:ffi";
import fs from "fs";
import type { IVideoEncodingStrategy, FileVideoEncodingOptions } from "./EncodingStrategies";
import {
    FileVideoEncodingStrategy,
    RtmpLiveStreamEncodingStrategy
} from "./EncodingStrategies";

export type { IVideoEncodingStrategy, FileVideoEncodingOptions };
export { FileVideoEncodingStrategy, RtmpLiveStreamEncodingStrategy };

function safeArrayBuffer(ptrVal: bigint | number, offset: number, length: number): ArrayBuffer {
  const numPtr = typeof ptrVal === 'bigint' ? Number(ptrVal) : ptrVal;
  return toArrayBuffer(numPtr, offset, length);
}

export class FFIVideoEncoder {
    private formatCtx: any = 0;
    private codecCtx: any = 0;
    private stream: any = 0;
    private frame: any = 0;
    private packet: any = 0;
    private swsCtx: any = 0;
    private frameIndex: number = 0;
    private isInitialized: boolean = false;
    private isHeaderWritten: boolean = false;

    private audioStream: any = 0;
    private aCodecCtx: any = 0;
    private customSwsCtx: any = 0;

    private srcDataC: any = 0;
    private srcStrideC: any = 0;
    private pinnedFrameBuf: Buffer | null = null;
    private strategy: IVideoEncodingStrategy;

    constructor(
        private width: number,
        private height: number,
        private fps: number,
        private outputPath: string,
        private crf: number = 20,
        private audioPath?: string,
        strategy?: IVideoEncodingStrategy,
        fileOptions?: FileVideoEncodingOptions
    ) {
        if (strategy) {
            this.strategy = strategy;
        } else {
            const isRtmp = outputPath.startsWith("rtmp://") || outputPath.startsWith("rtmps://");
            if (isRtmp) {
                this.strategy = new RtmpLiveStreamEncodingStrategy();
            } else {
                const ext = outputPath.split('.').pop()?.toLowerCase();
                const container = fileOptions?.container || (ext && ['mp4', 'mkv', 'mov', 'webm'].includes(ext) ? ext : 'mp4');
                this.strategy = new FileVideoEncodingStrategy({
                    container,
                    fastStart: fileOptions?.fastStart,
                    preset: fileOptions?.preset
                });
            }
        }
    }

    public getStrategy(): IVideoEncodingStrategy {
        return this.strategy;
    }

    public setStrategy(strategy: IVideoEncodingStrategy) {
        this.strategy = strategy;
    }

    public initialize() {
        if (this.isInitialized) return;

        // 1. Hardware Encoder Selection (NVENC GPU first, CPU libx264 fallback)
        let codec = FFI.avcodec.avcodec_find_encoder_by_name(ptr(Buffer.from("h264_nvenc\0")));
        let isNvenc = true;
        if (!codec) {
            codec = FFI.avcodec.avcodec_find_encoder_by_name(ptr(Buffer.from("libx264\0")));
            isNvenc = false;
        }
        if (!codec) {
            throw new Error("No compatible H.264 video encoder found in FFmpeg shared libraries.");
        }

        // 2. Allocate & configure AVCodecContext dimensions & pixel format
        this.codecCtx = FFI.avcodec.avcodec_alloc_context3(codec);
        FFI.avutil.av_opt_set(this.codecCtx, ptr(Buffer.from("video_size\0")), ptr(Buffer.from(`${this.width}x${this.height}\0`)), 0);
        FFI.avutil.av_opt_set(this.codecCtx, ptr(Buffer.from("pixel_format\0")), ptr(Buffer.from("yuv420p\0")), 0);
        FFI.avutil.av_opt_set_int(this.codecCtx, ptr(Buffer.from("pixel_format\0")), BigInt(AV_PIX_FMT_YUV420P), 0);

        // 3. TimeBase & Framerate configuration
        const timeBaseStr = ptr(Buffer.from(`1/${this.fps}\0`));
        const frameRateStr = ptr(Buffer.from(`${this.fps}/1\0`));
        FFI.avutil.av_opt_set(this.codecCtx, ptr(Buffer.from("time_base\0")), timeBaseStr, 0);
        FFI.avutil.av_opt_set(this.codecCtx, ptr(Buffer.from("framerate\0")), frameRateStr, 0);
        FFI.avutil.av_opt_set(this.codecCtx, ptr(Buffer.from("flags\0")), ptr(Buffer.from("+global_header\0")), 0);

        // Delegate codec settings (GOP, latency tune, presets, rate control) to Strategy
        this.strategy.configureCodec(this.codecCtx, isNvenc, this.fps, this.crf);

        // 4. Open video codec
        let openRet = FFI.avcodec.avcodec_open2(this.codecCtx, codec, 0n);
        if (openRet < 0 && isNvenc) {
            codec = FFI.avcodec.avcodec_find_encoder_by_name(ptr(Buffer.from("libx264\0")));
            if (codec) {
                const p = new BigUint64Array([BigInt(this.codecCtx)]);
                FFI.avcodec.avcodec_free_context(ptr(p.buffer));
                this.codecCtx = FFI.avcodec.avcodec_alloc_context3(codec);
                FFI.avutil.av_opt_set(this.codecCtx, ptr(Buffer.from("video_size\0")), ptr(Buffer.from(`${this.width}x${this.height}\0`)), 0);
                FFI.avutil.av_opt_set(this.codecCtx, ptr(Buffer.from("pixel_format\0")), ptr(Buffer.from("yuv420p\0")), 0);
                FFI.avutil.av_opt_set_int(this.codecCtx, ptr(Buffer.from("pixel_format\0")), BigInt(AV_PIX_FMT_YUV420P), 0);
                FFI.avutil.av_opt_set(this.codecCtx, ptr(Buffer.from("time_base\0")), timeBaseStr, 0);
                FFI.avutil.av_opt_set(this.codecCtx, ptr(Buffer.from("framerate\0")), frameRateStr, 0);
                FFI.avutil.av_opt_set(this.codecCtx, ptr(Buffer.from("flags\0")), ptr(Buffer.from("+global_header\0")), 0);
                this.strategy.configureCodec(this.codecCtx, false, this.fps, this.crf);
                openRet = FFI.avcodec.avcodec_open2(this.codecCtx, codec, 0n);
            }
        }
        if (openRet < 0) {
            throw new Error(`Failed to open video codec context (code ${openRet})`);
        }

        // 5. Delegate container format context allocation & configuration to Strategy
        this.formatCtx = this.strategy.allocateFormatContext(this.outputPath);
        this.strategy.configureFormatContext(this.formatCtx);

        // 6. Create Video Stream (stream #0) and copy codecpar
        this.stream = FFI.avformat.avformat_new_stream(this.formatCtx, 0n);
        if (!this.stream) throw new Error("Failed to create video stream");

        const streamView = new DataView(safeArrayBuffer(this.stream, 0, 64));
        const streamCodecpar = streamView.getBigUint64(16, true);
        FFI.avcodec.avcodec_parameters_from_context(streamCodecpar, this.codecCtx);

        // Reset codec_tag to 0 to let container assign native tag (essential for MKV, WebM, MP4)
        const cpView = new DataView(safeArrayBuffer(streamCodecpar, 0, 64));
        cpView.setUint32(8, 0, true);

        // Set stream time base to match packet ticks (1/90000)
        streamView.setInt32(32, 1, true);
        streamView.setInt32(36, 90000, true);

        // 7. Optional: Setup Audio Stream (stream #1) if audioPath exists
        if (this.audioPath && fs.existsSync(this.audioPath)) {
            const aacEncoder = FFI.avcodec.avcodec_find_encoder_by_name(ptr(Buffer.from("aac\0")));
            if (aacEncoder) {
                this.aCodecCtx = FFI.avcodec.avcodec_alloc_context3(aacEncoder);

                FFI.avutil.av_opt_set_int(this.aCodecCtx, ptr(Buffer.from("ar\0")), 48000n, 0);
                FFI.avutil.av_opt_set_int(this.aCodecCtx, ptr(Buffer.from("b\0")), 192000n, 0);
                FFI.avutil.av_opt_set(this.aCodecCtx, ptr(Buffer.from("time_base\0")), ptr(Buffer.from("1/48000\0")), 0);
                FFI.avutil.av_opt_set(this.aCodecCtx, ptr(Buffer.from("flags\0")), ptr(Buffer.from("+global_header\0")), 0);

                const aacLayout = new Uint8Array(24);
                FFI.avutil.av_channel_layout_default(ptr(aacLayout.buffer), 2); // 2 channels stereo
                FFI.avutil.av_opt_set_chlayout(this.aCodecCtx, ptr(Buffer.from("ch_layout\0")), ptr(aacLayout.buffer), 0);

                const aCtxData = new DataView(safeArrayBuffer(this.aCodecCtx, 0, 500));
                aCtxData.setInt32(348, 8, true); // sample_fmt = AV_SAMPLE_FMT_FLTP (8)

                const retAOpen = FFI.avcodec.avcodec_open2(this.aCodecCtx, aacEncoder, 0n);
                if (retAOpen >= 0) {
                    this.audioStream = FFI.avformat.avformat_new_stream(this.formatCtx, 0n);
                    const aStreamView = new DataView(safeArrayBuffer(this.audioStream, 0, 64));
                    aStreamView.setInt32(32, 1, true);
                    aStreamView.setInt32(36, 48000, true);

                    const aCp = aStreamView.getBigUint64(16, true);
                    FFI.avcodec.avcodec_parameters_from_context(aCp, this.aCodecCtx);
                    const outCpView = new DataView(safeArrayBuffer(aCp, 0, 64));
                    outCpView.setUint32(8, 0, true);
                } else {
                    const p = new BigUint64Array([BigInt(this.aCodecCtx)]);
                    FFI.avcodec.avcodec_free_context(ptr(p.buffer));
                    this.aCodecCtx = 0;
                }
            }
        }

        // 8. Open AVIO output file
        const retIo = FFI.avformat.avio_open(BigInt(this.formatCtx) + 32n, ptr(Buffer.from(this.outputPath + "\0")), 2);
        if (retIo < 0) throw new Error(`Failed to open output file: ${this.outputPath}`);

        // 9. Write Container Header
        const retHdr = FFI.avformat.avformat_write_header(this.formatCtx, 0n);
        if (retHdr < 0) throw new Error(`Failed to write stream header (code ${retHdr})`);
        this.isHeaderWritten = true;

        // 9. Allocate AVFrame for YUV420P output
        this.frame = FFI.avutil.av_frame_alloc();
        Structs.AVFrame.setFormat(this.frame, AV_PIX_FMT_YUV420P);
        Structs.AVFrame.setWidth(this.frame, this.width);
        Structs.AVFrame.setHeight(this.frame, this.height);
        FFI.avutil.av_frame_get_buffer(this.frame, 0);

        // 10. Allocate AVPacket
        this.packet = FFI.avcodec.av_packet_alloc?.() || FFI.avcodec.avpacket_alloc();

        // 11. SWS Context for Zero-Copy RGBA -> YUV420P conversion
        this.swsCtx = FFI.swscale.sws_getContext(
            this.width, this.height, AV_PIX_FMT_RGBA,
            this.width, this.height, AV_PIX_FMT_YUV420P,
            2, 0n, 0n, 0n // SWS_BILINEAR = 2
        );

        // 12. Pre-allocate native C memory for zero-allocation, nursery-immune sws_scale
        this.srcDataC = FFI.avutil.av_malloc(64n);
        this.srcStrideC = FFI.avutil.av_malloc(32n);

        const strideView = new DataView(safeArrayBuffer(this.srcStrideC, 0, 32));
        for (let i = 0; i < 8; i++) strideView.setInt32(i * 4, 0, true);
        strideView.setInt32(0, this.width * 4, true);

        const dataView = new DataView(safeArrayBuffer(this.srcDataC, 0, 64));
        for (let i = 0; i < 8; i++) dataView.setBigUint64(i * 8, 0n, true);

        this.isInitialized = true;
    }

    public encodeRgbaFrame(rgbaBuffer: Buffer | Uint8Array) {
        if (!this.isInitialized) this.initialize();

        this.strategy.paceFrame(this.frameIndex, this.fps);

        const frameBuf = Buffer.from(rgbaBuffer);
        const srcDataArray = new BigUint64Array([BigInt(ptr(frameBuf))]);
        const srcStrideArray = new Int32Array([this.width * 4, 0, 0, 0, 0, 0, 0, 0]);

        FFI.swscale.sws_scale(
            this.swsCtx,
            ptr(srcDataArray.buffer),
            ptr(srcStrideArray.buffer),
            0,
            this.height,
            BigInt(this.frame),
            BigInt(this.frame) + 64n
        );

        // Set PTS
        Structs.AVFrame.setPts(this.frame, BigInt(this.frameIndex++));

        // Send frame to encoder
        FFI.avcodec.avcodec_send_frame(this.codecCtx, this.frame);

        // Drain encoded packets
        const ticksPerFrame = BigInt(Math.round(90000 / this.fps));
        while (FFI.avcodec.avcodec_receive_packet(this.codecCtx, this.packet) === 0) {
            Structs.AVPacket.setStreamIndex(this.packet, 0);
            const pktView = new DataView(safeArrayBuffer(this.packet, 0, 128));
            const streamPts = BigInt(Math.max(0, this.frameIndex - 1)) * ticksPerFrame;
            pktView.setBigInt64(8, streamPts, true);   // pts
            pktView.setBigInt64(16, streamPts, true);  // dts
            pktView.setBigInt64(64, ticksPerFrame, true); // duration
            FFI.avformat.av_interleaved_write_frame(this.formatCtx, this.packet);
        }
    }

    public encodeRawFrame(srcFrame: bigint, srcW: number, srcH: number, srcFmt: number) {
        if (!this.isInitialized) this.initialize();

        this.strategy.paceFrame(this.frameIndex, this.fps);

        if (!this.customSwsCtx) {
            this.customSwsCtx = BigInt(FFI.swscale.sws_getContext(
                srcW, srcH, srcFmt,
                this.width, this.height, AV_PIX_FMT_YUV420P,
                2, 0n, 0n, 0n
            ));
        }

        FFI.swscale.sws_scale(
            this.customSwsCtx,
            srcFrame,
            srcFrame + 64n,
            0,
            srcH,
            this.frame,
            this.frame + 64n
        );

        Structs.AVFrame.setPts(this.frame, BigInt(this.frameIndex++));
        FFI.avcodec.avcodec_send_frame(this.codecCtx, this.frame);

        const ticksPerFrame = BigInt(Math.round(90000 / this.fps));
        while (FFI.avcodec.avcodec_receive_packet(this.codecCtx, this.packet) === 0) {
            Structs.AVPacket.setStreamIndex(this.packet, 0);
            const pktView = new DataView(safeArrayBuffer(this.packet, 0, 128));
            const streamPts = BigInt(Math.max(0, this.frameIndex - 1)) * ticksPerFrame;
            pktView.setBigInt64(8, streamPts, true);
            pktView.setBigInt64(16, streamPts, true);
            pktView.setBigInt64(64, ticksPerFrame, true);
            FFI.avformat.av_interleaved_write_frame(this.formatCtx, this.packet);
        }
    }

    private encodeAudio(audioPath: string) {
        if (!this.aCodecCtx || !this.audioStream) return;

        // Max audio duration clamped to video length to prevent stream length mismatch
        const maxAudioSamples = BigInt(Math.ceil((this.frameIndex / this.fps) * 48000));

        const inFmtPtr = new BigUint64Array(1);
        const retAIn = FFI.avformat.avformat_open_input(ptr(inFmtPtr.buffer), ptr(Buffer.from(audioPath + "\0")), 0n, 0n);
        if (retAIn !== 0) {
            this.generateSilenceAudio(maxAudioSamples);
            return;
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
            this.generateSilenceAudio(maxAudioSamples);
            return;
        }

        const inCpView = new DataView(safeArrayBuffer(inAudioCodecpar, 0, 160));
        const inCodecId = inCpView.getInt32(4, true);
        const inChannels = inCpView.getInt32(104, true) || 2;
        const inSampleRate = inCpView.getInt32(152, true) || 44100;
        const inSampleFmt = inCpView.getInt32(132, true) >= 0 ? inCpView.getInt32(132, true) : 1;

        const inDecoder = FFI.avcodec.avcodec_find_decoder(inCodecId);
        if (!inDecoder) {
            const pInA = new BigUint64Array([inAudioCtx]);
            FFI.avformat.avformat_close_input(ptr(pInA.buffer));
            this.generateSilenceAudio(maxAudioSamples);
            return;
        }

        const inDecCtx = BigInt(FFI.avcodec.avcodec_alloc_context3(inDecoder));
        FFI.avcodec.avcodec_parameters_to_context(inDecCtx, inAudioCodecpar);
        if (FFI.avcodec.avcodec_open2(inDecCtx, inDecoder, 0n) < 0) {
            const pDec = new BigUint64Array([inDecCtx]);
            FFI.avcodec.avcodec_free_context(ptr(pDec.buffer));
            const pInA = new BigUint64Array([inAudioCtx]);
            FFI.avformat.avformat_close_input(ptr(pInA.buffer));
            this.generateSilenceAudio(maxAudioSamples);
            return;
        }

        // Setup Stereo Output Layout for AAC
        const outLayout = new Uint8Array(24);
        FFI.avutil.av_channel_layout_default(ptr(outLayout.buffer), 2);
        let swrCtx: bigint = 0n;

        // Allocate AAC Encoding Frame (1024 samples, Planar Float FLTP)
        const aFrame = BigInt(FFI.avutil.av_frame_alloc());
        const aFrameView = new DataView(safeArrayBuffer(aFrame, 0, 512));
        aFrameView.setInt32(112, 1024, true); // nb_samples = 1024
        aFrameView.setInt32(116, 8, true);    // format = AV_SAMPLE_FMT_FLTP (8)
        aFrameView.setInt32(180, 48000, true);// sample_rate = 48000
        FFI.avutil.av_channel_layout_default(aFrame + 384n, 2);
        FFI.avutil.av_frame_get_buffer(aFrame, 0);

        const inFrame = BigInt(FFI.avutil.av_frame_alloc());
        const aPkt = BigInt(FFI.avcodec.av_packet_alloc?.() || FFI.avcodec.avpacket_alloc());
        const readPkt = BigInt(FFI.avcodec.av_packet_alloc?.() || FFI.avcodec.avpacket_alloc());

        let fifoL: number[] = [];
        let fifoR: number[] = [];
        let totalAudioSamplesSent = 0n;
        let audioFrameCount = 0n;

        const pushSamplesToEncoder = (flushAll = false) => {
            while (fifoL.length >= 1024 || (flushAll && fifoL.length > 0)) {
                if (totalAudioSamplesSent >= maxAudioSamples) {
                    fifoL = [];
                    fifoR = [];
                    break;
                }

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
                totalAudioSamplesSent += 1024n;

                FFI.avcodec.avcodec_send_frame(this.aCodecCtx, aFrame);
                while (FFI.avcodec.avcodec_receive_packet(this.aCodecCtx, aPkt) === 0) {
                    Structs.AVPacket.setStreamIndex(aPkt, 1);
                    FFI.avformat.av_interleaved_write_frame(this.formatCtx, aPkt);
                    FFI.avcodec.av_packet_unref(aPkt);
                }
            }
        };

        // Read, decode, resample
        while (FFI.avformat.av_read_frame(inAudioCtx, readPkt) >= 0) {
            const pView = new DataView(safeArrayBuffer(readPkt, 0, 64));
            if (pView.getInt32(36, true) === inAudioStreamIdx) {
                if (FFI.avcodec.avcodec_send_packet(inDecCtx, readPkt) === 0) {
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
                                3, // AV_SAMPLE_FMT_FLT (Interleaved Float Stereo)
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
            FFI.avcodec.av_packet_unref(readPkt);
        }

        // Flush remaining samples in SWR and FIFO
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

        // Pad with silence to match exact video frame count duration
        while (totalAudioSamplesSent < maxAudioSamples) {
            const needed = Number(maxAudioSamples - totalAudioSamplesSent);
            const chunk = Math.min(1024, needed);
            for (let i = 0; i < chunk; i++) {
                fifoL.push(0);
                fifoR.push(0);
            }
            pushSamplesToEncoder(true);
        }

        // Flush AAC encoder
        FFI.avcodec.avcodec_send_frame(this.aCodecCtx, 0n);
        while (FFI.avcodec.avcodec_receive_packet(this.aCodecCtx, aPkt) === 0) {
            Structs.AVPacket.setStreamIndex(aPkt, 1);
            FFI.avformat.av_interleaved_write_frame(this.formatCtx, aPkt);
            FFI.avcodec.av_packet_unref(aPkt);
        }

        // Free audio resources
        const pDec = new BigUint64Array([inDecCtx]);
        FFI.avcodec.avcodec_free_context(ptr(pDec.buffer));
        const pInA = new BigUint64Array([inAudioCtx]);
        FFI.avformat.avformat_close_input(ptr(pInA.buffer));
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
        const pRP = new BigUint64Array([readPkt]);
        FFI.avcodec.av_packet_free(ptr(pRP.buffer));
    }

    private generateSilenceAudio(maxAudioSamples: bigint) {
        if (!this.aCodecCtx) return;

        const aFrame = BigInt(FFI.avutil.av_frame_alloc());
        const aFrameView = new DataView(safeArrayBuffer(aFrame, 0, 512));
        aFrameView.setInt32(112, 1024, true);
        aFrameView.setInt32(116, 8, true); // AV_SAMPLE_FMT_FLTP
        aFrameView.setInt32(180, 48000, true);
        FFI.avutil.av_channel_layout_default(aFrame + 384n, 2);
        FFI.avutil.av_frame_get_buffer(aFrame, 0);

        const dataPtrL = aFrameView.getBigUint64(0, true);
        const dataPtrR = aFrameView.getBigUint64(8, true);
        new Float32Array(safeArrayBuffer(dataPtrL, 0, 1024 * 4)).fill(0);
        new Float32Array(safeArrayBuffer(dataPtrR, 0, 1024 * 4)).fill(0);

        const aPkt = BigInt(FFI.avcodec.av_packet_alloc?.() || FFI.avcodec.avpacket_alloc());
        let totalSent = 0n;
        let frameCount = 0n;

        while (totalSent < maxAudioSamples) {
            aFrameView.setBigInt64(136, frameCount * 1024n, true);
            frameCount++;
            totalSent += 1024n;

            FFI.avcodec.avcodec_send_frame(this.aCodecCtx, aFrame);
            while (FFI.avcodec.avcodec_receive_packet(this.aCodecCtx, aPkt) === 0) {
                Structs.AVPacket.setStreamIndex(aPkt, 1);
                FFI.avformat.av_interleaved_write_frame(this.formatCtx, aPkt);
                FFI.avcodec.av_packet_unref(aPkt);
            }
        }

        FFI.avcodec.avcodec_send_frame(this.aCodecCtx, 0n);
        while (FFI.avcodec.avcodec_receive_packet(this.aCodecCtx, aPkt) === 0) {
            Structs.AVPacket.setStreamIndex(aPkt, 1);
            FFI.avformat.av_interleaved_write_frame(this.formatCtx, aPkt);
            FFI.avcodec.av_packet_unref(aPkt);
        }

        const pAF = new BigUint64Array([aFrame]);
        FFI.avutil.av_frame_free(ptr(pAF.buffer));
        const pAP = new BigUint64Array([aPkt]);
        FFI.avcodec.av_packet_free(ptr(pAP.buffer));
    }

    public close() {
        if (!this.isInitialized) return;

        // Flush remaining frames in encoder
        const ticksPerFrame = BigInt(Math.round(90000 / this.fps));
        FFI.avcodec.avcodec_send_frame(this.codecCtx, 0n);
        while (FFI.avcodec.avcodec_receive_packet(this.codecCtx, this.packet) === 0) {
            Structs.AVPacket.setStreamIndex(this.packet, 0);
            const pktView = new DataView(safeArrayBuffer(this.packet, 0, 128));
            const streamPts = BigInt(this.frameIndex++) * ticksPerFrame;
            pktView.setBigInt64(8, streamPts, true);   // pts
            pktView.setBigInt64(16, streamPts, true);  // dts
            pktView.setBigInt64(64, ticksPerFrame, true); // duration
            FFI.avformat.av_interleaved_write_frame(this.formatCtx, this.packet);
        }

        // Encode and mux audio directly in-memory if audioPath is active
        if (this.audioPath && this.aCodecCtx && fs.existsSync(this.audioPath)) {
            this.encodeAudio(this.audioPath);
        }

        // Write container trailer
        if (this.isHeaderWritten) {
            FFI.avformat.av_write_trailer(this.formatCtx);
        }

        // Free resources in correct FFmpeg lifecycle order (Format Context first, then Codec Contexts)
        if (this.formatCtx) {
            FFI.avformat.avformat_free_context(this.formatCtx);
            this.formatCtx = 0n;
        }
        if (this.codecCtx) {
            const p = new BigUint64Array([this.codecCtx]);
            FFI.avcodec.avcodec_free_context(ptr(p.buffer));
            this.codecCtx = 0n;
        }
        if (this.aCodecCtx) {
            const p = new BigUint64Array([this.aCodecCtx]);
            FFI.avcodec.avcodec_free_context(ptr(p.buffer));
            this.aCodecCtx = 0n;
        }
        if (this.frame) {
            const p = new BigUint64Array([this.frame]);
            FFI.avutil.av_frame_free(ptr(p.buffer));
            this.frame = 0n;
        }
        if (this.packet) {
            const p = new BigUint64Array([this.packet]);
            FFI.avcodec.av_packet_free(ptr(p.buffer));
            this.packet = 0n;
        }
        if (this.swsCtx) {
            FFI.swscale.sws_freeContext(this.swsCtx);
            this.swsCtx = 0n;
        }
        if (this.customSwsCtx) {
            FFI.swscale.sws_freeContext(this.customSwsCtx);
            this.customSwsCtx = 0n;
        }
        if (this.srcDataC) {
            FFI.avutil.av_free(this.srcDataC);
            this.srcDataC = 0n;
        }
        if (this.srcStrideC) {
            FFI.avutil.av_free(this.srcStrideC);
            this.srcStrideC = 0n;
        }

        this.isInitialized = false;
    }
}
