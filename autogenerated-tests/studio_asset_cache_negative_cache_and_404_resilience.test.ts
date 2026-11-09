import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { AudioAssetCache } from '../apps/studio/src/lib/audio/AudioAssetCache';
import { AssetTextureCache } from '../apps/studio/src/lib/textures/AssetTextureCache';
import { complexSciFiDemoIR } from '../apps/studio/src/lib/ir/complexSciFiDemoIR';
import { defaultDemoIR } from '../apps/studio/src/lib/ir/defaultDemoIR';
import { cinemaMasteringDemoIR } from '../apps/studio/src/lib/ir/cinemaMasteringDemoIR';
import { astroTelemetryDemoIR } from '../apps/studio/src/lib/ir/astroTelemetryDemoIR';
import { broadcastNewsDemoIR } from '../apps/studio/src/lib/ir/broadcastNewsDemoIR';
import { cyberAudioVisualizerDemoIR } from '../apps/studio/src/lib/ir/cyberAudioVisualizerDemoIR';
import { kineticTypographyDemoIR } from '../apps/studio/src/lib/ir/kineticTypographyDemoIR';
import { quantumPhysicsDemoIR } from '../apps/studio/src/lib/ir/quantumPhysicsDemoIR';
import { spatialAudioDemoIR } from '../apps/studio/src/lib/ir/spatialAudioDemoIR';

