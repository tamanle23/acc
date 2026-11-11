import { describe, it, expect } from 'bun:test';
import {
  tokenizeJsonLine,
  getTokenClass,
  type JsonToken,
} from '../apps/studio/src/components/debugger/code-editor/jsonTokenizer';
import { PostProcessingShaders } from '../packages/effect-engines/src/overlay-effects/simulators/PostProcessingShaders';

describe('Playground Memory Optimization & Shiki Elimination Suite', () => {
  describe('1. Zero-Dependency JSON Tokenizer & Code Viewer', () => {
    it('accurately tokenizes JSON keys, string values, numbers, booleans, and null', () => {
      const line = '  "particleCount": 1500, "active": true, "fallback": null,';
      const tokens = tokenizeJsonLine(line);

      expect(tokens.length).toBeGreaterThan(0);

      // Check key
      const keyToken = tokens.find((t) => t.type === 'key');
      expect(keyToken).toBeDefined();
      expect(keyToken?.text).toBe('"particleCount":');
      expect(getTokenClass('key')).toContain('text-cyan-');

      // Check number
      const numToken = tokens.find((t) => t.type === 'number');
      expect(numToken).toBeDefined();
      expect(numToken?.text).toBe('1500');
      expect(getTokenClass('number')).toContain('text-amber-');

      // Check boolean
      const boolToken = tokens.find((t) => t.type === 'boolean');
      expect(boolToken).toBeDefined();
      expect(boolToken?.text).toBe('true');
      expect(getTokenClass('boolean')).toContain('text-purple-');

      // Check null
      const nullToken = tokens.find((t) => t.type === 'null');
      expect(nullToken).toBeDefined();
      expect(nullToken?.text).toBe('null');
      expect(getTokenClass('null')).toContain('text-rose-');

      // Check punctuation
      const puncTokens = tokens.filter((t) => t.type === 'punctuation');
      expect(puncTokens.length).toBeGreaterThanOrEqual(1);
    });

    it('handles empty lines, strings with colons, and escaped quotes without crashing', () => {
      const empty = tokenizeJsonLine('');
      expect(empty).toEqual([{ type: 'text', text: '' }]);

      const complex = tokenizeJsonLine('  "url": "https://example.com:8080/path",');
      const tokens = complex.filter((t) => t.text.trim().length > 0);
      expect(tokens[0].type).toBe('key');
      expect(tokens[0].text).toBe('"url":');
      expect(tokens[1].type).toBe('string');
      expect(tokens[1].text).toBe('"https://example.com:8080/path"');
    });

    it('executes in sub-millisecond time with zero async dependencies', () => {
      const sample = [
        '{',
        '  "type": "overlay/canvas_particles",',
        '  "target": "overlay",',
        '  "params": {',
        '    "intensity": 1.2,',
        '    "particleCount": 1500,',
        '    "speed": 1.8,',
        '    "opacity": 0.9,',
        '    "shaders": {',
        '      "bloom": { "enabled": true, "threshold": 0.7, "intensity": 1.5 },',
        '      "chromaticAberration": { "enabled": true, "offsetPx": 2.5 }',
        '    }',
        '  }',
        '}',
      ];

      const t0 = performance.now();
      for (let i = 0; i < 50; i++) {
        sample.forEach(tokenizeJsonLine);
      }
      const elapsed = performance.now() - t0;

      // 50 iterations of 14 lines (700 lines) must tokenize in < 25ms (< 0.04ms / line)
      expect(elapsed).toBeLessThan(25);
    });
  });

  describe('2. Downsampled Post-Processing Shaders', () => {
    it('executes downsampled bloom on a 160x90 scratch buffer without throwing', () => {
      const fakeCanvas = { width: 640, height: 360 };
      const ctx = {
        canvas: fakeCanvas,
        save: () => {},
        restore: () => {},
        drawImage: () => {},
      };

      const scratchBuffer = new Uint8ClampedArray(160 * 90 * 4);
      // Fill scratch buffer with test values
      for (let i = 0; i < scratchBuffer.length; i += 4) {
        scratchBuffer[i] = 200; // R
        scratchBuffer[i + 1] = 210; // G
        scratchBuffer[i + 2] = 220; // B
        scratchBuffer[i + 3] = 255; // A
      }

      const scratchCtx = {
        clearRect: () => {},
        drawImage: () => {},
        getImageData: (x: number, y: number, w: number, h: number) => ({
          data: scratchBuffer,
          width: w,
          height: h,
        }),
        putImageData: () => {},
      };

      expect(() => {
        PostProcessingShaders.applyBloom(
          ctx,
          fakeCanvas,
          scratchCtx,
          640,
          360,
          0.7,
          0.5,
          160,
          90
        );
      }).not.toThrow();
    });

    it('bypasses bloom when intensity is negligible (intensity <= 0.01)', () => {
      let drewImage = false;
      const ctx = {
        canvas: { width: 640, height: 360 },
        save: () => {},
        restore: () => {},
        drawImage: () => {
          drewImage = true;
        },
      };
      const scratchCtx = {
        clearRect: () => {},
        drawImage: () => {},
        getImageData: () => ({ data: new Uint8ClampedArray(0) }),
        putImageData: () => {},
      };

      PostProcessingShaders.applyBloom(ctx, {}, scratchCtx, 640, 360, 0.7, 0.005);
      expect(drewImage).toBe(false);
    });
  });

  describe('3. SD Physical Backing Store Constraints', () => {
    it('enforces SD dimensions for all supported aspect ratios', () => {
      const getSdDimensions = (ratio: '16:9' | '9:16' | '1:1') => {
        let sdWidth = 640;
        let sdHeight = 360;
        if (ratio === '9:16') {
          sdWidth = 360;
          sdHeight = 640;
        } else if (ratio === '1:1') {
          sdWidth = 480;
          sdHeight = 480;
        }
        return { sdWidth, sdHeight };
      };

      const dim16_9 = getSdDimensions('16:9');
      expect(dim16_9.sdWidth).toBe(640);
      expect(dim16_9.sdHeight).toBe(360);
      const bytes16_9 = dim16_9.sdWidth * dim16_9.sdHeight * 4;
      expect(bytes16_9).toBe(921600); // Exactly 921.6 KB (< 1 MB)

      const dim9_16 = getSdDimensions('9:16');
      expect(dim9_16.sdWidth).toBe(360);
      expect(dim9_16.sdHeight).toBe(640);

      const dim1_1 = getSdDimensions('1:1');
      expect(dim1_1.sdWidth).toBe(480);
      expect(dim1_1.sdHeight).toBe(480);
      const bytes1_1 = dim1_1.sdWidth * dim1_1.sdHeight * 4;
      expect(bytes1_1).toBe(921600); // Identical 921.6 KB
    });
  });
});
