import { FFI, Structs, freePtr, makeAVRational, AV_PIX_FMT_YUV420P, AV_PIX_FMT_RGBA } from "./index";
import { ptr, toArrayBuffer } from "bun:ffi";
import fs from "fs";

export class FFIVideoEncoder {
    private formatCtx: bigint = 0n;
    private codecCtx: bigint = 0n;
    private stream: bigint = 0n;
    private frame: bigint = 0n;
    private packet: bigint = 0n;
    private swsCtx: bigint = 0n;
    private frameIndex: number = 0;
    private isInitialized: boolean = false;
    private isHeaderWritten: boolean = false;

    private audioStream: bigint = 0n;
    private audioInCtx: bigint = 0n;
    private inAudioTimeBase: bigint = 0n;
    private customSwsCtx: bigint = 0n;

    private srcData: BigUint64Array = new BigUint64Array(8);
    private srcStride: Int32Array = new Int32Array(8);
    private srcDataPtr: any;
    private srcStridePtr: any;

    constructor(
        private width: number,
        private height: number,
        private fps: number,
        private outputPath: string,
        private crf: number = 20,
        private audioPath?: string
    ) {}

    public initialize() {
        if (this.isInitialized) return;

        // 1. Hardware Encoder Selection (NVENC GPU first, CPU libx264 fallback)
        let codec = FFI.avcodec.avcodec_find_encoder_by_name(Buffer.from("h264_nvenc\0"));
        let isNvenc = true;
        if (!codec) {
            codec = FFI.avcodec.avcodec_find_encoder_by_name(Buffer.from("libx264\0"));
            isNvenc = false;
        }
        if (!codec) {
            throw new Error("No compatible H.264 video encoder found in FFmpeg shared libraries.");
        }

        // 2. Allocate & configure AVCodecParameters to bridge context dimensions
        const par = BigInt(FFI.avcodec.avcodec_parameters_alloc());
        const parView = new DataView(toArrayBuffer(par, 0, 160));
        parView.setInt32(0, 0, true);               // codec_type = AVMEDIA_TYPE_VIDEO
        parView.setInt32(44, AV_PIX_FMT_YUV420P, true); // format = AV_PIX_FMT_YUV420P
        parView.setInt32(72, this.width, true);     // width
        parView.setInt32(76, this.height, true);    // height

        this.codecCtx = BigInt(FFI.avcodec.avcodec_alloc_context3(codec));
        FFI.avcodec.avcodec_parameters_to_context(this.codecCtx, par);
        FFI.avcodec.avcodec_parameters_free(ptr(new BigUint64Array([par]).buffer));

        // 3. TimeBase & Framerate configuration
        const timeBaseStr = Buffer.from(`1/${this.fps}\0`);
        const frameRateStr = Buffer.from(`${this.fps}/1\0`);
        FFI.avutil.av_opt_set(this.codecCtx, Buffer.from("time_base\0"), timeBaseStr, 0);
        FFI.avutil.av_opt_set(this.codecCtx, Buffer.from("framerate\0"), frameRateStr, 0);

        if (isNvenc) {
            FFI.avutil.av_opt_set(this.codecCtx, Buffer.from("preset\0"), Buffer.from("p4\0"), 0);
            FFI.avutil.av_opt_set(this.codecCtx, Buffer.from("cq\0"), Buffer.from(`${this.crf}\0`), 0);
        } else {
            FFI.avutil.av_opt_set(this.codecCtx, Buffer.from("preset\0"), Buffer.from("fast\0"), 0);
            FFI.avutil.av_opt_set(this.codecCtx, Buffer.from("crf\0"), Buffer.from(`${this.crf}\0`), 0);
        }

        // 4. Open video codec
        let openRet = FFI.avcodec.avcodec_open2(this.codecCtx, codec, 0n);
        if (openRet < 0 && isNvenc) {
            codec = FFI.avcodec.avcodec_find_encoder_by_name(Buffer.from("libx264\0"));
            if (codec) {
                FFI.avutil.av_opt_set(this.codecCtx, Buffer.from("preset\0"), Buffer.from("fast\0"), 0);
                FFI.avutil.av_opt_set(this.codecCtx, Buffer.from("crf\0"), Buffer.from(`${this.crf}\0`), 0);
                openRet = FFI.avcodec.avcodec_open2(this.codecCtx, codec, 0n);
            }
        }
        if (openRet < 0) {
            throw new Error(`Failed to open video codec context (code ${openRet})`);
        }

        // 5. Allocate output format context
        const fmtCtxPtr = new BigUint64Array(1);
        const retOut = FFI.avformat.avformat_alloc_output_context2(ptr(fmtCtxPtr.buffer), 0n, 0n, Buffer.from(this.outputPath + "\0"));
        if (retOut < 0) throw new Error("Failed to allocate output context");
        this.formatCtx = fmtCtxPtr[0];

        // 6. Create Video Stream (stream #0) and copy codecpar
        this.stream = BigInt(FFI.avformat.avformat_new_stream(this.formatCtx, 0n));
        if (!this.stream) throw new Error("Failed to create video stream");

        const streamView = new DataView(toArrayBuffer(this.stream, 0, 64));
        const streamCodecpar = streamView.getBigUint64(16, true);
        FFI.avcodec.avcodec_parameters_from_context(streamCodecpar, this.codecCtx);

        // 7. Optional: Setup Audio Stream (stream #1) if audioPath exists
        if (this.audioPath && fs.existsSync(this.audioPath)) {
            const aInPtr = new BigUint64Array(1);
            const aRet = FFI.avformat.avformat_open_input(ptr(aInPtr.buffer), Buffer.from(this.audioPath + "\0"), 0n, 0n);
            if (aRet === 0) {
                this.audioInCtx = aInPtr[0];
                FFI.avformat.avformat_find_stream_info(this.audioInCtx, 0n);

                const inView = new DataView(toArrayBuffer(this.audioInCtx, 0, 64));
                const inStreamsArray = new DataView(toArrayBuffer(inView.getBigUint64(48, true), 0, 64));
                const inAudioStream = inStreamsArray.getBigUint64(0, true);
                const inAudioCodecpar = new DataView(toArrayBuffer(inAudioStream, 0, 64)).getBigUint64(16, true);

                const inStreamView = new DataView(toArrayBuffer(inAudioStream, 0, 64));
                this.inAudioTimeBase = makeAVRational(inStreamView.getInt32(32, true), inStreamView.getInt32(36, true));

                this.audioStream = BigInt(FFI.avformat.avformat_new_stream(this.formatCtx, 0n));
                const outAudioCodecpar = new DataView(toArrayBuffer(this.audioStream, 0, 64)).getBigUint64(16, true);
                FFI.avcodec.avcodec_parameters_copy(outAudioCodecpar, inAudioCodecpar);
                // Reset codec_tag to 0 to prevent container tag mismatch (e.g. WAV PCM in MP4)
                const outCpView = new DataView(toArrayBuffer(outAudioCodecpar, 0, 64));
                outCpView.setUint32(8, 0, true);
            }
        }

        // 8. Open AVIO output file
        const retIo = FFI.avformat.avio_open(this.formatCtx + 32n, Buffer.from(this.outputPath + "\0"), 2);
        if (retIo < 0) throw new Error(`Failed to open output file: ${this.outputPath}`);

        // 9. Write Container Header
        const retHdr = FFI.avformat.avformat_write_header(this.formatCtx, 0n);
        if (retHdr < 0) throw new Error(`Failed to write stream header (code ${retHdr})`);
        this.isHeaderWritten = true;

        // 9. Allocate AVFrame for YUV420P output
        this.frame = BigInt(FFI.avutil.av_frame_alloc());
        Structs.AVFrame.setFormat(this.frame, AV_PIX_FMT_YUV420P);
        Structs.AVFrame.setWidth(this.frame, this.width);
        Structs.AVFrame.setHeight(this.frame, this.height);
        FFI.avutil.av_frame_get_buffer(this.frame, 0);

        // 10. Allocate AVPacket
        this.packet = BigInt(FFI.avcodec.av_packet_alloc?.() || FFI.avcodec.avpacket_alloc());

        // 11. SWS Context for Zero-Copy RGBA -> YUV420P conversion
        this.swsCtx = BigInt(FFI.swscale.sws_getContext(
            this.width, this.height, AV_PIX_FMT_RGBA,
            this.width, this.height, AV_PIX_FMT_YUV420P,
            2, 0n, 0n, 0n // SWS_BILINEAR = 2
        ));

        // 12. Pre-allocate buffer pointers for zero-allocation hot loop
        this.srcStride[0] = this.width * 4;
        this.srcDataPtr = ptr(this.srcData.buffer);
        this.srcStridePtr = ptr(this.srcStride.buffer);

        this.isInitialized = true;
    }

