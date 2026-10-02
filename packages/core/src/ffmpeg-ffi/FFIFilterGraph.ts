import { FFI, freePtr } from "./index";
import { ptr, FFIType, dlopen } from "bun:ffi";
import os from "os";
import path from "path";
import { FFmpegManager } from "../FFmpegManager";

let avfilter: any;

export class FFIFilterGraph {
    private graph: bigint = 0n;
    private inputs: bigint = 0n;
    private outputs: bigint = 0n;

    constructor() {
        if (!avfilter) {
            const binDir = FFmpegManager.getBinDir();
            const ext = process.platform === 'darwin' ? '.dylib' : '.so';
            const winName = 'avfilter-12.dll';
            const unixName = `libavfilter${ext}`;
            let libPath = process.platform === 'win32' ? path.join(binDir, winName) : unixName;
            if (process.platform !== 'win32') {
              const candidateInBin = path.join(binDir, unixName);
              if (fs.existsSync(candidateInBin)) libPath = candidateInBin;
              else {
                const searchDirs = [binDir, '/usr/lib/x86_64-linux-gnu', '/usr/lib64', '/usr/lib', '/opt/homebrew/lib'];
                for (const dir of searchDirs) {
                  try {
                    if (dir && fs.existsSync(dir)) {
                      const match = fs.readdirSync(dir).find(f => f.startsWith('libavfilter'));
                      if (match) { libPath = path.join(dir, match); break; }
                    }
                  } catch {}
                }
              }
            }

            avfilter = dlopen(libPath, {
                avfilter_graph_alloc: { args: [], returns: FFIType.u64 },
                avfilter_graph_free: { args: [FFIType.ptr], returns: FFIType.void },
                avfilter_graph_parse2: { args: [FFIType.u64, FFIType.ptr, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
                avfilter_graph_config: { args: [FFIType.u64, FFIType.ptr], returns: FFIType.i32 },
                av_buffersrc_add_frame_flags: { args: [FFIType.u64, FFIType.u64, FFIType.i32], returns: FFIType.i32 },
                av_buffersink_get_frame: { args: [FFIType.u64, FFIType.u64], returns: FFIType.i32 }
            }).symbols;
        }

        this.graph = BigInt(avfilter.avfilter_graph_alloc());
        if (!this.graph) throw new Error("Failed to allocate filter graph");
    }

    public parse(filterComplex: string) {
        const inPtr = new BigUint64Array(1);
        const outPtr = new BigUint64Array(1);
        const ret = avfilter.avfilter_graph_parse2(
            this.graph,
            ptr(Buffer.from(filterComplex + "\0")),
            ptr(inPtr.buffer),
            ptr(outPtr.buffer)
        );
        
        if (ret < 0) {
            throw new Error("Failed to parse filter_complex string: " + filterComplex);
        }
    }

    public config() {
        const ret = avfilter.avfilter_graph_config(this.graph, 0n);
        if (ret < 0) throw new Error("Failed to configure filter graph");
    }

    public pushFrame(srcFilterContext: bigint, frame: bigint) {
        // Flags: AV_BUFFERSRC_FLAG_KEEP_REF = 8
        const ret = avfilter.av_buffersrc_add_frame_flags(srcFilterContext, frame, 8);
        if (ret < 0) throw new Error("Error pushing frame to filtergraph");
    }

    public pullFrame(sinkFilterContext: bigint, frame: bigint): boolean {
        const ret = avfilter.av_buffersink_get_frame(sinkFilterContext, frame);
        if (ret >= 0) return true; // Frame successfully pulled
        // if ret is AVERROR(EAGAIN) or AVERROR_EOF, no frame available right now
        return false;
    }

    public free() {
        if (this.graph) {
            freePtr(avfilter.avfilter_graph_free, this.graph);
            this.graph = 0n;
        }
    }
}
