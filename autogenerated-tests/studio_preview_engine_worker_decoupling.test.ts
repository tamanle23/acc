import { describe, it, expect, beforeEach } from 'bun:test';
import { IRPreviewEngine } from '../apps/studio/src/renderer/IRPreviewEngine';
import { PreviewWorkerCoordinator } from '../apps/studio/src/renderer/PreviewWorkerCoordinator';
import type { ResolvedTimeline, ResolvedTrack, ResolvedSequence } from '@acc/ir';

describe('Studio IRPreviewEngine & Worker Decoupling Suite', () => {
  let mockTimeline: ResolvedTimeline;

  beforeEach(() => {
    const track1: ResolvedTrack = {
      id: 'track-v1',
      name: 'V1',
      type: 'video',
      sequences: [],
    };

    const seq1: ResolvedSequence = {
      id: 'seq-1',
      trackId: 'track-v1',
      startFrame: 0,
      durationFrames: 90,
      assetId: 'asset-1',
      modifiers: [],
    };

    track1.sequences.push(seq1);

    mockTimeline = {
      meta: {
        globalFps: 30,
        canvasSize: { w: 1920, h: 1080 },
      } as any,
      tracks: new Map([['track-v1', track1]]),
      sequences: new Map([['seq-1', seq1]]),
      totalFrames: 90,
      durationFrames: 90,
      durationSeconds: 3,
    };
  });

  it('instantiates IRPreviewEngine purely with zero side-effects and null sidecarCoordinator by default', () => {
    const engine = new IRPreviewEngine(mockTimeline);

    // Private properties reflection check
    expect((engine as any).sidecarCoordinator).toBeNull();
    expect((engine as any).autoPreflight).toBe(false);
  });

  it('accepts explicit sidecarCoordinator injection when configured by composition root', () => {
    const coordinator = new PreviewWorkerCoordinator();
    const engine = new IRPreviewEngine(
      mockTimeline,
      undefined,
      undefined,
      48000,
      {
        sidecarCoordinator: coordinator,
        autoPreflight: true,
      }
    );

    expect((engine as any).sidecarCoordinator).toBe(coordinator);
    expect((engine as any).autoPreflight).toBe(true);
  });

  it('strictly honors explicit null sidecarCoordinator even when autoPreflight is requested', () => {
    const engine = new IRPreviewEngine(
      mockTimeline,
      undefined,
      undefined,
      48000,
      {
        sidecarCoordinator: null,
        autoPreflight: true,
      }
    );

    expect((engine as any).sidecarCoordinator).toBeNull();
  });

  it('prevents PreviewWorkerCoordinator.getInstance() from executing in Web Worker realms', () => {
    // Simulate Web Worker environment by defining importScripts on self
    const originalSelf = globalThis.self;
    const originalImportScripts = (globalThis as any).importScripts;

    try {
      (globalThis as any).importScripts = () => {};

      expect(() => {
        PreviewWorkerCoordinator.getInstance();
      }).toThrow(/Must not be instantiated in a Web Worker realm/);
    } finally {
      if (originalImportScripts === undefined) {
        delete (globalThis as any).importScripts;
      } else {
        (globalThis as any).importScripts = originalImportScripts;
      }
    }
  });

  it('syncTimeline operates without errors or unexpected side-effects when sidecarCoordinator is null', () => {
    const engine = new IRPreviewEngine(mockTimeline);
    expect(() => {
      engine.syncTimeline(mockTimeline);
    }).not.toThrow();
  });

  it('prepare and onModifierWarmed gracefully no-op when sidecarCoordinator is null', async () => {
    const engine = new IRPreviewEngine(mockTimeline);

    await expect(engine.prepare()).resolves.toBeUndefined();

    let warmedTriggered = false;
    const unsub = engine.onModifierWarmed(() => {
      warmedTriggered = true;
    });

    expect(typeof unsub).toBe('function');
    unsub();
    expect(warmedTriggered).toBe(false);
  });
});