    public encodeRgbaFrame(rgbaBuffer: Buffer | Uint8Array) {
        if (!this.isInitialized) this.initialize();

        // Zero-Copy pointer pass directly to libswscale without JS heap allocation
        this.srcData[0] = BigInt(ptr(rgbaBuffer));

        FFI.swscale.sws_scale(
            this.swsCtx,
            this.srcDataPtr,
            this.srcStridePtr,
            0,
            this.height,
            this.frame,
            this.frame + 64n
        );

        // Set PTS
        Structs.AVFrame.setPts(this.frame, BigInt(this.frameIndex++));

        // Send frame to encoder
        FFI.avcodec.avcodec_send_frame(this.codecCtx, this.frame);

        // Drain encoded packets
        const ticksPerFrame = BigInt(Math.round(90000 / this.fps));
        while (FFI.avcodec.avcodec_receive_packet(this.codecCtx, this.packet) === 0) {
            Structs.AVPacket.setStreamIndex(this.packet, 0);
            const pktView = new DataView(toArrayBuffer(this.packet, 0, 128));
            const streamPts = BigInt(Math.max(0, this.frameIndex - 1)) * ticksPerFrame;
            pktView.setBigInt64(8, streamPts, true);   // pts
            pktView.setBigInt64(16, streamPts, true);  // dts
            pktView.setBigInt64(64, ticksPerFrame, true); // duration
            FFI.avformat.av_interleaved_write_frame(this.formatCtx, this.packet);
        }
    }

