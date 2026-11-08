import { RationalTime } from '@acc/core-isomorphic';
import { createMemo, For } from 'solid-js';

export interface TimecodeRulerProps {
  totalFrames: number;
  fps: number;
  pixelsPerFrame: number;
  timelineWidth: number;
  onScrub: (frame: number) => void;
}

export function TimecodeRuler(props: TimecodeRulerProps) {
  let isDragging = false;

  const updateFrameFromClientX = (clientX: number, target: HTMLDivElement) => {
    const rect = target.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const targetFrame = Math.max(0, Math.min(props.totalFrames, Math.round(clickX / props.pixelsPerFrame)));
    props.onScrub(targetFrame);
  };

  const handlePointerDown = (e: PointerEvent) => {
    const target = e.currentTarget as HTMLDivElement;
    target.setPointerCapture(e.pointerId);
    isDragging = true;
    updateFrameFromClientX(e.clientX, target);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging) return;
    updateFrameFromClientX(e.clientX, e.currentTarget as HTMLDivElement);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (isDragging) {
      isDragging = false;
      try {
        (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Generate markers every second and intermediate frames using exact RationalTime arithmetic
  const markers = createMemo(() => {
    const secondStep = Math.max(1, Math.round(props.fps));
    const step = Math.max(1, Math.round(props.fps / 2));
    const list: { frame: number; label: string; isMajor: boolean }[] = [];

    for (let f = 0; f <= props.totalFrames; f += step) {
      const isMajor = f % secondStep === 0;
      const rTime = RationalTime.fromFrame(f, props.fps);
      const smpte = rTime.toSMPTE(props.fps); // HH:MM:SS:FF
      const label = isMajor ? smpte.slice(3, 8) : `:${smpte.slice(9, 11)}`;
      list.push({ frame: f, label, isMajor });
    }
    return list;
  });

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ width: `${props.timelineWidth}px` }}
      class="h-6 bg-muted/30 border-b border-border/40 relative select-none cursor-pointer touch-none"
    >
      <For each={markers()}>
        {(m) => {
          const leftPx = () => m.frame * props.pixelsPerFrame;
          return (
            <div
              style={{ left: `${leftPx()}px` }}
              class={`absolute top-0 bottom-0 flex flex-col justify-between ${
                m.isMajor ? 'border-l border-border' : 'border-l border-border/40'
              }`}
            >
              <span
                class={`text-[9px] font-mono pl-1 pointer-events-none select-none ${
                  m.isMajor ? 'text-foreground/80 font-medium' : 'text-muted-foreground/60 text-[8px]'
                }`}
              >
                {m.isMajor ? m.label : ''}
              </span>
              <div class={`w-0.5 ${m.isMajor ? 'h-2 bg-muted-foreground' : 'h-1 bg-border'}`} />
            </div>
          );
        }}
      </For>
    </div>
  );
}
