import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { exportSnapshotPng, exportPosterSvg, downloadBlob } from '../src/lib/export-video';
import { exportPrintMasterDeck } from '../src/lib/print-master';
import { INITIAL_STUDIO_STATE } from '../src/constants/initial-state';

describe('Export Pipeline Single-Download Ownership & Auto-Download Control', () => {
  let originalDocument: any;
  let clickedElements: any[] = [];
  let appendedElements: any[] = [];

  beforeEach(() => {
    originalDocument = (globalThis as any).document;
    clickedElements = [];
    appendedElements = [];

    const mockContext2D = new Proxy(
      {
        canvas: null as any,
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        font: '10px sans-serif',
        textAlign: 'start',
        textBaseline: 'alphabetic',
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        measureText: () => ({
          width: 100,
          actualBoundingBoxAscent: 10,
          actualBoundingBoxDescent: 2,
        }),
        getImageData: () => ({
          data: new Uint8ClampedArray(400),
          width: 10,
          height: 10,
        }),
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
      },
      {
        get(target, prop) {
          if (prop in target) {
            return (target as any)[prop];
          }
          return () => {};
        },
        set(target, prop, value) {
          (target as any)[prop] = value;
          return true;
        },
      }
    );

    // Mock document with element creation and DOM manipulation
    (globalThis as any).document = {
      createElement: (tagName: string) => {
        const tag = tagName.toLowerCase();
        if (tag === 'a') {
          const anchor: any = {
            tagName: 'A',
            style: {},
            href: '',
            download: '',
            click: () => {
              clickedElements.push(anchor);
            },
            parentNode: null,
          };
          return anchor;
        }
        if (tag === 'canvas') {
          const canvasObj = {
            tagName: 'CANVAS',
            width: 1080,
            height: 1920,
            getContext: (type: string) => {
              if (type === '2d') {
                return mockContext2D;
              }
              return null;
            },
            toBlob: (cb: (blob: Blob | null) => void) => {
              cb(new Blob(['fake png data'], { type: 'image/png' }));
            },
            toDataURL: () => 'data:image/png;base64,fake',
          };
          mockContext2D.canvas = canvasObj;
          return canvasObj;
        }
        return {
          tagName: tagName.toUpperCase(),
          style: {},
          appendChild: () => {},
          removeChild: () => {},
        };
      },
      body: {
        appendChild: (el: any) => {
          appendedElements.push(el);
          el.parentNode = (globalThis as any).document.body;
        },
        removeChild: (el: any) => {
          el.parentNode = null;
        },
      },
      fonts: {
        ready: Promise.resolve(),
      },
    };

    if (!globalThis.URL) {
      (globalThis as any).URL = {};
    }
    (globalThis.URL as any).createObjectURL = (_blob: any) => 'blob:mock-url-' + Math.random();
    (globalThis.URL as any).revokeObjectURL = () => {};
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
  });

  it('exportSnapshotPng respects autoDownload: false and does not trigger document download anchor', async () => {
    const blob = await exportSnapshotPng({
      state: INITIAL_STUDIO_STATE,
      scale: 1,
      frame: 0,
      autoDownload: false,
    });

    expect(blob).toBeDefined();
    expect(blob instanceof Blob).toBe(true);
    expect(clickedElements.length).toBe(0); // autoDownload: false must NOT click any anchor
  });

  it('exportSnapshotPng triggers download when autoDownload: true is explicitly requested', async () => {
    const blob = await exportSnapshotPng({
      state: INITIAL_STUDIO_STATE,
      scale: 1,
      frame: 0,
      autoDownload: true,
    });

    expect(blob).toBeDefined();
    expect(clickedElements.length).toBe(1); // exactly one download triggered
    expect(clickedElements[0].download).toContain('.png');
  });

  it('exportPosterSvg returns Blob and does not trigger download when autoDownload is false', async () => {
    const blob = await exportPosterSvg(INITIAL_STUDIO_STATE, undefined, false);
    expect(blob).toBeDefined();
    expect(blob instanceof Blob).toBe(true);
    expect(blob.type).toContain('image/svg+xml');
    expect(clickedElements.length).toBe(0);
  });

  it('exportPrintMasterDeck does not trigger download when autoDownload is false', async () => {
    const blob = await exportPrintMasterDeck({
      state: INITIAL_STUDIO_STATE,
      presetId: 'iso-a1',
      includeMarks: false,
      bleedMm: 0,
      autoDownload: false,
    });

    expect(blob).toBeDefined();
    expect(blob instanceof Blob).toBe(true);
    expect(clickedElements.length).toBe(0);
  });

  it('downloadBlob executes exactly one single anchor click with correct attributes', () => {
    const testBlob = new Blob(['test data'], { type: 'text/plain' });
    downloadBlob(testBlob, 'single-export-file.mp4');

    expect(clickedElements.length).toBe(1);
    expect(clickedElements[0].download).toBe('single-export-file.mp4');
    expect(clickedElements[0].href).toContain('blob:mock-url');
    expect(appendedElements.length).toBe(1);
  });
});
