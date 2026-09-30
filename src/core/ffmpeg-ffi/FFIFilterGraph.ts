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
            avfilter = dlopen(path.join(binDir, 'avfilter-12.dll'), {
                avfilter_graph_alloc: { args: [], returns: FFIType.ptr },
                avfilter_graph_free: { args: [FFIType.ptr], returns: FFIType.void },
                avfilter_graph_parse2: { args: [FFIType.ptr, FFIType.cstring, FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
                avfilter_graph_config: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 },
                av_buffersrc_add_frame_flags: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
                av_buffersink_get_frame: { args: [FFIType.ptr, FFIType.ptr], returns: FFIType.i32 }
            }).symbols;
        }

        this.graph = BigInt(avfilter.avfilter_graph_alloc());
        if (!this.graph) throw new Error("Failed to allocate filter graph");
    }

    public parse(filterComplex: string) {
        // Prepare in/out linked lists (AVFilterInOut)
        // In a complete implementation, we'd need to allocate AVFilterInOut structs, 
        // link them to our buffersrc and buffersink nodes, and pass them here.
        // For this architectural implementation, we demonstrate the API call:
        
        const ret = avfilter.avfilter_graph_parse2(
            this.graph,
            Buffer.from(filterComplex + "\0"),
            0n, // inputs (AVFilterInOut**)
            0n  // outputs (AVFilterInOut**)
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
