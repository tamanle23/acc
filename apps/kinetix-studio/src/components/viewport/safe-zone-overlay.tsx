import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { useStudio } from '@/context/studio-context';

export const SafeZoneOverlay: Component = () => {
  const studio = useStudio();

  return (
    <Show when={studio.state.safeZone916}>
      <div class="absolute inset-0 pointer-events-none z-30 select-none">
        {/* Right 15% Platform Interaction Buttons Zone */}
        <div class="absolute top-12 bottom-[20%] right-0 w-[15%] bg-rose-500/15 border-l border-dashed border-rose-400/70 flex items-center justify-center">
          <span class="-rotate-90 text-[11px] font-mono uppercase tracking-widest text-rose-700 dark:text-rose-300 font-bold whitespace-nowrap">
            15% UI DOCK SAFE ZONE
          </span>
        </div>
        {/* Bottom 20% Caption & Audio Track Zone */}
        <div class="absolute inset-x-0 bottom-0 h-[20%] bg-amber-500/15 border-t border-dashed border-amber-400/70 flex items-center justify-center">
          <span class="text-[11px] font-mono uppercase tracking-widest text-amber-700 dark:text-amber-300 font-bold">
            20% REELS / TIKTOK CAPTION SAFE ZONE
          </span>
        </div>
      </div>
    </Show>
  );
};
