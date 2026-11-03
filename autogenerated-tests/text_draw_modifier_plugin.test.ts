import { describe, it, expect } from 'bun:test';
import {
  registerCoreModifierPlugins,
  VideoIRSchemaValidator,
  TextModifierPlugin,
} from '@acc/ir';
import { TYPOGRAPHY_PRESETS } from '../apps/studio/src/lib/library/typographyBank';
import { CanvasHitTester } from '../apps/studio/src/lib/hit-test/CanvasHitTester';

describe('TextModifierPlugin & Standalone Text Overlay Tests', () => {
  it('registers text/draw and text/overlay in ModifierPluginRegistry', () => {
    const registry = registerCoreModifierPlugins();
    const plugin = registry.get('text/draw');
    const aliasPlugin = registry.get('text/overlay');

    expect(plugin).toBeDefined();
    expect(aliasPlugin).toBeDefined();
    expect(plugin?.targetScope).toBe('standalone');
    expect(plugin?.targetPhase).toBe(2);
    expect(plugin?.allowedSequenceTypes).toContain('overlay');
    expect(plugin?.supportedTrackTypes).toContain('video');
  });

  describe('Schema Validation', () => {
    it('accepts valid text/draw parameters', () => {
      const validParams = {
        text: 'HELLO WORLD',
        fontFamily: 'Cinzel, serif',
        fontSize: 64,
        fontWeight: 800,
        textColor: '#FFDF00',
        strokeColor: '#B8860B',
        strokeWidth: 2,
        glowColor: 'rgba(255, 215, 0, 0.5)',
        glowBlur: 16,
        letterSpacing: 4,
      };

      const result = VideoIRSchemaValidator.validateModifierParams('text/draw', validParams);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates alias text/overlay identically', () => {
      const validParams = {
        text: 'OVERLAY TEXT',
        fontSize: 32,
      };

      const result = VideoIRSchemaValidator.validateModifierParams('text/overlay', validParams);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects parameters missing required text field', () => {
      const invalidParams = {
        fontFamily: 'Inter',
        fontSize: 48,
      };

      const result = VideoIRSchemaValidator.validateModifierParams('text/draw', invalidParams as any);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('text must be a non-empty string');
    });

    it('rejects negative or invalid fontSize and strokeWidth', () => {
      const resultNegativeFont = VideoIRSchemaValidator.validateModifierParams('text/draw', {
        text: 'Test',
        fontSize: -10,
      });
      expect(resultNegativeFont.valid).toBe(false);

      const resultNegativeStroke = VideoIRSchemaValidator.validateModifierParams('text/draw', {
        text: 'Test',
        strokeWidth: -5,
      });
      expect(resultNegativeStroke.valid).toBe(false);
    });
  });

  describe('Typography Bank 16-Preset Migration', () => {
    it('ensures all 16 presets produce clean overlay sequences with text/draw and transform modifiers', () => {
      expect(TYPOGRAPHY_PRESETS.length).toBe(16);

      for (const preset of TYPOGRAPHY_PRESETS) {
        expect(preset.targetTrackType).toBe('video');
        expect(preset.targetTrackId).toBe('track-text-overlay');

        const seq = preset.createSequence({
          startFrame: 0,
          durationFrames: 90,
          normX: 0.5,
          normY: 0.5,
        });

        // Must be sequence type overlay
        expect(seq.type).toBe('overlay');

        // Must NOT contain cues array (reserved for timed_text subtitles)
        expect(seq.cues).toBeUndefined();

        // Must contain transform modifier
        const transformMod = seq.modifiers?.find((m) => m.type === 'transform');
        expect(transformMod).toBeDefined();

        // Must contain text/draw modifier
        const textDrawMod = seq.modifiers?.find((m) => m.type === 'text/draw');
        expect(textDrawMod).toBeDefined();

        const params = (textDrawMod?.params || {}) as Record<string, unknown>;
        expect(typeof params.text).toBe('string');
        expect((params.text as string).length).toBeGreaterThan(0);

        // Modifier params must be valid according to VideoIRSchemaValidator
        const validation = VideoIRSchemaValidator.validateModifierParams('text/draw', params);
        expect(validation.valid).toBe(true);
      }
    });
  });

  describe('Canvas Hit Tester Resolution', () => {
    it('resolves text/draw sequence to sequenceType text with accurate label and bounding box', () => {
      const preset = TYPOGRAPHY_PRESETS[0];
      const seq = preset.createSequence({
        startFrame: 0,
        durationFrames: 90,
        normX: 0.5,
        normY: 0.45,
      });

      const region = CanvasHitTester.resolveSequenceRegion(seq as any, 1, 'track-text-overlay');
      expect(region).not.toBeNull();
      expect(region?.sequenceType).toBe('text');
      expect(region?.normX).toBe(0.5);
      expect(region?.normY).toBe(0.45);
      expect(region?.label).toContain('CHRONICLES');
      expect(region?.normWidth).toBeGreaterThan(0);
      expect(region?.normHeight).toBeGreaterThan(0);
    });
  });

  describe('Canvas 2D Clip-Space Rendering', () => {
    it('executes renderClipSpace without throwing on mock 2D context with 1080p reference scaling', () => {
      const plugin = new TextModifierPlugin();

      // Create a comprehensive mock CanvasRenderingContext2D
      const calls: string[] = [];
      const mockCtx = {
        save: () => calls.push('save'),
        restore: () => calls.push('restore'),
        translate: (x: number, y: number) => calls.push(`translate(${x},${y})`),
        rotate: (r: number) => calls.push(`rotate(${r})`),
        beginPath: () => calls.push('beginPath'),
        moveTo: (x: number, y: number) => calls.push(`moveTo(${x},${y})`),
        lineTo: (x: number, y: number) => calls.push(`lineTo(${x},${y})`),
        arcTo: () => calls.push('arcTo'),
        closePath: () => calls.push('closePath'),
        rect: (x: number, y: number, w: number, h: number) => calls.push(`rect(${x},${y},${w},${h})`),
        fill: () => calls.push('fill'),
        stroke: () => calls.push('stroke'),
        fillText: (text: string, x: number, y: number) => calls.push(`fillText(${text},${x},${y})`),
        strokeText: (text: string, x: number, y: number) => calls.push(`strokeText(${text},${x},${y})`),
        measureText: (text: string) => ({
          width: text.length * 20,
          actualBoundingBoxAscent: 20,
          actualBoundingBoxDescent: 5,
        }),
        createLinearGradient: () => ({
          addColorStop: () => {},
        }),
      } as unknown as CanvasRenderingContext2D;

      const mockCanvas = {
        width: 1920,
        height: 1080,
        getContext: () => mockCtx,
      } as unknown as HTMLCanvasElement;

      const clipContext = {
        canvas: mockCanvas,
        ctx: mockCtx,
        frame: 0,
        localFrame: 0,
        width: 1920,
        height: 1080,
        sequence: {
          id: 'test-seq',
          type: 'overlay',
          time: { start: 0, duration: 90 },
          modifiers: [],
        } as any,
      };

      // Execute rendering
      plugin.renderClipSpace(
        clipContext,
        {
          text: 'CINEMATIC\nSECOND LINE',
          fontSize: 60,
          fontFamily: 'Inter',
          textColor: '#FFFFFF',
          strokeColor: '#000000',
          strokeWidth: 2,
          glowColor: '#00F0FF',
          glowBlur: 10,
          backgroundColor: '#000000',
          paddingX: 20,
          paddingY: 10,
          borderRadius: 8,
        }
      );

      // Verify that canvas rendering operations were performed
      expect(calls).toContain('save');
      expect(calls).toContain('restore');
      expect(calls.some((c) => c.startsWith('fillText'))).toBe(true);
      expect(calls.some((c) => c.startsWith('strokeText'))).toBe(true);
    });
  });
});
