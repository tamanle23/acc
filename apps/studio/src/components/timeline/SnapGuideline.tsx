import { Show } from 'solid-js';

export interface SnapGuidelineProps {
  pixelsPerFrame: number;
  activeSnapGuideline: { frame: number; label?: string; isAbut?: boolean } | null;
}

export function SnapGuideline(props: SnapGuidelineProps) {
  return (
    <Show when={props.activeSnapGuideline}>
      {(guide) => (
        <div
          class="absolute top-7 bottom-0 z-35 pointer-events-none flex flex-col items-center"
          style={{
            left: `${208 + guide().frame * props.pixelsPerFrame}px`,
          }}
        >
          <div
            class={`w-2 h-2 rotate-45 -mt-1 ${
              guide().isAbut
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)] ring-1 ring-emerald-300'
                : 'bg-accent-theme shadow-accent-glow'
            }`}
          />
          <div
            class={`w-[1.5px] flex-1 ${
              guide().isAbut
                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                : 'bg-accent-theme shadow-accent-glow'
            }`}
          />
          <span
            class={`text-[9px] font-mono px-1.5 py-0.5 rounded -mt-4 shadow-sm border flex items-center gap-1 backdrop-blur-md ${
              guide().isAbut
                ? 'text-emerald-300 bg-emerald-950/90 border-emerald-500/60'
                : 'text-accent-theme bg-popover/95 border-accent-theme/40'
            }`}
          >
            <span>{guide().frame}f</span>
            <Show when={guide().label}>
              <span
                class={`text-[8px] uppercase font-semibold ${
                  guide().isAbut ? 'text-emerald-200' : 'text-accent-theme/80'
                }`}
              >
                ({guide().label})
              </span>
            </Show>
          </span>
        </div>
      )}
    </Show>
  );
}

export const TimelineSnapGuideline = SnapGuideline;
