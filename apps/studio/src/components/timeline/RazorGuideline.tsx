import { Show } from 'solid-js';

export interface RazorGuidelineProps {
  pixelsPerFrame: number;
  razorHoverFrame: number | null;
}

export function RazorGuideline(props: RazorGuidelineProps) {
  return (
    <Show when={props.razorHoverFrame !== null}>
      <div
        class="absolute top-7 bottom-0 z-35 pointer-events-none flex flex-col items-center"
        style={{
          left: `${208 + props.razorHoverFrame! * props.pixelsPerFrame}px`,
        }}
      >
        <div class="w-1.5 h-1.5 bg-rose-400 rotate-45 -mt-1 shadow-[0_0_8px_#f43f5e]" />
        <div class="w-[1.5px] flex-1 bg-rose-500 shadow-[0_0_6px_#f43f5e]" />
        <span class="text-[9px] font-mono text-rose-300 bg-popover/95 px-1 py-0.5 rounded -mt-4 shadow-sm border border-rose-500/40">
          ✂ Cut @ {props.razorHoverFrame}f
        </span>
      </div>
    </Show>
  );
}

export const TimelineRazorGuideline = RazorGuideline;
