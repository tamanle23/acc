import { describe, it, expect, beforeEach } from 'bun:test';
import {
  StagingDragManager,
  type StagingDragItem,
  type StagingDropTarget,
} from '../apps/studio/src/lib/staging/StagingDragManager';

describe('StagingDragManager Unit Tests', () => {
  let manager: StagingDragManager;

  beforeEach(() => {
    manager = StagingDragManager.getInstance();
    manager.cancelDrag();
    manager.setDropHandler(null);
  });

  it('initializes with idle state', () => {
    const state = manager.getState();
    expect(state.isDragging).toBe(false);
    expect(state.item).toBeNull();
    expect(state.hoveredTarget).toBeNull();
  });

  it('starts drag session and notifies subscribers', () => {
    let notifiedState = manager.getState();
    const unsubscribe = manager.subscribe((s) => {
      notifiedState = s;
    });

    const mockItem: StagingDragItem = {
      type: 'asset',
      assetId: 'video_sample_1',
      asset: { type: 'video', durationSec: 3.5 },
    };

    manager.startDrag(mockItem, { x: 100, y: 150 });

    expect(notifiedState.isDragging).toBe(true);
    expect(notifiedState.item?.assetId).toBe('video_sample_1');
    expect(notifiedState.pointer.x).toBe(100);
    expect(notifiedState.pointer.y).toBe(150);

    unsubscribe();
  });

  it('dispatches dropped item to registered drop handler on endDrag', () => {
    let droppedItem: StagingDragItem | null = null;
    let droppedTarget: StagingDropTarget | null = null;

    manager.setDropHandler((item, target) => {
      droppedItem = item;
      droppedTarget = target;
    });

    const mockItem: StagingDragItem = {
      type: 'preset',
      preset: {
        id: 'title_kinetic',
        name: 'Kinetic Title',
        category: 'text',
        badge: 'Text',
        targetTrackId: 'track-v1',
        targetTrackType: 'video',
        createSequence: () => ({ id: 'seq_1' } as any),
      } as any,
    };

    manager.startDrag(mockItem, { x: 50, y: 50 });

    // Simulate drag end with no target
    const resultNoTarget = manager.endDrag();
    expect(resultNoTarget?.item.type).toBe('preset');
    expect(droppedItem).toBeNull();

    // Start another drag and simulate target
    manager.startDrag(mockItem, { x: 200, y: 300 });
    // Directly mutate internal state for test verification of drop handler dispatch
    (manager as any).state.hoveredTarget = { type: 'viewport' };

    const result = manager.endDrag();
    expect(result?.target?.type).toBe('viewport');
    expect(droppedItem).not.toBeNull();
    expect((droppedItem as any)?.type).toBe('preset');
    expect(droppedTarget?.type).toBe('viewport');
    expect(manager.getState().isDragging).toBe(false);
  });

  it('cancels drag cleanly without firing drop handler', () => {
    let fired = false;
    manager.setDropHandler(() => {
      fired = true;
    });

    manager.startDrag({ type: 'asset', assetId: 'test' }, { x: 10, y: 10 });
    expect(manager.getState().isDragging).toBe(true);

    manager.cancelDrag();
    expect(manager.getState().isDragging).toBe(false);
    expect(manager.getState().item).toBeNull();
    expect(fired).toBe(false);
  });
});
