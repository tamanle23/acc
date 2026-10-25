import { describe, it } from 'bun:test';
import path from 'path';
import { FFmpegManager } from '../packages/core/src/FFmpegManager';
import { FFI, initFFI, safeArrayBuffer } from '../packages/core/src/ffmpeg-ffi';
import { ptr } from 'bun:ffi';

describe('Inspect Stream Packets', () => {
  it('reads packets from stream 0 and 1', async () => {
    await FFmpegManager.prepare();
    initFFI();
    const filePath = path.resolve('sample-story/output/Dinosaur_Story_125.mp4');
    const inCtxPtr = new BigUint64Array(1);
    FFI.avformat.avformat_open_input(ptr(inCtxPtr.buffer), ptr(Buffer.from(filePath + '\0')), 0n, 0n);
    const inCtx = inCtxPtr[0];
    FFI.avformat.avformat_find_stream_info(inCtx, 0n);

    const pkt = BigInt(FFI.avcodec.av_packet_alloc?.() || FFI.avcodec.avpacket_alloc());
    let maxPts0 = 0n;
    let minPts0 = -1n;
    let count0 = 0;
    let maxPts1 = 0n;
    let minPts1 = -1n;
    let count1 = 0;

    while (FFI.avformat.av_read_frame(inCtx, pkt) >= 0) {
      const pktView = new DataView(safeArrayBuffer(pkt, 0, 128));
      const sIdx = pktView.getInt32(36, true);
      const pts = pktView.getBigInt64(8, true);
      const dts = pktView.getBigInt64(16, true);
      const dur = pktView.getBigInt64(64, true);

      if (sIdx === 0) {
        count0++;
        if (minPts0 === -1n) minPts0 = pts;
        if (pts > maxPts0) maxPts0 = pts;
      } else if (sIdx === 1) {
        count1++;
        if (minPts1 === -1n) minPts1 = pts;
        if (pts > maxPts1) maxPts1 = pts;
      }
      FFI.avcodec.av_packet_unref(pkt);
    }

    console.log(`Stream #0 (Video): count=${count0}, minPts=${minPts0}, maxPts=${maxPts0}, maxPtsSec=${Number(maxPts0) / 90000}`);
    console.log(`Stream #1 (Audio): count=${count1}, minPts=${minPts1}, maxPts=${maxPts1}, maxPtsSec=${Number(maxPts1) / 48000}`);

    const pClose = new BigUint64Array([inCtx]);
    FFI.avformat.avformat_close_input(ptr(pClose.buffer));
  });
});
