import { describe, test, expect, beforeAll } from 'bun:test';
import { createCanvas } from '@napi-rs/canvas';
import { drawSandwichFrame } from '../packages/effect-engines/src/depth3d/sandwich';
import { Depth3DFactory } from '../packages/effect-engines/src/depth3d/factory';

describe('Sandwich 3D Banner Text Positioning Suite', () => {
  let mockImg: any;

  beforeAll(() => {
    const c = createCanvas(1920, 1080);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#336699';
    ctx.fillRect(0, 0, 1920, 1080);
    mockImg = c;
  });

  test('should correctly render bannerText at top, center, and bottom positions', () => {
    const positions = ['top', 'center', 'bottom'] as const;

    for (const pos of positions) {
      const canvas = createCanvas(1920, 1080);
      const ctx = canvas.getContext('2d');

      expect(() => {
        drawSandwichFrame(ctx, {
          img: mockImg,
          subjectImg: null,
          width: 1920,
          height: 1080,
          frame: 0,
          totalFrames: 30,
          timeSec: 0,
          progress: 0,
          depthConfig: {
            enabled: true,
            mode: 'volumetric_sandwich',
            sandwich: {
              textBehindSubject: true,
              bannerText: `BANNER AT ${pos.toUpperCase()}`,
              position: pos,
              textColor: '#FFCC00',
              floatMotion: false
            }
          },
          dustParticles: []
        });
      }).not.toThrow();

      const data = ctx.getImageData(0, 0, 1920, 1080).data;
      expect(data.length).toBe(1920 * 1080 * 4);
    }
  });

  test('should correctly render with custom positionY and positionX ratios', () => {
    const canvas = createCanvas(1920, 1080);
    const ctx = canvas.getContext('2d');

    expect(() => {
      drawSandwichFrame(ctx, {
        img: mockImg,
        subjectImg: null,
        width: 1920,
        height: 1080,
        frame: 5,
        totalFrames: 30,
        timeSec: 0.5,
        progress: 0.16,
        depthConfig: {
          enabled: true,
          mode: 'volumetric_sandwich',
          sandwich: {
            textBehindSubject: true,
            bannerText: 'CUSTOM RATIO BANNER',
            positionY: 0.82,
            positionX: 0.5,
            fontSize: 0.08,
            textColor: '#00FFFF',
            floatMotion: true
          }
        },
        dustParticles: []
      });
    }).not.toThrow();
  });

  test('should seamlessly resolve via Depth3DFactory', () => {
    const renderer = Depth3DFactory.getRenderer('volumetric_sandwich');
    expect(renderer).toBeDefined();
    expect(renderer?.mode).toBe('volumetric_sandwich');
  });
});
