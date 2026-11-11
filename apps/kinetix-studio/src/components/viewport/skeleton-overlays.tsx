import type { Component } from 'solid-js';
import { Show } from 'solid-js';
import { useStudio } from '@/context/studio-context';

export const SkeletonOverlays: Component = () => {
  const studio = useStudio();

  return (
    <>
      {/* Neo-Tokyo Vertical Obi-Strip */}
      <Show when={studio.state.layoutId === 'neo-tokyo-strip'}>
        <div
          style={{
            'background-color': studio.state.palette.accent,
            color: studio.state.palette.bg,
          }}
          class="absolute inset-y-0 left-0 w-6 z-20 flex items-center justify-center pointer-events-none shadow-md"
        >
          <span class="-rotate-90 text-[11px] font-mono font-black tracking-[0.25em] whitespace-nowrap">
            NEO-TOKYO // AUDIOVISUAL OBI-STRIP 2026
          </span>
        </div>
      </Show>

      {/* Cyber HUD Corner Reticles */}
      <Show when={studio.state.layoutId === 'cyber-hud'}>
        <div class="absolute inset-2.5 pointer-events-none z-20">
          <div
            style={{ 'border-color': studio.state.palette.accent }}
            class="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2"
          />
          <div
            style={{ 'border-color': studio.state.palette.accent }}
            class="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2"
          />
          <div
            style={{ 'border-color': studio.state.palette.accent }}
            class="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2"
          />
          <div
            style={{ 'border-color': studio.state.palette.accent }}
            class="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2"
          />
        </div>
      </Show>

      {/* Broadsheet 3-Column Guides */}
      <Show when={studio.state.layoutId === 'broadsheet-3col'}>
        <div class="absolute inset-0 pointer-events-none z-10 grid grid-cols-3">
          <div
            style={{ 'border-color': studio.state.palette.ink + '22' }}
            class="border-r"
          />
          <div
            style={{ 'border-color': studio.state.palette.ink + '22' }}
            class="border-r"
          />
        </div>
      </Show>

      {/* Constructivist Geometric Beams */}
      <Show when={studio.state.layoutId === 'constructivist'}>
        <div
          style={{ 'background-color': studio.state.palette.accent + '28' }}
          class="absolute -inset-x-10 top-1/2 h-8 -rotate-12 pointer-events-none z-0"
        />
      </Show>
    </>
  );
};
