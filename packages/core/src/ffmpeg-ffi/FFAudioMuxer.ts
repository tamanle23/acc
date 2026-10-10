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
        if (inAudioStreamIdx >= 0) {
            outAudioStream = BigInt(FFI.avformat.avformat_new_stream(outCtx, 0n));
            const inStreamView = new DataView(safeArrayBuffer(inAudioStreamPtr, 0, 64));
            const outStreamView = new DataView(safeArrayBuffer(outAudioStream, 0, 64));

            const inCodecpar = inStreamView.getBigUint64(16, true);
            const outCodecpar = outStreamView.getBigUint64(16, true);
            FFI.avcodec.avcodec_parameters_copy(outCodecpar, inCodecpar);

            // Copy timebase
            outStreamView.setInt32(32, inStreamView.getInt32(32, true), true);
            outStreamView.setInt32(36, inStreamView.getInt32(36, true), true);

            const outCpView = new DataView(safeArrayBuffer(outCodecpar, 0, 64));
            outCpView.setUint32(8, 0, true); // Reset codec tag
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
