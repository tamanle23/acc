import { createSignal, createMemo, onCleanup, type Accessor } from 'solid-js';
import { IRStateManager, type IRState } from './irState';
import { PlayheadController } from '../playhead/PlayheadController';

export type ReactiveIRState = Accessor<IRState> & IRState;

function createReactiveProxy(accessor: Accessor<IRState>): ReactiveIRState {
  return new Proxy(accessor, {
    apply(target) {
      return target();
    },
    get(target, prop) {
      const snapshot = target();
      const val = (snapshot as any)[prop];
      if (typeof val === 'function') {
        return val.bind(snapshot);
      }
      return val;
    },
  }) as ReactiveIRState;
}

/**
 * SolidJS fine-grained external store hook returning a reactive Accessor (and proxy) to IRState.
 * Automatically notifies subscribers when IRStateManager transitions state.
 */
export function useIRState(): ReactiveIRState {
  const manager = IRStateManager.getInstance();
  const [state, setState] = createSignal<IRState>(manager.getSnapshot());

  const unsubscribe = manager.subscribe(() => {
    setState(manager.getSnapshot());
  });
  onCleanup(unsubscribe);

  return createReactiveProxy(state);
}

/**
 * SolidJS fine-grained external store selector hook for targeted subscriptions to IRState.
 * Prevents unnecessary re-computations when unrelated state slices change.
 */
export function useIRSelector<T>(
  selector: (state: IRState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is
): Accessor<T> {
  const manager = IRStateManager.getInstance();
  const [state, setState] = createSignal<IRState>(manager.getSnapshot());

  const unsubscribe = manager.subscribe(() => {
    setState(manager.getSnapshot());
  });
  onCleanup(unsubscribe);

  return createMemo(() => selector(state()), undefined, { equals: isEqual });
}

/**
 * SolidJS fine-grained hook subscribed to PlayheadController's
 * frame updates.
 */
export function usePlayheadFrame(): Accessor<number> {
  const controller = PlayheadController.getInstance();
  const [frame, setFrame] = createSignal<number>(controller.getFrame());

  const unsubscribe = controller.subscribeLowFrequency((f) => {
    setFrame(f);
  });
  onCleanup(unsubscribe);

  return frame;
}

/**
 * SolidJS fine-grained hook subscribed to PlayheadController's playing state.
 */
export function usePlayheadIsPlaying(): Accessor<boolean> {
  const controller = PlayheadController.getInstance();
  const [isPlaying, setIsPlaying] = createSignal<boolean>(controller.getIsPlaying());

  const unsubscribe = controller.subscribeLowFrequency(() => {
    setIsPlaying(controller.getIsPlaying());
  });
  onCleanup(unsubscribe);

  return isPlaying;
}

/**
 * Studio master hook returning reactive accessors and command dispatchers.
 */
export function useStudioStore() {
  const irState = useIRState();
  const manager = IRStateManager.getInstance();
  return {
    irState,
    dispatch: manager.dispatch.bind(manager),
    undo: manager.undo.bind(manager),
    redo: manager.redo.bind(manager),
  };
}
