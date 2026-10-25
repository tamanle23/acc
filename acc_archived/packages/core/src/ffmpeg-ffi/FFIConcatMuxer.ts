import { FFI, safeArrayBuffer } from "./index";
import { ptr } from "bun:ffi";
import fs from "fs";

export class FFIConcatMuxer {
  /**
   * Concatenates multiple video files at the packet level without re-encoding (Lossless Stream Copy via pure bun:ffi).
   * Operates completely in-memory without spawning child processes.
   */
  public static concatenate(inputPaths: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!inputPaths || inputPaths.length === 0) return resolve();
        if (inputPaths.length === 1) {
          fs.copyFileSync(inputPaths[0], outputPath);
          return resolve();
        }

        // 1. Open the first segment to inspect stream layout
        const inCtxPtr = new BigUint64Array(1);
        let ret = FFI.avformat.avformat_open_input(
          ptr(inCtxPtr.buffer),
          ptr(Buffer.from(inputPaths[0] + "\0")),
          0n,
          0n
        );
        if (ret < 0) throw new Error(`FFIConcatMuxer: Failed to open input file ${inputPaths[0]}`);
        const firstInCtx = inCtxPtr[0];
        FFI.avformat.avformat_find_stream_info(firstInCtx, 0n);

        const inView = new DataView(safeArrayBuffer(firstInCtx, 0, 64));
        const nbStreams = inView.getUint32(44, true);
        const inStreamsArrayPtr = inView.getBigUint64(48, true);
        const inStreamsArray = new DataView(safeArrayBuffer(inStreamsArrayPtr, 0, nbStreams * 8));

        // 2. Allocate output container context
        const outCtxPtr = new BigUint64Array(1);
        ret = FFI.avformat.avformat_alloc_output_context2(
          ptr(outCtxPtr.buffer),
          0n,
          0n,
          ptr(Buffer.from(outputPath + "\0"))
        );
        if (ret < 0) throw new Error(`FFIConcatMuxer: Failed to create output context for ${outputPath}`);
        const outCtx = outCtxPtr[0];

        // Record output stream codec types for stream matching
        const outStreamCodecTypes: number[] = [];
        // 3. Clone streams and codec parameters into output context
        for (let i = 0; i < nbStreams; i++) {
          const inStream = inStreamsArray.getBigUint64(i * 8, true);
          const outStream = BigInt(FFI.avformat.avformat_new_stream(outCtx, 0n));

          const inStreamView = new DataView(safeArrayBuffer(inStream, 0, 64));
          const outStreamView = new DataView(safeArrayBuffer(outStream, 0, 64));

          const inStreamCodecpar = inStreamView.getBigUint64(16, true);
          const outStreamCodecpar = outStreamView.getBigUint64(16, true);

          FFI.avcodec.avcodec_parameters_copy(outStreamCodecpar, inStreamCodecpar);

          // Track codec_type (0 = video, 1 = audio, etc.)
          const inCpView = new DataView(safeArrayBuffer(inStreamCodecpar, 0, 64));
          outStreamCodecTypes.push(inCpView.getInt32(0, true));

          // Copy timebase
          outStreamView.setInt32(32, inStreamView.getInt32(32, true), true);
          outStreamView.setInt32(36, inStreamView.getInt32(36, true), true);

          // Reset codec_tag to 0 to let muxer choose native tag
          const outCpView = new DataView(safeArrayBuffer(outStreamCodecpar, 0, 64));
          outCpView.setUint32(8, 0, true);
        }

        // Close inspection context
        const pCloseFirst = new BigUint64Array([firstInCtx]);
        FFI.avformat.avformat_close_input(ptr(pCloseFirst.buffer));

        // 4. Open Output AVIO
        ret = FFI.avformat.avio_open(outCtx + 32n, ptr(Buffer.from(outputPath + "\0")), 2);
        if (ret < 0) throw new Error(`FFIConcatMuxer: Failed to open output AVIO: ${outputPath}`);

        // 5. Write Container Header
        ret = FFI.avformat.avformat_write_header(outCtx, 0n);
        if (ret < 0) throw new Error(`FFIConcatMuxer: Failed to write output header: ${outputPath}`);

        const pkt = BigInt(FFI.avcodec.av_packet_alloc?.() || FFI.avcodec.avpacket_alloc());
        const streamPtsOffsets = new Array(nbStreams).fill(0n);
        const lastDts = new Array(nbStreams).fill(-1n);

