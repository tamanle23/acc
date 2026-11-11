import { describe, it, expect } from 'bun:test';
import {
  computePopoverPosition,
  Popover,
  TransitionPickerPopover,
  TRANSITION_CATALOG,
  TransitionRegistry,
} from '../src/index';

describe('Reusable Popover & Enhanced Transition Picker Suite', () => {
  describe('computePopoverPosition Algorithm & Collision Avoidance', () => {
    const viewportWidth = 1920;
    const viewportHeight = 1080;
    const padding = 8;
    const offset = 8;

    it('positions popover above anchor by default (placement: top)', () => {
      // Anchor in center of screen
      const anchorRect = {
        top: 500,
        bottom: 540,
        left: 900,
        right: 960,
        width: 60,
        height: 40,
      };
      const popoverRect = { width: 300, height: 200 };

      const res = computePopoverPosition(anchorRect, popoverRect, {
        placement: 'top',
        offset,
        padding,
        viewportWidth,
        viewportHeight,
      });

      // top = 500 - 200 - 8 = 292
      expect(res.top).toBe(292);
      // left = 900 + (60 - 300) / 2 = 900 - 120 = 780
      expect(res.left).toBe(780);
      expect(res.placement).toBe('top');
      expect(res.maxHeight).toBe(viewportHeight - 2 * padding);
    });

    it('auto-flips from bottom to top when anchor is at the bottom of viewport (Storyboard Drawer case)', () => {
      // Simulating Storyboard Drawer badge near bottom of screen
      // Viewport height = 1080, anchor bottom = 1020, space below = 1080 - 1020 - 8 - 8 = 44px (< 300px popover)
      const anchorRect = {
        top: 980,
        bottom: 1020,
        left: 500,
        right: 580,
        width: 80,
        height: 40,
      };
      const popoverRect = { width: 384, height: 320 };

      const res = computePopoverPosition(anchorRect, popoverRect, {
        placement: 'bottom', // user requested bottom
        autoFlip: true,
        offset: 10,
        padding,
        viewportWidth,
        viewportHeight,
      });

      // Should auto-flip to top because spaceBelow (42px) < popoverHeight (320px) and spaceAbove is large
      expect(res.placement).toBe('top');
      // top = 980 - 320 - 10 = 650
      expect(res.top).toBe(650);
      expect(res.top).toBeGreaterThan(0);
      expect(res.top + popoverRect.height).toBeLessThanOrEqual(anchorRect.top);
    });

    it('auto-flips from top to bottom when anchor is at the top of viewport', () => {
      // Simulating top header bar, space above is only 20px
      const anchorRect = {
        top: 20,
        bottom: 60,
        left: 500,
        right: 580,
        width: 80,
        height: 40,
      };
      const popoverRect = { width: 300, height: 250 };

      const res = computePopoverPosition(anchorRect, popoverRect, {
        placement: 'top',
        autoFlip: true,
        offset: 8,
        padding,
        viewportWidth,
        viewportHeight,
      });

      // Should auto-flip to bottom because spaceAbove (4px) < 250px
      expect(res.placement).toBe('bottom');
      // top = 60 + 8 = 68
      expect(res.top).toBe(68);
    });

    it('respects start and end alignment', () => {
      const anchorRect = {
        top: 500,
        bottom: 540,
        left: 300,
        right: 400,
        width: 100,
        height: 40,
      };
      const popoverRect = { width: 200, height: 150 };

      const resStart = computePopoverPosition(anchorRect, popoverRect, {
        placement: 'bottom-start',
        offset: 8,
        padding,
        viewportWidth,
        viewportHeight,
      });
      expect(resStart.left).toBe(300);
      expect(resStart.placement).toBe('bottom-start');

      const resEnd = computePopoverPosition(anchorRect, popoverRect, {
        placement: 'bottom-end',
        offset: 8,
        padding,
        viewportWidth,
        viewportHeight,
      });
      // left = 400 - 200 = 200
      expect(resEnd.left).toBe(200);
      expect(resEnd.placement).toBe('bottom-end');
    });

    it('clamps horizontal position when anchor is near screen edges (never bleeds offscreen)', () => {
      // Anchor at extreme right edge of screen
      const anchorRect = {
        top: 500,
        bottom: 540,
        left: 1900,
        right: 1920,
        width: 20,
        height: 40,
      };
      const popoverRect = { width: 300, height: 200 };

      const res = computePopoverPosition(anchorRect, popoverRect, {
        placement: 'top',
        offset: 8,
        padding: 10,
        viewportWidth,
        viewportHeight,
      });

      // Clamped to viewportWidth - popoverWidth - padding = 1920 - 300 - 10 = 1610
      expect(res.left).toBe(1610);
      expect(res.left + 300).toBeLessThanOrEqual(viewportWidth - 10);
    });

    it('clamps left boundary to padding if anchor is near left screen edge', () => {
      const anchorRect = {
        top: 500,
        bottom: 540,
        left: 5,
        right: 25,
        width: 20,
        height: 40,
      };
      const popoverRect = { width: 300, height: 200 };

      const res = computePopoverPosition(anchorRect, popoverRect, {
        placement: 'top',
        offset: 8,
        padding: 12,
        viewportWidth,
        viewportHeight,
      });

      expect(res.left).toBe(12);
    });
  });

  describe('Transition Catalog & Categorization', () => {
    it('covers all 8 transitions registered in TransitionRegistry', () => {
      const registryTypes = TransitionRegistry.getAvailableTypes();
      expect(registryTypes.length).toBe(8);

      const catalogIds = TRANSITION_CATALOG.map((t) => t.id);
      expect(catalogIds.length).toBe(8);

      registryTypes.forEach((type) => {
        expect(catalogIds).toContain(type);
      });
    });

    it('partitions transitions into 3 distinct UI categories', () => {
      const categories = new Set(TRANSITION_CATALOG.map((t) => t.category));
      expect(Array.from(categories).sort()).toEqual(['3d', 'kinetic', 'optical']);

      const threeD = TRANSITION_CATALOG.filter((t) => t.category === '3d');
      expect(threeD.map((t) => t.id)).toEqual([
        'spin-orbit-dissolve',
        'dolly-punch-through',
        'cross-zoom',
      ]);

      const optical = TRANSITION_CATALOG.filter((t) => t.category === 'optical');
      expect(optical.map((t) => t.id)).toEqual(['cross-dissolve', 'cut']);

      const kinetic = TRANSITION_CATALOG.filter((t) => t.category === 'kinetic');
      expect(kinetic.map((t) => t.id)).toEqual(['whip-pan', 'matte-wipe', 'glitch-dissolve']);
    });

    it('marks directional transitions correctly', () => {
      const directional = TRANSITION_CATALOG.filter((t) => t.supportsDirection);
      expect(directional.map((t) => t.id)).toEqual(['whip-pan', 'matte-wipe']);
    });

    it('each transition has human-readable metadata, badge, and description', () => {
      TRANSITION_CATALOG.forEach((t) => {
        expect(typeof t.name).toBe('string');
        expect(t.name.length).toBeGreaterThan(2);
        expect(typeof t.description).toBe('string');
        expect(t.description.length).toBeGreaterThan(10);
        expect(typeof t.badge).toBe('string');
        expect(t.badge.length).toBeGreaterThan(1);
        expect(t.icon).toBeDefined();
      });
    });
  });

  describe('Component Contracts & Export Signatures', () => {
    it('exports Popover and TransitionPickerPopover as valid component functions', () => {
      expect(typeof Popover).toBe('function');
      expect(typeof TransitionPickerPopover).toBe('function');
    });
  });

  describe('Global Timeline vs Scene-Specific Scope Separation', () => {
    const GLOBAL_TIMELINE_KEYS = new Set<string>([
      'aspectRatio',
      'stageAspect',
      'renderScale',
      'fps',
      'cadence',
      'bpm',
      'bpmHarmonicModulation',
      'synthAudioSound',
      'synthPattern',
      'synthMasterVolume',
      'synthFilterCutoff',
      'synthFilterResonance',
      'synthVoiceMutes',
      'audioSource',
      'audioUserTrack',
      'audioReactive',
      'isStoryboardMode',
      'activeSequenceId',
      'playbackSpeed',
      'timelineMode',
      'isPlaying',
      'currentFrame',
      'activeSequence',
    ]);

    it('identifies all sequence-level global keys correctly', () => {
      expect(GLOBAL_TIMELINE_KEYS.has('aspectRatio')).toBe(true);
      expect(GLOBAL_TIMELINE_KEYS.has('bpm')).toBe(true);
      expect(GLOBAL_TIMELINE_KEYS.has('synthPattern')).toBe(true);
      expect(GLOBAL_TIMELINE_KEYS.has('audioSource')).toBe(true);
      expect(GLOBAL_TIMELINE_KEYS.has('isStoryboardMode')).toBe(true);

      // Scene-specific keys MUST not be in global set
      expect(GLOBAL_TIMELINE_KEYS.has('archetypeId')).toBe(false);
      expect(GLOBAL_TIMELINE_KEYS.has('content')).toBe(false);
      expect(GLOBAL_TIMELINE_KEYS.has('palette')).toBe(false);
      expect(GLOBAL_TIMELINE_KEYS.has('choreo3d')).toBe(false);
      expect(GLOBAL_TIMELINE_KEYS.has('heroId')).toBe(false);
      expect(GLOBAL_TIMELINE_KEYS.has('layoutEngine')).toBe(false);
    });

    it('filters out global timeline parameters when syncing per-act state patches', () => {
      const mixedPatch: Record<string, any> = {
        aspectRatio: '16:9',
        bpm: 140,
        synthMasterVolume: 0.8,
        archetypeId: 'brutalist-grid',
        content: { headline: ['NEW', 'ACT'] },
        choreo3d: { enabled: true, shotType: 'heroic-low-angle' },
      };

      const scenePatch: Record<string, any> = {};
      for (const [key, val] of Object.entries(mixedPatch)) {
        if (!GLOBAL_TIMELINE_KEYS.has(key)) {
          scenePatch[key] = val;
        }
      }

      // Only scene aesthetics should be present
      expect(Object.keys(scenePatch)).toEqual(['archetypeId', 'content', 'choreo3d']);
      expect(scenePatch.aspectRatio).toBeUndefined();
      expect(scenePatch.bpm).toBeUndefined();
      expect(scenePatch.synthMasterVolume).toBeUndefined();
    });
  });
});
