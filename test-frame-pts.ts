import { initFFI, FFI } from "./src/core/ffmpeg-ffi";
import { ptr, toArrayBuffer } from "bun:ffi";

initFFI();

const framePtr = FFI.avutil.av_frame_alloc();
console.log("Allocated frame");

// Write PTS to offset 144
const view = new DataView(toArrayBuffer(framePtr, 0, 256));
view.setBigInt64(144, 987654321n, true);

// Verify by setting something else in av_opt? No, AVFrame is not AVClass.
// But we can check if it crashes.
console.log("Written PTS to offset 144");
