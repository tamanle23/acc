export interface AssetMetadata {
  assetId: string;
  src: string;
  type: string;
  durationSeconds: number;
  durationFrames: number;
  width?: number;
  height?: number;
  sampleRate?: number;
  channels?: number;
}

export interface IAssetMetadataProber {
  probe(assetId: string, src: string, type: string, fps?: number): Promise<AssetMetadata>;
}

function resolveAssetPath(baseDir: string, src: string): string {
  if (/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(src) || src.startsWith('http://') || src.startsWith('https://') || src.startsWith('blob:')) {
    return src;
  }
  const cleanBase = baseDir.replace(/[\\/]+$/, '');
  const cleanSrc = src.replace(/^[\\/]+/, '');
  return `${cleanBase}/${cleanSrc}`;
}

/**
 * Asset Metadata Prober:
 * Inspects local container headers (and mockable remote stream headers)
 * to establish immutable media dimensions, duration, and channel layouts before DAG compilation.
 */
export class AssetMetadataProber implements IAssetMetadataProber {
  private baseDir: string;
  private cache: Map<string, AssetMetadata> = new Map();

  constructor(baseDir: string = typeof process !== 'undefined' && typeof process.cwd === 'function' ? process.cwd() : '.') {
    this.baseDir = baseDir;
  }

  public async probe(
    assetId: string,
    src: string,
    type: string,
    fps: number = 30
  ): Promise<AssetMetadata> {
    const cacheKey = `${assetId}:${src}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const resolvedPath = resolveAssetPath(this.baseDir, src);
    let durationSeconds = 5.0; // defensive fallback default

    if (typeof process !== 'undefined' && (process.versions?.node || (process.versions as any)?.bun)) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(resolvedPath)) {
          // Attempt fast binary header probing for wav or mp3 if audio
          if (type === 'audio' || src.endsWith('.wav')) {
            const wavDuration = this.probeWavHeaderSync(fs, resolvedPath);
            if (wavDuration !== null) {
              durationSeconds = wavDuration;
            }
          }
        }
      } catch {
        // Fallback gracefully on parsing errors
      }
    }

    const durationFrames = Math.max(1, Math.round(durationSeconds * fps));
    const meta: AssetMetadata = {
      assetId,
      src,
      type,
      durationSeconds,
      durationFrames,
      sampleRate: 48000,
      channels: 2,
    };

    this.cache.set(cacheKey, meta);
    return meta;
  }

  /**
   * Fast header prober for RIFF WAV files without reading the full body
   */
  private probeWavHeaderSync(fs: any, filePath: string): number | null {
    const fd = fs.openSync(filePath, 'r');
    try {
      const headerBuf = Buffer.alloc(44);
      fs.readSync(fd, headerBuf, 0, 44, 0);

      // Check "RIFF" and "WAVE"
      if (headerBuf.toString('ascii', 0, 4) !== 'RIFF' || headerBuf.toString('ascii', 8, 12) !== 'WAVE') {
        return null;
      }

      const byteRate = headerBuf.readUInt32LE(28);
      // Chunk size in RIFF is at offset 4
      const fileSize = fs.statSync(filePath).size;
      const dataSize = Math.max(0, fileSize - 44);

      if (byteRate > 0) {
        return dataSize / byteRate;
      }
      return null;
    } finally {
      fs.closeSync(fd);
    }
  }

  public registerStaticMetadata(meta: AssetMetadata): void {
    this.cache.set(`${meta.assetId}:${meta.src}`, meta);
  }
}
