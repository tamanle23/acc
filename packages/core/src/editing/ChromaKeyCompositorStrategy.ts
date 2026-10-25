export interface ChromaKeyOptions {
  keyColorHex?: string; // default '#00FF00'
  similarity?: number; // 0.0 to 1.0 (default 0.15)
  blend?: number; // 0.0 to 1.0 (default 0.05)
}

export class ChromaKeyCompositorStrategy {
  public static generateFFmpegChromaKeyFilter(options: ChromaKeyOptions = {}): string {
    const keyColor = options.keyColorHex || '0x00FF00';
    const similarity = options.similarity ?? 0.15;
    const blend = options.blend ?? 0.05;

    return `chromakey=color=${keyColor}:similarity=${similarity.toFixed(2)}:blend=${blend.toFixed(2)},despill`;
  }
}
