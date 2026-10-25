import { FFI, initFFI } from './index';
import { ptr } from 'bun:ffi';
import { FFmpegManager } from '../FFmpegManager';
import { UniversalLogger as Logger } from '@acc/core-isomorphic';

export type HardwareEncoderType = 'nvenc' | 'videotoolbox' | 'vaapi' | 'qsv' | 'amf' | 'cpu';

export interface EncoderResolutionResult {
  encoderName: string;
  type: HardwareEncoderType;
  codec: 'h264' | 'hevc';
  isHardwareAccelerated: boolean;
  handle: bigint;
}

/**
 * GPUEncoderResolver
 *
 * Probes and dynamically resolves the optimal video encoder across
 * hardware platforms (NVIDIA NVENC, Apple VideoToolbox, Linux VAAPI, Intel QSV, AMD AMF)
 * with graceful, zero-regression software fallback (CPU libx264/libx265).
 *
 * Adheres strictly to OS-COMPAT, DEFENSIVE-CODING, and ZERO-ALLOC-FRAME-LOOP principles.
 */
export class GPUEncoderResolver {
  private static cachedResolutions: Map<string, EncoderResolutionResult> = new Map();
  private static isInitialized = false;

  private static async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await FFmpegManager.prepare();
      initFFI();
      this.isInitialized = true;
    }
  }

  /**
   * Returns candidate encoder names in prioritized order based on OS and user preference.
   */
  public static getCandidateChain(
    codec: 'h264' | 'hevc' = 'h264',
    preference?: HardwareEncoderType
  ): string[] {
    const isHevc = codec === 'hevc';
    const platform = process.platform;

    if (preference === 'cpu') {
      return isHevc ? ['libx265'] : ['libx264'];
    }

    if (preference) {
      // User specified a specific hardware type
      const preferredEncoder = this.mapTypeToEncoder(preference, codec);
      const fallbackCpu = isHevc ? 'libx265' : 'libx264';
      return [preferredEncoder, fallbackCpu];
    }

    // Default prioritized discovery per OS
    if (platform === 'darwin') {
      return isHevc
        ? ['hevc_videotoolbox', 'libx265']
        : ['h264_videotoolbox', 'libx264'];
    }

    if (platform === 'win32') {
      return isHevc
        ? ['hevc_nvenc', 'hevc_qsv', 'hevc_amf', 'libx265']
        : ['h264_nvenc', 'h264_qsv', 'h264_amf', 'libx264'];
    }

    // Linux & others
    return isHevc
      ? ['hevc_nvenc', 'hevc_vaapi', 'hevc_qsv', 'libx265']
      : ['h264_nvenc', 'h264_vaapi', 'h264_qsv', 'libx264'];
  }

  public static mapTypeToEncoder(type: HardwareEncoderType, codec: 'h264' | 'hevc' = 'h264'): string {
    const isHevc = codec === 'hevc';
    switch (type) {
      case 'nvenc':
        return isHevc ? 'hevc_nvenc' : 'h264_nvenc';
      case 'videotoolbox':
        return isHevc ? 'hevc_videotoolbox' : 'h264_videotoolbox';
      case 'vaapi':
        return isHevc ? 'hevc_vaapi' : 'h264_vaapi';
      case 'qsv':
        return isHevc ? 'hevc_qsv' : 'h264_qsv';
      case 'amf':
        return isHevc ? 'hevc_amf' : 'h264_amf';
      case 'cpu':
      default:
        return isHevc ? 'libx265' : 'libx264';
    }
  }

  public static mapEncoderToType(encoderName: string): HardwareEncoderType {
    const name = encoderName.toLowerCase();
    if (name.includes('nvenc')) return 'nvenc';
    if (name.includes('videotoolbox')) return 'videotoolbox';
    if (name.includes('vaapi')) return 'vaapi';
    if (name.includes('qsv')) return 'qsv';
    if (name.includes('amf')) return 'amf';
    return 'cpu';
  }

  /**
   * Resolves the best available encoder for the current platform and codec.
   * Performs defensive probing and validates that the hardware device can be opened.
   */
  public static async resolve(
    codec: 'h264' | 'hevc' = 'h264',
    preference?: HardwareEncoderType,
    forceRecheck = false
  ): Promise<EncoderResolutionResult> {
    await this.ensureInitialized();

    const cacheKey = `${codec}:${preference || 'auto'}`;
    if (!forceRecheck && this.cachedResolutions.has(cacheKey)) {
      return this.cachedResolutions.get(cacheKey)!;
    }

    const candidates = this.getCandidateChain(codec, preference);

    for (const encoderName of candidates) {
      const handle = this.findEncoderHandle(encoderName);
      if (!handle) continue;

      const type = this.mapEncoderToType(encoderName);
      const isHardware = type !== 'cpu';

      // For hardware encoders, defensively probe openability
      if (isHardware) {
        const isOpenable = this.testEncoderOpenable(handle, encoderName);
        if (!isOpenable) {
          Logger.warn(
            'GPUEncoderResolver',
            `Hardware encoder '${encoderName}' found in library but device failed initialization. Falling back...`
          );
          continue;
        }
      }

      const result: EncoderResolutionResult = {
        encoderName,
        type,
        codec,
        isHardwareAccelerated: isHardware,
        handle,
      };

      this.cachedResolutions.set(cacheKey, result);
      return result;
    }

    // Ultimate fallback to CPU
    const cpuName = codec === 'hevc' ? 'libx265' : 'libx264';
    const cpuHandle = this.findEncoderHandle(cpuName);
    if (!cpuHandle) {
      throw new Error(`Critical: No compatible video encoder found for codec '${codec}' in FFmpeg libraries.`);
    }

    const fallbackResult: EncoderResolutionResult = {
      encoderName: cpuName,
      type: 'cpu',
      codec,
      isHardwareAccelerated: false,
      handle: cpuHandle,
    };

    this.cachedResolutions.set(cacheKey, fallbackResult);
    return fallbackResult;
  }

  /**
   * Synchronous resolution (requires FFmpegManager.prepare() and initFFI() to have been called).
   */
  public static resolveSync(
    codec: 'h264' | 'hevc' = 'h264',
    preference?: HardwareEncoderType
  ): EncoderResolutionResult {
    initFFI();

    const cacheKey = `${codec}:${preference || 'auto'}`;
    if (this.cachedResolutions.has(cacheKey)) {
      return this.cachedResolutions.get(cacheKey)!;
    }

    const candidates = this.getCandidateChain(codec, preference);

    for (const encoderName of candidates) {
      const handle = this.findEncoderHandle(encoderName);
      if (!handle) continue;

      const type = this.mapEncoderToType(encoderName);
      const isHardware = type !== 'cpu';

      if (isHardware) {
        const isOpenable = this.testEncoderOpenable(handle, encoderName);
        if (!isOpenable) continue;
      }

      const result: EncoderResolutionResult = {
        encoderName,
        type,
        codec,
        isHardwareAccelerated: isHardware,
        handle,
      };

      this.cachedResolutions.set(cacheKey, result);
      return result;
    }

    const cpuName = codec === 'hevc' ? 'libx265' : 'libx264';
    const cpuHandle = this.findEncoderHandle(cpuName);
    if (!cpuHandle) {
      throw new Error(`Critical: No compatible video encoder found for codec '${codec}' in FFmpeg libraries.`);
    }

    const fallbackResult: EncoderResolutionResult = {
      encoderName: cpuName,
      type: 'cpu',
      codec,
      isHardwareAccelerated: false,
      handle: cpuHandle,
    };

    this.cachedResolutions.set(cacheKey, fallbackResult);
    return fallbackResult;
  }

  public static findEncoderHandle(encoderName: string): bigint {
    try {
      const nameBuf = Buffer.from(encoderName + '\0');
      return BigInt(FFI.avcodec.avcodec_find_encoder_by_name(ptr(nameBuf)) || 0n);
    } catch {
      return 0n;
    }
  }

  /**
   * Probes whether an encoder context can be allocated and opened without error.
   * Completely cleans up all temporary native allocations to avoid memory leaks.
   */
  private static testEncoderOpenable(handle: bigint, encoderName: string): boolean {
    if (!handle) return false;
    let ctx = 0n;
    try {
      ctx = BigInt(FFI.avcodec.avcodec_alloc_context3(handle) || 0n);
      if (!ctx) return false;

      FFI.avutil.av_opt_set(ctx, ptr(Buffer.from('video_size\0')), ptr(Buffer.from('320x240\0')), 0);
      FFI.avutil.av_opt_set(ctx, ptr(Buffer.from('time_base\0')), ptr(Buffer.from('1/30\0')), 0);
      FFI.avutil.av_opt_set_int(ctx, ptr(Buffer.from('pixel_format\0')), 0n, 0); // AV_PIX_FMT_YUV420P

      // Disable logging during test probe to suppress stderr noise
      const openRet = FFI.avcodec.avcodec_open2(ctx, handle, 0n);
      return openRet >= 0;
    } catch {
      return false;
    } finally {
      if (ctx) {
        try {
          const p = new BigUint64Array([ctx]);
          FFI.avcodec.avcodec_free_context(ptr(p.buffer));
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Enumerate all currently available and openable encoders on this host.
   */
  public static async getAvailableEncoders(): Promise<EncoderResolutionResult[]> {
    await this.ensureInitialized();
    const probeList = [
      'h264_nvenc',
      'hevc_nvenc',
      'h264_videotoolbox',
      'hevc_videotoolbox',
      'h264_vaapi',
      'hevc_vaapi',
      'h264_qsv',
      'hevc_qsv',
      'h264_amf',
      'hevc_amf',
      'libx264',
      'libx265',
    ];

    const results: EncoderResolutionResult[] = [];

    for (const name of probeList) {
      const handle = this.findEncoderHandle(name);
      if (!handle) continue;

      const type = this.mapEncoderToType(name);
      const isHardware = type !== 'cpu';

      if (isHardware) {
        if (!this.testEncoderOpenable(handle, name)) continue;
      }

      results.push({
        encoderName: name,
        type,
        codec: name.startsWith('hevc') ? 'hevc' : 'h264',
        isHardwareAccelerated: isHardware,
        handle,
      });
    }

    return results;
  }
}
