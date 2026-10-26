import { useState, useEffect } from 'react';
import type { StagingPreset } from '../library/stagingPresets';
import { isTrackCompatibleWithSequence } from '../timeline/trackCompatibility';

export interface StagingDragItem {
  type: 'preset' | 'asset';
  preset?: StagingPreset;
  asset?: any;
  assetId?: string;
}

export interface StagingDropTarget {
  type: 'viewport' | 'track';
  trackId?: string;
  dropFrame?: number;
}

export interface StagingDragState {
  isDragging: boolean;
  item: StagingDragItem | null;
  pointer: { x: number; y: number };
  hoveredTarget: StagingDropTarget | null;
}

export type StagingDropHandler = (item: StagingDragItem, target: StagingDropTarget) => void;

/**
 * StagingDragManager:
 * Enterprise lightweight drop-zone registry and drag-state coordinator
 * replacing @dnd-kit's DndContext for cross-container staging.
 */
export class StagingDragManager {
  private static instance: StagingDragManager | null = null;
  private state: StagingDragState = {
    isDragging: false,
    item: null,
    pointer: { x: 0, y: 0 },
    hoveredTarget: null,
  };
  private listeners = new Set<(state: StagingDragState) => void>();
  private dropHandler: StagingDropHandler | null = null;

  public static getInstance(): StagingDragManager {
    if (!StagingDragManager.instance) {
      StagingDragManager.instance = new StagingDragManager();
    }
    return StagingDragManager.instance;
  }

  public getState(): StagingDragState {
    return this.state;
  }

  public setDropHandler(handler: StagingDropHandler | null): () => void {
    this.dropHandler = handler;
    return () => {
      if (this.dropHandler === handler) {
        this.dropHandler = null;
      }
    };
  }

  public subscribe(listener: (state: StagingDragState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public startDrag(item: StagingDragItem, pointer: { x: number; y: number }) {
    this.state = {
      isDragging: true,
      item,
      pointer,
      hoveredTarget: null,
    };
    this.emit();
  }

  public updateDrag(
    pointer: { x: number; y: number },
    currentFrame: number = 0
  ) {
    if (!this.state.isDragging) return;

    let hoveredTarget: StagingDropTarget | null = null;
    if (typeof document !== 'undefined') {
      const elements = document.elementsFromPoint(pointer.x, pointer.y);
      for (const el of elements) {
        if (
          el.getAttribute('data-drop-zone') === 'canvas-viewport' ||
          el.id === 'canvas-viewport-drop-zone'
        ) {
          hoveredTarget = { type: 'viewport' };
          break;
        }

        const trackLane = el.closest<HTMLElement>('[data-track-lane-id]');
        if (trackLane) {
          const trackId = trackLane.getAttribute('data-track-lane-id') || '';
          const trackType = trackLane.getAttribute('data-track-type') || 'video';
          const itemType =
            this.state.item?.type === 'preset'
              ? this.state.item.preset?.targetTrackType || 'video'
              : this.state.item?.asset?.type || 'video';

          if (isTrackCompatibleWithSequence(trackType, itemType)) {
            const rect = trackLane.getBoundingClientRect();
            const relX = pointer.x - rect.left;
            const zoomScale = 1.0;
            const pixelsPerFrame = Math.max(1, 4 * zoomScale);
            let dropFrame = currentFrame;
            if (relX > 0) {
              dropFrame = Math.max(0, Math.round(relX / pixelsPerFrame));
            }
            if (Math.abs(dropFrame - currentFrame) <= 4) {
              dropFrame = currentFrame;
            }
            hoveredTarget = { type: 'track', trackId, dropFrame };
          }
          break;
        }
      }
    }

    this.state = {
      ...this.state,
      pointer,
      hoveredTarget,
    };
    this.emit();
  }

  public endDrag(): { item: StagingDragItem; target: StagingDropTarget | null } | null {
    if (!this.state.isDragging || !this.state.item) return null;

    const result = {
      item: this.state.item,
      target: this.state.hoveredTarget,
    };

    if (result.target && this.dropHandler) {
      this.dropHandler(result.item, result.target);
    }

    this.state = {
      isDragging: false,
      item: null,
      pointer: { x: 0, y: 0 },
      hoveredTarget: null,
    };
    this.emit();

    return result;
  }

  public cancelDrag() {
    this.state = {
      isDragging: false,
      item: null,
      pointer: { x: 0, y: 0 },
      hoveredTarget: null,
    };
    this.emit();
  }
}

/**
 * React hook to observe active staging drag state
 */
export function useStagingDrag(): StagingDragState {
  const [state, setState] = useState(() => StagingDragManager.getInstance().getState());
  useEffect(() => {
    return StagingDragManager.getInstance().subscribe(setState);
  }, []);
  return state;
}
