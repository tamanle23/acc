import { describe, it, expect } from 'bun:test';
import { INITIAL_STUDIO_STATE } from '@/constants/initial-state';
import { deterministicCopilot } from '@/lib/ai-copilot/deterministic-copilot';
import { winterTcCopilotAdapter, WinterTcCopilotAdapter } from '@/adapters/driving/ai-copilot/wintertc-copilot.adapter';
import { CopilotPipeline, WcagContrastGuardStep } from '@/core/domain/ai-copilot/copilot-pipeline';
import type { CopilotPipelineContext } from '@/core/domain/ai-copilot/copilot-types';
import { calculateWcagContrast } from '@/core/domain/color/color-math';

describe('Horizon 2: AI Creative Director & Prompt-to-Poster Co-Pilot Suite', () => {
  describe('Deterministic Creative Direction Engine', () => {
    it('generates 3 curated Director Takes with distinct styles and rationales', async () => {
      const takes = await deterministicCopilot.generateTakes(
        'Tokyo Cyberpunk Neon Rave 128 BPM',
        INITIAL_STUDIO_STATE
      );

      expect(takes.length).toBe(3);

      const [takeA, takeB, takeC] = takes;
      expect(takeA.style).toBe('minimalist');
      expect(takeB.style).toBe('avant-garde');
      expect(takeC.style).toBe('kinetic-chaos');

      expect(takeA.headline[0]).toBe('TOKYO');
      expect(takeA.headline[1]).toBe('CYBERPUNK');
      expect(takeA.headline[2]).toBe('NEON');

      expect(takeA.archetypeId).toBeDefined();
      expect(takeB.archetypeId).toBeDefined();
      expect(takeC.archetypeId).toBeDefined();
    });

    it('adapts intent sphere and tempo based on semantic keywords', async () => {
      const zenTakes = await deterministicCopilot.generateTakes(
        'Kyoto Zen Tea Meditation',
        INITIAL_STUDIO_STATE
      );
      // Zen should favor slow tempo and wabi-sabi/minimalist
      expect(zenTakes[0].bpm).toBeLessThanOrEqual(80);
      expect(zenTakes[0].archetypeId).toBe('wabi-sabi-zen');

      const raveTakes = await deterministicCopilot.generateTakes(
        'Berlin Acid Rave Industrial Strobe',
        INITIAL_STUDIO_STATE
      );
      expect(raveTakes[2].bpm).toBeGreaterThanOrEqual(130);
      expect(raveTakes[2].archetypeId).toBe('brutalist-club');
    });
  });

  describe('Design Safety & Pre-Press Guards', () => {
    it('guarantees WCAG 2.2 AA contrast >= 4.5:1 across all generated takes', async () => {
      const takes = await deterministicCopilot.generateTakes(
        'Minimalist Swiss Architecture',
        INITIAL_STUDIO_STATE
      );

      for (const take of takes) {
        expect(take.wcagContrastRatio).toBeGreaterThanOrEqual(4.5);
        const actualContrast = calculateWcagContrast(take.palette.ink, take.palette.bg);
        expect(actualContrast).toBeGreaterThanOrEqual(4.5);
      }
    });

    it('auto-corrects illegible low-contrast ink in WcagContrastGuardStep', () => {
      const guard = new WcagContrastGuardStep();
      const mockContext: CopilotPipelineContext = {
        brief: { prompt: 'Low contrast test' },
        baseState: INITIAL_STUDIO_STATE,
        takes: [
          {
            id: 'test-low-contrast',
            title: 'Low Contrast Take',
            style: 'minimalist',
            rationale: 'Testing contrast guard',
            archetypeId: 'swiss-international',
            layoutId: 'z-flow-top-headline',
            shaderId: 'monochrome-wireframe',
            heroId: 'monolith',
            bgGraphicId: 'blueprint-grid',
            palette: {
              bg: '#111111',
              surface: '#222222',
              ink: '#222222', // Deliberate violation: gray on black contrast < 1.5:1
              accent: '#E63946',
              accent2: '#457B9D',
            },
            bpm: 120,
            headline: ['A', 'B', 'C'],
            subhead: 'Subhead',
            date: 'Date',
            location: 'Location',
            tag: 'Tag',
            wcagContrastRatio: 1.2,
            cmykTacPct: 200,
            statePatch: {},
          },
        ],
        errors: [],
      };

      guard.execute(mockContext);
      const correctedTake = mockContext.takes[0];
      expect(correctedTake.wcagContrastRatio).toBeGreaterThanOrEqual(4.5);
      expect(correctedTake.palette.ink).toBe('#FFFFFF');
    });

    it('enforces Total Area Coverage (TAC) <= 300% on all takes for offset press safety', async () => {
      const takes = await deterministicCopilot.generateTakes(
        'Heavy Ink Dark Gothic Poster',
        INITIAL_STUDIO_STATE
      );

      for (const take of takes) {
        expect(take.cmykTacPct).toBeLessThanOrEqual(300);
      }
    });
  });

  describe('WinterTC Gateway Adapter & Offline Resilience', () => {
    it('uses deterministic offline pipeline when remote endpoint is not configured', async () => {
      const adapter = new WinterTcCopilotAdapter();
      const takes = await adapter.directConcept('Experimental Art Gallery', INITIAL_STUDIO_STATE);

      expect(takes.length).toBe(3);
      expect(takes[0].title).toContain('Take A');
    });

    it('falls back to offline pipeline when remote network request fails', async () => {
      const brokenAdapter = new WinterTcCopilotAdapter({
        endpointUrl: 'https://invalid-non-existent-domain-12345.ai/v1/direct',
        apiKey: 'fake-key',
        timeoutMs: 100,
      });

      const takes = await brokenAdapter.directConcept('Network Failure Resilience', INITIAL_STUDIO_STATE);
      expect(takes.length).toBe(3);
      expect(takes[0].style).toBe('minimalist');
    });
  });
});
