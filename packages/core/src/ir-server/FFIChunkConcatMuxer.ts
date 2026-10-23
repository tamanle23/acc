import { FFIConcatMuxer } from '../ffmpeg-ffi/FFIConcatMuxer';

export interface ChunkConcatOptions {
  cleanupChunks?: boolean;
}

/**
 * FFIChunkConcatMuxer:
 * Lossless zero-reencode fast concatenation via native bun:ffi packet remuxing.
 * Operates at stream packet level (<500ms) without transcoding frames or decoding audio/video.
 */
export class FFIChunkConcatMuxer {
  /**
   * Concatenates an ordered list of video chunk paths into a single output video.
   *
   * @param chunkPaths Ordered paths to intermediate chunk videos (.mp4)
   * @param outputPath Path to write final concatenated output file
   * @param options Optional flags (e.g. cleanup temporary chunk files)
   */
  public static async concatenate(
    chunkPaths: string[],
    outputPath: string,
    options: ChunkConcatOptions = {}
  ): Promise<void> {
    if (!chunkPaths || chunkPaths.length === 0) {
      throw new Error('FFIChunkConcatMuxer: No chunk paths provided for concatenation.');
    }

    if (chunkPaths.length === 1) {
      const fs = await import('fs');
      await fs.promises.copyFile(chunkPaths[0], outputPath);
      if (options.cleanupChunks) {
        try {
          await fs.promises.unlink(chunkPaths[0]);
        } catch {}
      }
      return;
    }

    // Delegate to native FFI packet remuxer
    await FFIConcatMuxer.concatenate(chunkPaths, outputPath);

    // Clean up temporary chunks if requested
    if (options.cleanupChunks) {
      const fs = await import('fs');
      for (const p of chunkPaths) {
        try {
          if (fs.existsSync(p)) {
            await fs.promises.unlink(p);
          }
        } catch {}
      }
    }
  }
}
