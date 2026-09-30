import { FFI, Structs, freePtr, makeAVRational, AV_PIX_FMT_YUV420P, AV_PIX_FMT_RGBA } from "./index";
import { ptr, toArrayBuffer } from "bun:ffi";

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

    constructor(
        private width: number,
        private height: number,
        private fps: number,
        private outputPath: string,
        private crf: number = 20
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
            // NVENC failed at runtime (e.g. no GPU driver). Fallback to libx264
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

        // 6. Create Video Stream and copy codecpar
        this.stream = BigInt(FFI.avformat.avformat_new_stream(this.formatCtx, 0n));
        if (!this.stream) throw new Error("Failed to create video stream");

        const streamView = new DataView(toArrayBuffer(this.stream, 0, 64));
        const streamCodecpar = streamView.getBigUint64(16, true); // codecpar offset = 16
        FFI.avcodec.avcodec_parameters_from_context(streamCodecpar, this.codecCtx);

        // 7. Open AVIO output file
        const retIo = FFI.avformat.avio_open(this.formatCtx + 32n, Buffer.from(this.outputPath + "\0"), 2); // 2 = AVIO_FLAG_WRITE
        if (retIo < 0) throw new Error(`Failed to open output file: ${this.outputPath}`);

        // 8. Write Container Header
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

        this.isInitialized = true;
    }

    public encodeRgbaFrame(rgbaBuffer: Buffer | Uint8Array) {
        if (!this.isInitialized) this.initialize();

        // Zero-Copy pointer pass directly to libswscale
        const srcData = new BigUint64Array(8);
        srcData[0] = BigInt(ptr(rgbaBuffer));
        
        const srcStride = new Int32Array(8);
        srcStride[0] = this.width * 4;

        FFI.swscale.sws_scale(
            this.swsCtx,
            ptr(srcData.buffer),
            ptr(srcStride.buffer),
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
        while (FFI.avcodec.avcodec_receive_packet(this.codecCtx, this.packet) === 0) {
            Structs.AVPacket.setStreamIndex(this.packet, 0);
            FFI.avformat.av_interleaved_write_frame(this.formatCtx, this.packet);
        }
    }

    public close() {
        if (!this.isInitialized) return;

        // Flush remaining frames in encoder
        FFI.avcodec.avcodec_send_frame(this.codecCtx, 0n);
        while (FFI.avcodec.avcodec_receive_packet(this.codecCtx, this.packet) === 0) {
            Structs.AVPacket.setStreamIndex(this.packet, 0);
            FFI.avformat.av_interleaved_write_frame(this.formatCtx, this.packet);
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
