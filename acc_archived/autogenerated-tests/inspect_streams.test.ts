import { describe, it } from 'bun:test';
import path from 'path';
import { FFmpegManager } from '../packages/core/src/FFmpegManager';
import { FFI, initFFI, safeArrayBuffer } from '../packages/core/src/ffmpeg-ffi';
import { ptr } from 'bun:ffi';

describe('Inspect Stream Durations', () => {
  it('inspects streams', async () => {
    await FFmpegManager.prepare();
    initFFI();
    const filePath = path.resolve('sample-story/output/Dinosaur_Story_124.mp4');
    const inCtxPtr = new BigUint64Array(1);
    FFI.avformat.avformat_open_input(ptr(inCtxPtr.buffer), ptr(Buffer.from(filePath + '\0')), 0n, 0n);
    const inCtx = inCtxPtr[0];
    FFI.avformat.avformat_find_stream_info(inCtx, 0n);

    const inView = new DataView(safeArrayBuffer(inCtx, 0, 64));
    const nb = inView.getUint32(44, true);
    const dur = inView.getBigInt64(24, true);
    console.log('nbStreams:', nb, 'formatCtx duration:', Number(dur) / 1000000);

    const streamsPtr = inView.getBigUint64(48, true);
    const streamsArray = new DataView(safeArrayBuffer(streamsPtr, 0, nb * 8));

    for (let i = 0; i < nb; i++) {
      const sPtr = streamsArray.getBigUint64(i * 8, true);
      const sView = new DataView(safeArrayBuffer(sPtr, 0, 64));
      const num = sView.getInt32(32, true);
      const den = sView.getInt32(36, true);
      const durStream = sView.getBigInt64(40, true);
      const cpPtr = sView.getBigUint64(16, true);
      const cpView = new DataView(safeArrayBuffer(cpPtr, 0, 64));
      const codecType = cpView.getInt32(0, true); // 0=video, 1=audio
      const codecId = cpView.getInt32(4, true);
      console.log(`Stream #${i}: type=${codecType === 0 ? 'video' : 'audio'}(${codecType}), codecId=${codecId}, timebase=${num}/${den}, durTicks=${durStream}, durSec=${Number(durStream) * (num / den)}`);
    }

    const pClose = new BigUint64Array([inCtx]);
    FFI.avformat.avformat_close_input(ptr(pClose.buffer));
  });
});
