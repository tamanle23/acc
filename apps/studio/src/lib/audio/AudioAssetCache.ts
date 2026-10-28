import { AssetProtocolRegistry } from '@acc/core-isomorphic';

/**
 * AudioAssetCache:
 * Reactive browser-native decoded audio buffer pool with LRU memory eviction.
 * Mirrors AssetTextureCache to decouple asynchronous network/decode latency
 * from the real-time synchronous timeline playback loop while enforcing a strict memory budget.
 */
export interface DecodedAudioData {
  channels: Float32Array[]; // Left and Right (or mono)
  sampleRate: number;
  durationSec: number;
  byteSize?: number;
}

export class AudioAssetCache {
  private static instance: AudioAssetCache;
  private audioContext: AudioContext | null = null;
  private cache = new Map<string, DecodedAudioData>();
  private inFlight = new Map<string, Promise<DecodedAudioData | null>>();
  private subscribers = new Set<() => void>();

  // Strict LRU budget to prevent uncompressed Float32Array PCM heap blowups
  private readonly MAX_CACHE_ENTRIES = 8;
  private readonly MAX_TOTAL_PCM_BYTES = 64 * 1024 * 1024; // 64 MB ceiling
  private currentPcmBytes = 0;

  private constructor() {}

  public static getInstance(): AudioAssetCache {
    if (!AudioAssetCache.instance) {
      AudioAssetCache.instance = new AudioAssetCache();
    }
    return AudioAssetCache.instance;
  }

  /**
   * Subscribes a listener to be notified when a pending audio decode finishes.
   * Returns an unsubscribe function.
   */
  public subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(): void {
    for (const callback of this.subscribers) {
      try {
        callback();
      } catch (err) {
        console.error('[AudioAssetCache] Subscriber callback threw error:', err);
      }
    }
  }

  private getAudioContext(): AudioContext | null {
    if (!this.audioContext && typeof window !== 'undefined') {
      const win = window as Window & { webkitAudioContext?: typeof AudioContext };
      const AudioCtx = window.AudioContext || win.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx({ sampleRate: 44100 });
      }
    }
    return this.audioContext;
  }

  /**
   * Synchronously queries decoded audio channel PCM.
   * If cached, refreshes LRU access order.
   * If not cached and src is provided, triggers asynchronous decode in the background.
   */
  public getAudioChannels(assetId: string, src?: string): DecodedAudioData | null {
    const existing = this.cache.get(assetId);
    if (existing) {
      // Refresh LRU order
      this.cache.delete(assetId);
      this.cache.set(assetId, existing);
      return existing;
    }

    if (src && !this.inFlight.has(assetId)) {
      this.fetchAndDecode(assetId, src);
    }

    return null;
  }

  /**
   * Asynchronously fetches audio bytes and decodes into Float32 PCM channels.
   * Enforces LRU memory eviction to prevent heap explosion.
   */
  public async fetchAndDecode(assetId: string, src: string): Promise<DecodedAudioData | null> {
    const existing = this.cache.get(assetId);
    if (existing) {
      this.cache.delete(assetId);
      this.cache.set(assetId, existing);
      return existing;
    }

    if (this.inFlight.has(assetId)) {
      return this.inFlight.get(assetId)!;
    }

    const promise = (async () => {
      try {
        const ctx = this.getAudioContext();
        if (!ctx) return null;

        // Resolve audio source via AssetProtocolRegistry (supports blob:, cache:, http:, data:)
        const assetBlob = AssetProtocolRegistry.getInstance().resolve(src);
        const arrayBuffer = await assetBlob.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        const channels: Float32Array[] = [];
        let byteSize = 0;
        for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
          const chData = new Float32Array(audioBuffer.getChannelData(c));
          channels.push(chData);
          byteSize += chData.byteLength;
        }

        const decoded: DecodedAudioData = {
          channels,
          sampleRate: audioBuffer.sampleRate,
          durationSec: audioBuffer.duration,
          byteSize,
        };

        this.evictToFit(assetId, byteSize);
        this.cache.set(assetId, decoded);
        this.currentPcmBytes += byteSize;
        this.inFlight.delete(assetId);
        this.notify();
        return decoded;
      } catch (err) {
        console.warn(`[AudioAssetCache] Failed to decode audio asset "${assetId}":`, err);
        this.inFlight.delete(assetId);
        return null;
      }
    })();

    this.inFlight.set(assetId, promise);
    return promise;
  }

  /**
   * Preloads all audio assets defined in a VideoIR document's assets map lazily.
   */
  public preloadAssets(assets: Record<string, { src: string; type: string }>): void {
    if (!assets) return;
    for (const [assetId, assetDef] of Object.entries(assets)) {
      if (assetDef.type === 'audio' && assetDef.src && !this.cache.has(assetId)) {
        this.fetchAndDecode(assetId, assetDef.src);
      }
    }
  }

  /**
   * Stores manually synthesized or mock decoded PCM (primarily for unit tests and headless environments).
   */
  public setDecodedMock(assetId: string, data: DecodedAudioData): void {
    const byteSize =
      data.byteSize || data.channels.reduce((acc, ch) => acc + ch.byteLength, 0);
    this.evictToFit(assetId, byteSize);
    this.cache.set(assetId, { ...data, byteSize });
    this.currentPcmBytes += byteSize;
    this.notify();
  }

  /**
   * Evicts least recently accessed audio channel buffers when exceeding limits.
   */
  private evictToFit(key: string, requiredBytes: number): void {
    const existing = this.cache.get(key);
    if (existing) {
      this.currentPcmBytes -= existing.byteSize || 0;
      this.cache.delete(key);
    }

    while (
      this.cache.size > 0 &&
      (this.cache.size >= this.MAX_CACHE_ENTRIES ||
        this.currentPcmBytes + requiredBytes > this.MAX_TOTAL_PCM_BYTES)
    ) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) break;
      const entry = this.cache.get(oldestKey);
      if (entry) {
        this.currentPcmBytes -= entry.byteSize || 0;
      }
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clears the cache.
   */
  public clear(): void {
    this.cache.clear();
    this.inFlight.clear();
    this.currentPcmBytes = 0;
  }
}
