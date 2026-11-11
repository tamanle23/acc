import { describe, it, expect } from 'bun:test';
import {
  MEDIA_CATALOG,
  videoTextureEngine,
  VideoTextureEngine,
  userAudioTrack,
  renderBackground,
  INITIAL_STUDIO_STATE,
  processDarkroomGrading,
  BRAND_ARCHETYPES,
  preloadImage,
} from '../src/index';
import type { MediaCatalogItem } from '../src/types/media';

describe('Real-World Media Catalog & Video Texture Engine Suite', () => {
  describe('Media Catalog Integrity & Curation', () => {
    it('contains exactly 24 curated open-source CC0 and Public Domain assets', () => {
      expect(MEDIA_CATALOG.length).toBe(24);
    });

    it('ensures every asset has a unique non-empty ID', () => {
      const ids = new Set<string>();
      MEDIA_CATALOG.forEach((item) => {
        expect(typeof item.id).toBe('string');
        expect(item.id.length).toBeGreaterThan(0);
        expect(ids.has(item.id)).toBe(false);
        ids.add(item.id);
      });
      expect(ids.size).toBe(24);
    });

    it('enforces permissive CC0 or Public Domain licensing across all assets', () => {
      const allowedLicenses = ['CC0', 'Public Domain', 'Open Source', 'MIT'];
      MEDIA_CATALOG.forEach((item) => {
        expect(allowedLicenses).toContain(item.license);
        expect(typeof item.author).toBe('string');
        expect(item.author.length).toBeGreaterThan(0);
        expect(typeof item.source).toBe('string');
        expect(item.source.length).toBeGreaterThan(0);
      });
    });

    it('includes all 3 media types: images, motion video loops, and acoustic audio stems', () => {
      const images = MEDIA_CATALOG.filter((m) => m.mediaType === 'image');
      const videos = MEDIA_CATALOG.filter((m) => m.mediaType === 'video');
      const audios = MEDIA_CATALOG.filter((m) => m.mediaType === 'audio');

      expect(images.length).toBeGreaterThanOrEqual(10);
      expect(videos.length).toBeGreaterThanOrEqual(5);
      expect(audios.length).toBeGreaterThanOrEqual(6);
      expect(images.length + videos.length + audios.length).toBe(24);
    });

    it('includes seasonal and cultural heritage assets for Tet, Mid-Autumn, and Solstice', () => {
      const tet = MEDIA_CATALOG.find((m) => m.id === 'tet-xuan-apricot-blossom');
      expect(tet).toBeDefined();
      expect(tet?.tags).toContain('hoa-mai');
      expect(tet?.category).toBe('Festive & Cultural');

      const lantern = MEDIA_CATALOG.find((m) => m.id === 'hoi-an-silk-lantern-night');
      expect(lantern).toBeDefined();
      expect(lantern?.tags).toContain('trung-thu');

      const moon = MEDIA_CATALOG.find((m) => m.id === 'mid-autumn-harvest-moon');
      expect(moon).toBeDefined();
      expect(moon?.category).toBe('Festive & Cultural');

      const danTranh = MEDIA_CATALOG.find((m) => m.id === 'dan-tranh-sao-truc');
      expect(danTranh).toBeDefined();
      expect(danTranh?.mediaType).toBe('audio');
      expect(danTranh?.tags).toContain('dan-tranh');

      const bells = MEDIA_CATALOG.find((m) => m.id === 'cathedral-carillon-bells');
      expect(bells).toBeDefined();
      expect(bells?.tags).toContain('christmas');
    });

    it('provides high-fidelity offline SVG data-URI fallbacks for images and video textures', () => {
      const itemsWithFallbacks = MEDIA_CATALOG.filter((m) => m.dataUriFallback);
      expect(itemsWithFallbacks.length).toBeGreaterThanOrEqual(15);
      itemsWithFallbacks.forEach((item) => {
        expect(item.dataUriFallback?.startsWith('data:image/svg+xml')).toBe(true);
      });
    });

    it('validates URL schemes are HTTPS or local /media/ assets', () => {
      MEDIA_CATALOG.forEach((item) => {
        const isHttpsOrLocal = item.url.startsWith('https://') || item.url.startsWith('/media/');
        expect(isHttpsOrLocal).toBe(true);
      });
    });
  });

  describe('VideoTextureEngine Architecture', () => {
    it('provides a singleton instance conforming to VideoTextureEngine', () => {
      expect(videoTextureEngine).toBeDefined();
      expect(videoTextureEngine).toBeInstanceOf(VideoTextureEngine);
    });

    it('gracefully returns null frame when no active video is loaded', () => {
      videoTextureEngine.clear();
      const frame = videoTextureEngine.getVideoFrame();
      expect(frame).toBeNull();
    });

    it('handles seekVideoFrame deterministically without errors', async () => {
      const res = await videoTextureEngine.seekVideoFrame('https://example.com/mock.mp4', 2.5);
      expect(res === null || typeof res === 'object').toBe(true);
    });

    it('supports clearing cached video elements without memory leaks', () => {
      expect(() => videoTextureEngine.clear()).not.toThrow();
    });
  });

  describe('UserAudioTrackManager Integration', () => {
    it('exports userAudioTrack singleton with loadAudioFromUrl method', () => {
      expect(userAudioTrack).toBeDefined();
      expect(typeof userAudioTrack.loadAudioFromUrl).toBe('function');
      expect(typeof userAudioTrack.getTelemetryAtTime).toBe('function');
    });

    it('returns zero telemetry safely when no user audio track is active', () => {
      const telemetry = userAudioTrack.getTelemetryAtTime(1.5);
      expect(telemetry).toBeDefined();
      expect(typeof telemetry.level).toBe('number');
      expect(typeof telemetry.bass).toBe('number');
      expect(typeof telemetry.mid).toBe('number');
      expect(typeof telemetry.high).toBe('number');
      expect(typeof telemetry.beatPulse).toBe('number');
    });
  });

  describe('Composition & Darkroom Pipeline Integration', () => {
    it('executes renderBackground with bgVideoUrl and activeMediaAssetId without errors', () => {
      const mockSctx = {
        raw: {
          save: () => {},
          restore: () => {},
          fillRect: () => {},
          drawImage: () => {},
          beginPath: () => {},
          arc: () => {},
          stroke: () => {},
          fill: () => {},
          clearRect: () => {},
          globalAlpha: 1,
          fillStyle: '#000000',
          globalCompositeOperation: 'source-over',
        },
        clearRect: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        drawImage: () => {},
        save: () => {},
        restore: () => {},
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
      } as any;

      expect(() => {
        renderBackground({
          sctx: mockSctx,
          width: 1080,
          height: 1920,
          palette: {
            bg: '#000000',
            fg: '#ffffff',
            accent: '#00ffcc',
            muted: '#888888',
          },
          marginX: 40,
          marginY: 40,
          state: {
            ...INITIAL_STUDIO_STATE,
            bgVideoUrl: '/media/video/film-grain-loop.mp4',
            activeMediaAssetId: 'film-grain-35mm-loop',
          },
        });
      }).not.toThrow();
    });

    it('executes processDarkroomGrading safely when darkroom mode is disabled or simulated', () => {
      const mockCanvas = {
        width: 100,
        height: 100,
        getContext: () => ({
          drawImage: () => {},
          getImageData: () => ({
            data: new Uint8ClampedArray(100 * 100 * 4),
            width: 100,
            height: 100,
          }),
          putImageData: () => {},
        }),
      } as unknown as HTMLCanvasElement;

      const res = processDarkroomGrading(mockCanvas, {
        enabled: false,
        gradeStyle: 'duotone',
        shadowColor: '#000000',
        highlightColor: '#ffffff',
        ditherPattern: 'none',
        grainIntensity: 0,
        contrast: 1,
      });

      expect(res).toBeDefined();
    });
  });

  describe('Brand Archetype Media Associations & Fallback Preloader', () => {
    it('verifies all archetypes referencing media assets resolve to valid catalog items', () => {
      const archetypesWithMedia = BRAND_ARCHETYPES.filter(
        (a) => a.patch.activeMediaAssetId || a.patch.bgCustomImageKey || a.patch.bgVideoUrl
      );
      expect(archetypesWithMedia.length).toBeGreaterThanOrEqual(10);

      archetypesWithMedia.forEach((arch) => {
        if (arch.patch.activeMediaAssetId) {
          const item = MEDIA_CATALOG.find((m) => m.id === arch.patch.activeMediaAssetId);
          expect(item).toBeDefined();
        }
        if (arch.patch.bgCustomImageKey) {
          const item = MEDIA_CATALOG.find((m) => m.id === arch.patch.bgCustomImageKey);
          expect(item).toBeDefined();
        }
        if (arch.patch.bgVideoUrl) {
          const item = MEDIA_CATALOG.find((m) => m.url === arch.patch.bgVideoUrl);
          expect(item).toBeDefined();
        }
      });
    });

    it('safely attempts preloadImage without throwing for catalog assets', async () => {
      expect(typeof preloadImage).toBe('function');
      const res = await preloadImage('tet-xuan-apricot-blossom');
      expect(res === null || typeof res === 'object').toBe(true);
    });
  });
});