describe('Studio Asset Cache Negative Caching & 404 Resilience Suite', () => {
  const originalAudioContext = (globalThis as any).AudioContext;

  beforeEach(() => {
    (globalThis as any).AudioContext = class MockAudioContext {
      state = 'running';
      sampleRate = 44100;
      async decodeAudioData(buf: ArrayBuffer) {
        return {
          numberOfChannels: 2,
          sampleRate: 44100,
          duration: 1.0,
          getChannelData: () => new Float32Array(44100),
        };
      }
      close() {
        this.state = 'closed';
      }
    };
    AudioAssetCache.getInstance().clear();
    AssetTextureCache.getInstance().clear();
  });

  afterEach(() => {
    AudioAssetCache.getInstance().clear();
    AssetTextureCache.getInstance().clear();
    (globalThis as any).AudioContext = originalAudioContext;
  });

  describe('AudioAssetCache Negative Caching & Infinite Loop Prevention', () => {
    it('should immediately return null and not invoke inFlight fetch when asset is negatively cached', async () => {
      const audioCache = AudioAssetCache.getInstance();
      const testAssetId = 'asset-dead-sound-test';
      const deadUrl = 'https://actions.google.com/sounds/v1/science_fiction/nonexistent_404_sound.ogg';

      // First fetch should fail and mark as failed
      const firstResult = await audioCache.fetchAndDecode(testAssetId, deadUrl);
      expect(firstResult).toBeNull();

      // Ensure asset is marked failed in internal tracking
      const isFailedInternal = (audioCache as any).isFailed(testAssetId);
      expect(isFailedInternal).toBe(true);

      // Now synchronous getAudioChannels must return null immediately
      // and NOT create an in-flight promise
      const syncResult = audioCache.getAudioChannels(testAssetId, deadUrl);
      expect(syncResult).toBeNull();
      expect((audioCache as any).inFlight.has(testAssetId)).toBe(false);

      // A subsequent fetchAndDecode call must also short-circuit immediately without network call
      const secondResult = await audioCache.fetchAndDecode(testAssetId, deadUrl);
      expect(secondResult).toBeNull();
      expect((audioCache as any).inFlight.has(testAssetId)).toBe(false);
    });

    it('should skip negatively cached assets during preloadAssets batch execution', () => {
      const audioCache = AudioAssetCache.getInstance();
      const failedAssetId = 'asset-already-failed';
      const failedUrl = 'https://actions.google.com/sounds/v1/science_fiction/failed_track.ogg';

      // Mark as failed
      (audioCache as any).markFailed(failedAssetId, failedUrl);

      // Call preloadAssets
      audioCache.preloadAssets({
        [failedAssetId]: {
          src: failedUrl,
          type: 'audio',
        },
      });

      // No in-flight promise should be registered
      expect((audioCache as any).inFlight.has(failedAssetId)).toBe(false);
    });

    it('should recover and clear failed state when setDecodedMock is called or cache is cleared', async () => {
      const audioCache = AudioAssetCache.getInstance();
      const assetId = 'asset-recoverable';
      const deadUrl = 'https://actions.google.com/sounds/v1/science_fiction/dead_recoverable.ogg';

      (audioCache as any).markFailed(assetId, deadUrl);
      expect((audioCache as any).isFailed(assetId)).toBe(true);

      // Mock audio data injection
      const mockPcm = new Float32Array(100);
      audioCache.setDecodedMock(assetId, {
        channels: [mockPcm, mockPcm],
        sampleRate: 44100,
        durationSec: 100 / 44100,
      });

      // Failed state should now be cleared and channels returned
      expect((audioCache as any).isFailed(assetId)).toBe(false);
      const retrieved = audioCache.getAudioChannels(assetId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.channels.length).toBe(2);

      // Clear cache resets everything
      audioCache.clear();
      expect(audioCache.getAudioChannels(assetId)).toBeNull();
    });
  });

  describe('AssetTextureCache Negative Caching & 404 Image Prevention', () => {
    it('should prevent 60fps render loop when an image URL fails to load', async () => {
      const textureCache = AssetTextureCache.getInstance();
      const assetId = 'asset-failing-image';
      const deadUrl = 'https://images.unsplash.com/photo-nonexistent-404-image';

      // Mark URL as failed as if a network 404 or decoding error happened
      (textureCache as any).markFailed(deadUrl);
      (textureCache as any).markFailed(assetId);

      expect((textureCache as any).isFailed(deadUrl)).toBe(true);
      expect((textureCache as any).isFailed(assetId)).toBe(true);

      // getVisualAsset should return placeholder directly and NOT initiate inFlightResolutions
      const visual = textureCache.getVisualAsset(assetId, deadUrl, 'image', 0);
      expect(visual.type).toBe('placeholder');
      expect((textureCache as any).inFlightResolutions.has(deadUrl)).toBe(false);
    });

    it('should clear failed image state when direct texture is set or cache is disposed', () => {
      const textureCache = AssetTextureCache.getInstance();
      const assetId = 'asset-image-recovery';

      (textureCache as any).markFailed(assetId);
      expect((textureCache as any).isFailed(assetId)).toBe(true);

      // Direct texture registration should clear failure status
      const mockCanvas = { width: 640, height: 360 };
      textureCache.set(assetId, mockCanvas);
      expect((textureCache as any).isFailed(assetId)).toBe(false);

      const visual = textureCache.getVisualAsset(assetId, undefined, 'image', 0);
      expect(visual.isReady).toBe(true);
      expect(visual.source).toBe(mockCanvas);

      // dispose clears failed tracking
      (textureCache as any).markFailed(assetId);
      expect((textureCache as any).isFailed(assetId)).toBe(true);
      textureCache.dispose();
      expect((textureCache as any).isFailed(assetId)).toBe(false);
    });
  });

  describe('Demo IR Assets Integrity & Replacement Verification', () => {
    const demoConfigs = [
      { name: 'complexSciFiDemoIR', ir: complexSciFiDemoIR },
      { name: 'defaultDemoIR', ir: defaultDemoIR },
      { name: 'cinemaMasteringDemoIR', ir: cinemaMasteringDemoIR },
      { name: 'astroTelemetryDemoIR', ir: astroTelemetryDemoIR },
      { name: 'broadcastNewsDemoIR', ir: broadcastNewsDemoIR },
      { name: 'cyberAudioVisualizerDemoIR', ir: cyberAudioVisualizerDemoIR },
      { name: 'kineticTypographyDemoIR', ir: kineticTypographyDemoIR },
      { name: 'quantumPhysicsDemoIR', ir: quantumPhysicsDemoIR },
      { name: 'spatialAudioDemoIR', ir: spatialAudioDemoIR },
    ];

    it('should have zero references to deprecated 404 sound files in any demo IR', () => {
      for (const { name, ir } of demoConfigs) {
        if (!ir.assets) continue;
        for (const [assetId, assetDef] of Object.entries(ir.assets)) {
          const src = (assetDef as any).src || '';
          expect(src).not.toContain('deep_hum.ogg');
          expect(src).not.toContain('scifi_engine_shut_down.ogg');
        }
      }
    });

    it('should only use valid, active Google Actions sound effects across all demo IR documents', () => {
      const validAllowedGoogleSounds = new Set([
        'forboding_resonance.ogg',
        'sci_fi_vortex.ogg',
        'robot_code.ogg',
        'electric_ring_long.ogg',
        'ringing_ambient_background.ogg',
        'windchime_drone.ogg',
        'rain_heavy_loud.ogg',
      ]);

      for (const { name, ir } of demoConfigs) {
        if (!ir.assets) continue;
        for (const [assetId, assetDef] of Object.entries(ir.assets)) {
          const src = (assetDef as any).src || '';
          if (src.includes('actions.google.com/sounds/')) {
            const filename = src.split('/').pop();
            expect(validAllowedGoogleSounds.has(filename)).toBe(true);
          }
        }
      }
    });
  });
});
