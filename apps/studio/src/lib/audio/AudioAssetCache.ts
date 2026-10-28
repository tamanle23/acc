/**
 * AudioAssetCache:
 * Reactive browser-native decoded audio buffer pool with Observer pattern.
 * Mirrors AssetTextureCache to decouple asynchronous network/decode latency
 * from the real-time synchronous timeline playback loop.
 */
export interface DecodedAudioData {
  channels: Float32Array[]; // Left and Right (or mono)
  sampleRate: number;
  durationSec: number;
}

export class AudioAssetCache {
  private static instance: AudioAssetCache;
  private audioContext: AudioContext | null = null;
  private cache = new Map<string, DecodedAudioData>();
  private inFlight = new Map<string, Promise<DecodedAudioData | null>>();
  private subscribers = new Set<() => void>();

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
   * If not cached and src is provided, triggers asynchronous decode in the background.
   */
  public getAudioChannels(assetId: string, src?: string): DecodedAudioData | null {
    if (this.cache.has(assetId)) {
      return this.cache.get(assetId)!;
    }

    if (src && !this.inFlight.has(assetId)) {
      this.fetchAndDecode(assetId, src);
    }

    return null;
  }

  /**
   * Asynchronously fetches audio bytes and decodes into Float32 PCM channels.
   */
  public async fetchAndDecode(assetId: string, src: string): Promise<DecodedAudioData | null> {
    if (this.cache.has(assetId)) {
      return this.cache.get(assetId)!;
    }

    if (this.inFlight.has(assetId)) {
      return this.inFlight.get(assetId)!;
    }

    const promise = (async () => {
      try {
        const ctx = this.getAudioContext();
        if (!ctx) return null;

        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} fetching audio asset ${src}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        const channels: Float32Array[] = [];
        for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
          channels.push(new Float32Array(audioBuffer.getChannelData(c)));
        }

        const decoded: DecodedAudioData = {
          channels,
          sampleRate: audioBuffer.sampleRate,
          durationSec: audioBuffer.duration,
        };

        this.cache.set(assetId, decoded);
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
   * Preloads all audio assets defined in a VideoIR document's assets map.
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
    this.cache.set(assetId, data);
    this.notify();
  }

  /**
   * Clears the cache.
   */
  public clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }
}
