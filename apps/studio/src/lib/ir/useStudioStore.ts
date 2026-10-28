import { useRef, useSyncExternalStore } from 'react';
import { IRStateManager, type IRState } from './irState';
import { StudioPlayheadController } from '../playhead/StudioPlayheadController';

/**
 * React 19 external store hook returning the full IRState snapshot.
 * Automatically re-renders when IRStateManager transitions state.
 */
export function useIRState(): IRState {
  const manager = IRStateManager.getInstance();
  return useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
}

/**
 * React 19 external store selector hook for fine-grained subscriptions to IRState.
 * Caches the previous selected slice and uses `isEqual` (default `Object.is`)
 * to prevent unnecessary re-renders or tearing when unrelated state changes.
 */
export function useIRSelector<T>(
  selector: (state: IRState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is
): T {
  const manager = IRStateManager.getInstance();
  const prevRef = useRef<{ hasValue: boolean; value: T }>({
    hasValue: false,
    value: undefined as unknown as T,
  });

  const getSelection = (): T => {
    const next = selector(manager.getSnapshot());
    if (prevRef.current.hasValue && isEqual(prevRef.current.value, next)) {
      return prevRef.current.value;
    }
    prevRef.current = { hasValue: true, value: next };
    return next;
  };

  return useSyncExternalStore(manager.subscribe, getSelection, getSelection);
}

/**
 * React 19 external store hook subscribed to StudioPlayheadController's
 * low-frequency (~10 Hz during playback, immediate on seek/stop) frame updates.
 */
export function usePlayheadFrame(): number {
  const controller = StudioPlayheadController.getInstance();
  return useSyncExternalStore(
    controller.subscribeLowFrequency,
    controller.getFrame,
    controller.getFrame
  );
}

/**
 * React 19 external store hook subscribed to StudioPlayheadController's playing state.
 */
export function usePlayheadIsPlaying(): boolean {
  const controller = StudioPlayheadController.getInstance();
  return useSyncExternalStore(
    controller.subscribeLowFrequency,
    controller.getIsPlaying,
    controller.getIsPlaying
  );
}