        for (let segIdx = 0; segIdx < inputPaths.length; segIdx++) {
          const segPath = inputPaths[segIdx];
          const segInPtr = new BigUint64Array(1);
          ret = FFI.avformat.avformat_open_input(
            ptr(segInPtr.buffer),
            ptr(Buffer.from(segPath + "\0")),
            0n,
            0n
          );
          if (ret < 0) continue;
          const segInCtx = segInPtr[0];
          FFI.avformat.avformat_find_stream_info(segInCtx, 0n);

          const segView = new DataView(safeArrayBuffer(segInCtx, 0, 64));
          const segNbStreams = segView.getUint32(44, true);
          const segStreamsPtr = segView.getBigUint64(48, true);
          const segStreamsArray = new DataView(safeArrayBuffer(segStreamsPtr, 0, segNbStreams * 8));

          // Map segment stream index -> output stream index by matching codec_type
          const segStreamMap = new Int32Array(segNbStreams).fill(-1);
          for (let s = 0; s < segNbStreams; s++) {
            const sPtr = segStreamsArray.getBigUint64(s * 8, true);
            const sCp = new DataView(safeArrayBuffer(sPtr, 0, 64)).getBigUint64(16, true);
            const sCodecType = new DataView(safeArrayBuffer(sCp, 0, 64)).getInt32(0, true);
            for (let o = 0; o < nbStreams; o++) {
              if (outStreamCodecTypes[o] === sCodecType) {
                segStreamMap[s] = o;
                break;
              }
            }
          }

          const firstPtsInSeg: Array<bigint | null> = new Array(nbStreams).fill(null);
          const maxPtsInSeg = new Array(nbStreams).fill(0n);

          while (FFI.avformat.av_read_frame(segInCtx, pkt) >= 0) {
            const pktView = new DataView(safeArrayBuffer(pkt, 0, 128));
            const inStreamIdx = pktView.getInt32(36, true);
            const targetStreamIdx = inStreamIdx < segNbStreams ? segStreamMap[inStreamIdx] : -1;

            if (targetStreamIdx >= 0 && targetStreamIdx < nbStreams) {
              const rawPts = pktView.getBigInt64(8, true);
              const rawDts = pktView.getBigInt64(16, true);
              const rawDuration = pktView.getBigInt64(64, true);

              if (firstPtsInSeg[targetStreamIdx] === null) {
                firstPtsInSeg[targetStreamIdx] = rawPts >= 0n ? rawPts : (rawDts >= 0n ? rawDts : 0n);
              }

              const basePts = firstPtsInSeg[targetStreamIdx] ?? 0n;
              const relPts = rawPts >= basePts ? rawPts - basePts : 0n;
              const relDts = rawDts >= basePts ? rawDts - basePts : relPts;

              const pktSpan = relPts + (rawDuration > 0n ? rawDuration : 1n);
              if (pktSpan > maxPtsInSeg[targetStreamIdx]) {
                maxPtsInSeg[targetStreamIdx] = pktSpan;
              }

              let newPts = relPts + streamPtsOffsets[targetStreamIdx];
              let newDts = relDts + streamPtsOffsets[targetStreamIdx];

              if (newDts <= lastDts[targetStreamIdx]) {
                newDts = lastDts[targetStreamIdx] + 1n;
              }
              if (newPts < newDts) {
                newPts = newDts;
              }
              lastDts[targetStreamIdx] = newDts;

              pktView.setInt32(36, targetStreamIdx, true); // Update stream index to target stream
              pktView.setBigInt64(8, newPts, true);
              pktView.setBigInt64(16, newDts, true);

              FFI.avformat.av_interleaved_write_frame(outCtx, pkt);
            }

            FFI.avcodec.av_packet_unref(pkt);
          }

          for (let s = 0; s < nbStreams; s++) {
            if (maxPtsInSeg[s] > 0n) {
              streamPtsOffsets[s] += maxPtsInSeg[s];
            } else if (lastDts[s] >= 0n) {
              streamPtsOffsets[s] = lastDts[s] + 1n;
            }
          }

          const pCloseSeg = new BigUint64Array([segInCtx]);
          FFI.avformat.avformat_close_input(ptr(pCloseSeg.buffer));
        }

        // 7. Write Trailer & Free output context
        FFI.avformat.av_write_trailer(outCtx);

        const outView = new DataView(safeArrayBuffer(outCtx, 0, 64));
        const pb = outView.getBigUint64(32, true);
        if (pb) {
          FFI.avformat.avio_close(pb);
        }
        FFI.avformat.avformat_free_context(outCtx);

        const pPkt = new BigUint64Array([pkt]);
        FFI.avcodec.av_packet_free(ptr(pPkt.buffer));

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }
}
