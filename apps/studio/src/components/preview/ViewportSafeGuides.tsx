import { Show } from 'solid-js';
import type { StandardAspectRatio } from '@acc/ir';

export interface ViewportSafeGuidesProps {
  mode: 'none' | '16:9' | '9:16' | 'auto';
  aspectRatio?: StandardAspectRatio;
}

export function ViewportSafeGuides(props: ViewportSafeGuidesProps) {
  const effectiveRatio = () => {
    const m = props.mode;
    if (m === 'auto') return props.aspectRatio || '16:9';
    return m;
  };

  return (
    <Show when={props.mode !== 'none'}>
      <Show
        when={effectiveRatio() === '9:16'}
        fallback={
          /* Default broadcast/standard safe frames (16:9, 4:5, 1:1, 21:9, etc.) */
          <div class="absolute inset-0 pointer-events-none z-20">
            {/* Action Safe 93% */}
            <div class="absolute inset-[3.5%] border border-dashed border-accent-theme/60 shadow-accent-glow">
              <span class="absolute top-1 left-1.5 text-[9px] font-mono font-semibold glass-badge-accent px-1 py-0.2 rounded">
                {effectiveRatio()} Action Safe (93%)
              </span>
            </div>
            {/* Title Safe 90% */}
            <div class="absolute inset-[5%] border border-dashed border-amber-400/70 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
              <span class="absolute top-1 left-1.5 text-[9px] font-mono font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/40 px-1 py-0.2 rounded">
                {effectiveRatio()} Title Safe (90%)
              </span>
            </div>
            {/* Center Grid Reticle Crosshairs */}
            <div class="absolute top-1/2 left-0 right-0 h-px bg-accent-theme/20" />
            <div class="absolute left-1/2 top-0 bottom-0 w-px bg-accent-theme/20" />
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-accent-theme/40 rounded-full" />
          </div>
        }
      >
        <div class="absolute inset-0 pointer-events-none z-20 flex justify-center">
          <div class="relative h-full w-full border border-dashed border-rose-500/80 bg-rose-500/5 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
            <span class="absolute top-1.5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold bg-rose-950/90 text-rose-300 border border-rose-500/50 px-2 py-0.5 rounded whitespace-nowrap">
              9:16 TikTok / Reels Social Safe
            </span>

            {/* Top Header UI Danger Zone */}
            <div class="absolute top-0 left-0 right-0 h-[12%] border-b border-dashed border-rose-400/60 bg-rose-950/40 flex items-center justify-center">
              <span class="text-[8px] font-mono text-rose-300/80 tracking-tight">
                Top UI Zone (Profile / Search)
              </span>
            </div>

            {/* Bottom Captions Danger Zone */}
            <div class="absolute bottom-0 left-0 right-0 h-[22%] border-t border-dashed border-rose-400/60 bg-rose-950/40 flex items-center justify-center">
              <span class="text-[8px] font-mono text-rose-300/80 tracking-tight">
                Bottom UI Zone (Captions / Audio)
              </span>
            </div>

            {/* Right Sidebar Interaction Zone */}
            <div class="absolute top-[12%] bottom-[22%] right-0 w-[22%] border-l border-dashed border-rose-400/50 bg-rose-950/30 flex items-center justify-center">
              <span class="text-[7px] font-mono text-rose-300/70 [writing-mode:vertical-rl] tracking-tighter">
                Actions (Like / Share)
              </span>
            </div>
          </div>
        </div>
      </Show>
    </Show>
  );
}
