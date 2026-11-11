import { describe, it, expect } from 'bun:test';
import {
  BRAND_ARCHETYPES,
  ARCHETYPE_META,
  ARCHETYPE_FAMILY_TABS,
  useAdaptiveLod,
  ArchetypeBar,
  ArchetypePopover,
  StudioHeader,
} from '../src/index';

describe('Studio Header & Archetype Bar Adaptive Level of Detail (LOD)', () => {
  describe('Archetype Metadata & Categorization', () => {
    it('covers all 37 brand archetypes in ARCHETYPE_META', () => {
      expect(BRAND_ARCHETYPES.length).toBe(37);
      BRAND_ARCHETYPES.forEach((arch) => {
        const meta = ARCHETYPE_META[arch.id];
        expect(meta).toBeDefined();
        expect(typeof meta.badge).toBe('string');
        expect(meta.badge.length).toBeGreaterThan(0);
        expect(typeof meta.tagColor).toBe('string');
        expect([
          'all',
          'modernism',
          'editorial',
          'classical',
          'cinema',
          'music',
          'activism',
          'nature-zen',
          'architecture',
          'speculative',
          'club-kinetic',
          'festive-seasonal',
        ]).toContain(meta.family);
      });
    });

    it('defines 11 first-class aesthetic family tabs plus all with distinct keys', () => {
      expect(ARCHETYPE_FAMILY_TABS.length).toBe(12);
      const tabIds = ARCHETYPE_FAMILY_TABS.map((t) => t.id);
      expect(tabIds).toEqual([
        'all',
        'modernism',
        'editorial',
        'classical',
        'cinema',
        'music',
        'activism',
        'nature-zen',
        'architecture',
        'speculative',
        'club-kinetic',
        'festive-seasonal',
      ]);
    });
  });

  describe('Adaptive LOD Hook Logic & State Contract', () => {
    it('exports useAdaptiveLod hook function', () => {
      expect(typeof useAdaptiveLod).toBe('function');
    });

    it('exports StudioHeader, ArchetypeBar, and ArchetypePopover components', () => {
      expect(typeof StudioHeader).toBe('function');
      expect(typeof ArchetypeBar).toBe('function');
      expect(typeof ArchetypePopover).toBe('function');
    });
  });
});

