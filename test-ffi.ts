import { dlopen, FFIType, ptr, toArrayBuffer } from "bun:ffi";
import path from "path";
import os from "os";

const binDir = path.join(os.homedir(), '.acc', 'bin', 'ffmpeg-shared', 'ffmpeg-master-latest-win64-gpl-shared', 'bin');
const avcodecPath = path.join(binDir, 'avcodec-63.dll');

const avcodec = dlopen(avcodecPath, {
  av_packet_alloc: { args: [], returns: FFIType.ptr },
  av_packet_free: { args: [FFIType.ptr], returns: FFIType.void },
});

const pktPtr = avcodec.symbols.av_packet_alloc();
console.log("Allocated AVPacket at:", pktPtr);

// Test offsets
const pktView = new DataView(toArrayBuffer(pktPtr, 0, 64));
pktView.setBigInt64(8, 12345n, true); // pts
pktView.setBigInt64(16, 12345n, true); // dts

console.log("Set PTS/DTS successfully.");

const ptrToFree = new BigUint64Array(1);
ptrToFree[0] = BigInt(pktPtr);
avcodec.symbols.av_packet_free(ptr(ptrToFree.buffer));
console.log("Freed packet.");
