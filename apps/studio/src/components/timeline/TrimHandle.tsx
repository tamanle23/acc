import { useDraggable } from '@dnd-kit/solid';
import type { StudioSequence } from '../../lib/ir/studioTypes';

export interface TrimHandleProps {
  seq: StudioSequence;
  handle: 'start' | 'end';
}

export function TrimHandle(props: TrimHandleProps) {
  const draggable = useDraggable({
    id: () => `trim-${props.handle}-${props.seq.id}`,
    data: () => ({
      type: 'trim',
      handle: props.handle,
      seq: props.seq,
    }),
  });

  return (
    <div
      ref={draggable.ref}
      onClick={(e: MouseEvent) => e.stopPropagation()}
      class={`w-2 h-full ${
        props.handle === 'start' ? '-ml-2 rounded-l-xs' : '-mr-2 rounded-r-xs'
      } cursor-col-resize hover:bg-white/50 active:bg-accent-theme/60 flex items-center justify-center transition-colors z-30`}
      title={`Drag to Trim ${props.handle === 'start' ? 'Start' : 'End'} (Snap enabled)`}
    >
      <div class="w-0.5 h-3 bg-white/60 rounded-full" />
    </div>
  );
}