    public encodeRawFrame(srcFrame: bigint, srcW: number, srcH: number, srcFmt: number) {
        if (!this.isInitialized) this.initialize();

        if (!this.customSwsCtx) {
            this.customSwsCtx = BigInt(FFI.swscale.sws_getContext(
                srcW, srcH, srcFmt,
                this.width, this.height, AV_PIX_FMT_YUV420P,
                2, 0n, 0n, 0n
            ));
        }

        const srcData = ptr(new Uint8Array(toArrayBuffer(srcFrame, 0, 64)));
        const srcLinesize = ptr(new Uint8Array(toArrayBuffer(srcFrame, 64, 32)));
        const dstData = ptr(new Uint8Array(toArrayBuffer(this.frame, 0, 64)));
        const dstLinesize = ptr(new Uint8Array(toArrayBuffer(this.frame, 64, 32)));

        FFI.swscale.sws_scale(
            this.customSwsCtx,
            srcData,
            srcLinesize,
            0,
            srcH,
            dstData,
            dstLinesize
        );

        Structs.AVFrame.setPts(this.frame, BigInt(this.frameIndex++));
        FFI.avcodec.avcodec_send_frame(this.codecCtx, this.frame);

        const ticksPerFrame = BigInt(Math.round(90000 / this.fps));
        while (FFI.avcodec.avcodec_receive_packet(this.codecCtx, this.packet) === 0) {
            Structs.AVPacket.setStreamIndex(this.packet, 0);
            const pktView = new DataView(toArrayBuffer(this.packet, 0, 128));
            const streamPts = BigInt(Math.max(0, this.frameIndex - 1)) * ticksPerFrame;
            pktView.setBigInt64(8, streamPts, true);
            pktView.setBigInt64(16, streamPts, true);
            pktView.setBigInt64(64, ticksPerFrame, true);
            FFI.avformat.av_interleaved_write_frame(this.formatCtx, this.packet);
        }
    }

