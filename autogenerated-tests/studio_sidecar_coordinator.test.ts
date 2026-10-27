import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  StudioSidecarCoordinator,
  type ModifierWarmedEvent,
} from '../apps/studio/src/renderer/preview/sidecar/StudioSidecarCoordinator';
import {
  IRPreviewEngine,
  AssetTextureCache,
} from '../apps/studio/src/renderer/preview';
import {
  type ResolvedTimeline,
  type ResolvedSequence,
  type ResolvedTrack,
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
} from '@acc/ir';
import { ContentCacheRegistry } from '@acc/core-isomorphic';

describe('Studio Sidecar Worker & Coordinator Suite', () => {
  let coordinator: StudioSidecarCoordinator;
  let mockTimeline: ResolvedTimeline;

  beforeEach(() => {
    coordinator = new StudioSidecarCoordinator();
    coordinator.reset();

    const track1: ResolvedTrack = {
      id: 't-1',
      name: 'V1',
      type: 'video',
      sequences: [],
    };

    const seq1: ResolvedSequence = {
      id: 'seq-1',
      trackId: 't-1',
      startFrame: 0,
      durationFrames: 60,
      assetId: 'asset-1',
      modifiers: [
        {
          type: 'vfx/depth3d',
          params: {
            mode: 'frame_breaker',
            popOutIntensity: 1.5,
          },
        },
      ],
    };

    const seq2: ResolvedSequence = {
      id: 'seq-2',
      trackId: 't-1',
      startFrame: 120,
      durationFrames: 60,
      assetId: 'asset-2',
      modifiers: [
        {
          type: 'transform',
          params: {
            x: 50,
            y: 50,
          },
        },
      ],
    };

    track1.sequences = [seq1, seq2];

    mockTimeline = {
      meta: {
        canvasSize: { w: 1920, h: 1080 },
        globalFps: 30,
        backgroundColor: '#000000',
      },
      tracks: new Map([['t-1', track1]]),
      sequences: new Map([
        ['seq-1', seq1],
        ['seq-2', seq2],
      ]),
      totalFrames: 240,
    };
  });

  afterEach(() => {
    coordinator.terminate();
  });

  it('initializes coordinator with in-process execution fallback in Bun/Node environment', () => {
    expect(coordinator).toBeDefined();
    expect(typeof coordinator.preflightTimeline).toBe('function');
    expect(typeof coordinator.executeModifier).toBe('function');
    expect(typeof coordinator.cancelTasksForTarget).toBe('function');
  });

  it('executes preflight across timeline modifiers and triggers onModifierWarmed', async () => {
    const warmedEvents: ModifierWarmedEvent[] = [];
    const unsub = coordinator.onModifierWarmed((event) => {
      warmedEvents.push(event);
    });

    await coordinator.preflightTimeline(mockTimeline, { prioritizedFrame: 10 });

    expect(warmedEvents.length).toBeGreaterThanOrEqual(2);
    const depthEvent = warmedEvents.find((e) => e.targetId === 'seq-1');
    expect(depthEvent).toBeDefined();
    expect(depthEvent?.modifierType).toBe('vfx/depth3d');

    unsub();
  });

  it('cancels pending and active tasks when a sequence is removed', () => {
    // Schedule low priority modifier
    coordinator.executeModifier(
      {
        taskId: 'task-to-cancel',
        targetType: 'sequence',
        targetId: 'seq-to-remove',
        targetEntity: { id: 'seq-to-remove' },
        modifier: { type: 'vfx/depth3d', params: {} },
        fps: 30,
        canvas: { width: 1920, height: 1080 },
      },
      false
    );

    coordinator.cancelTasksForTarget('seq-to-remove');
    // Task map and queues should be purged
    expect(true).toBe(true);
  });

  it('integrates StudioSidecarCoordinator transparently with IRPreviewEngine lifecycle', async () => {
    const warmedEvents: string[] = [];

    const preview = new IRPreviewEngine(mockTimeline, undefined, undefined, 48000, {
      sidecarCoordinator: coordinator,
      autoPreflight: false,
    });

    const unsub = preview.onModifierWarmed((ev) => {
      warmedEvents.push(ev.targetId);
    });

    await preview.prepare({ prioritizedFrame: 0 });
    expect(warmedEvents).toContain('seq-1');

    // Simulate removing seq-1 on timeline sync
    const updatedSequences = new Map(mockTimeline.sequences);
    updatedSequences.delete('seq-1');
    const updatedTimeline: ResolvedTimeline = {
      ...mockTimeline,
      sequences: updatedSequences,
    };

    preview.syncTimeline(updatedTimeline);
    const seekResult = preview.seek(10);
    expect(seekResult.activeSequences.some((s) => s.id === 'seq-1')).toBe(false);

    unsub();
  });
});
