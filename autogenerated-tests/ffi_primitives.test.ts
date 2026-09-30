import { describe, test, expect, beforeAll } from "bun:test";
import { initFFI, FFI, Structs } from "../src/core/ffmpeg-ffi";
import { FFmpegManager } from "../src/core/FFmpegManager";
import { toArrayBuffer, ptr } from "bun:ffi";

describe("FFI Primitives & Struct Offsets Suite", () => {
  beforeAll(async () => {
    await FFmpegManager.prepare();
    initFFI();
  });

  test("AVPacket allocation and PTS/DTS memory manipulation", () => {
    const pktPtr = FFI.avcodec.av_packet_alloc();
    expect(pktPtr).not.toBe(0);

    const pktView = new DataView(toArrayBuffer(pktPtr, 0, 64));
    pktView.setBigInt64(8, 12345n, true); // pts
    pktView.setBigInt64(16, 12345n, true); // dts

    expect(pktView.getBigInt64(8, true)).toBe(12345n);
    expect(pktView.getBigInt64(16, true)).toBe(12345n);

    const ptrToFree = new BigUint64Array(1);
    ptrToFree[0] = BigInt(pktPtr);
    FFI.avcodec.av_packet_free(ptr(ptrToFree.buffer));
  });

  test("AVFrame allocation and PTS manipulation", () => {
    const framePtr = FFI.avutil.av_frame_alloc();
    expect(framePtr).not.toBe(0);

    Structs.AVFrame.setPts(framePtr, 987654321n);
    const view = new DataView(toArrayBuffer(framePtr, 0, 256));
    expect(view.getBigInt64(136, true)).toBe(987654321n);

    const ptrToFree = new BigUint64Array(1);
    ptrToFree[0] = BigInt(framePtr);
    FFI.avutil.av_frame_free(ptr(ptrToFree.buffer));
  });
});