    public close() {
        if (!this.isInitialized) return;

        // Flush remaining frames in encoder
        const ticksPerFrame = BigInt(Math.round(90000 / this.fps));
        FFI.avcodec.avcodec_send_frame(this.codecCtx, 0n);
        while (FFI.avcodec.avcodec_receive_packet(this.codecCtx, this.packet) === 0) {
            Structs.AVPacket.setStreamIndex(this.packet, 0);
            const pktView = new DataView(toArrayBuffer(this.packet, 0, 128));
            const streamPts = BigInt(this.frameIndex++) * ticksPerFrame;
            pktView.setBigInt64(8, streamPts, true);   // pts
            pktView.setBigInt64(16, streamPts, true);  // dts
            pktView.setBigInt64(64, ticksPerFrame, true); // duration
            FFI.avformat.av_interleaved_write_frame(this.formatCtx, this.packet);
        }

        // Remux audio packets if audio stream is active
        if (this.audioInCtx) {
            const outStreamView = new DataView(toArrayBuffer(this.audioStream, 0, 64));
            const outAudioTimeBase = makeAVRational(outStreamView.getInt32(32, true), outStreamView.getInt32(36, true));
            const maxDurationUs = BigInt(Math.round((this.frameIndex / this.fps) * 1000000));
            const maxPts = FFI.avutil.av_rescale_q(maxDurationUs, makeAVRational(1, 1000000), outAudioTimeBase);

            while (FFI.avformat.av_read_frame(this.audioInCtx, this.packet) >= 0) {
                const pktView = new DataView(toArrayBuffer(this.packet, 0, 128));
                pktView.setInt32(36, 1, true); // stream_index = 1

                const inPts = pktView.getBigInt64(8, true);
                const inDts = pktView.getBigInt64(16, true);
                const inDur = pktView.getBigInt64(64, true);

                let scaledPts = inPts;
                if (inPts !== -0x8000000000000000n && this.inAudioTimeBase) {
                    scaledPts = FFI.avutil.av_rescale_q(inPts, this.inAudioTimeBase, outAudioTimeBase);
                    pktView.setBigInt64(8, scaledPts, true);
                }
                if (inDts !== -0x8000000000000000n && this.inAudioTimeBase) {
                    pktView.setBigInt64(16, FFI.avutil.av_rescale_q(inDts, this.inAudioTimeBase, outAudioTimeBase), true);
                }
                if (inDur > 0n && this.inAudioTimeBase) {
                    pktView.setBigInt64(64, FFI.avutil.av_rescale_q(inDur, this.inAudioTimeBase, outAudioTimeBase), true);
                }

                if (scaledPts > maxPts) {
                    FFI.avcodec.av_packet_unref(this.packet);
                    break;
                }

                FFI.avformat.av_interleaved_write_frame(this.formatCtx, this.packet);
                FFI.avcodec.av_packet_unref(this.packet);
            }
            const pIn = new BigUint64Array([this.audioInCtx]);
            FFI.avformat.avformat_close_input(ptr(pIn.buffer));
            this.audioInCtx = 0n;
        }

        // Write container trailer
        if (this.isHeaderWritten) {
            FFI.avformat.av_write_trailer(this.formatCtx);
        }

        // Close AVIO
        const fmtView = new DataView(toArrayBuffer(this.formatCtx, 0, 64));
        const pb = fmtView.getBigUint64(32, true);
        if (pb > 0n) {
            FFI.avformat.avio_closep(this.formatCtx + 32n);
        }

        // Free resources
        if (this.codecCtx) {
            const p = new BigUint64Array([this.codecCtx]);
            FFI.avcodec.avcodec_free_context(ptr(p.buffer));
            this.codecCtx = 0n;
        }
        if (this.formatCtx) {
            FFI.avformat.avformat_free_context(this.formatCtx);
            this.formatCtx = 0n;
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

        this.isInitialized = false;
    }
}
