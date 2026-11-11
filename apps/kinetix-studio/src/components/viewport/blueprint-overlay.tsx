import { Show, createMemo, type Component } from 'solid-js';
import { useStudio } from '@/context/studio-context';
import { getSpatialSkeletonSpec } from '@/engine/spatial-skeleton';

export const BlueprintOverlay: Component = () => {
  const studio = useStudio();
  const spec = createMemo(() => getSpatialSkeletonSpec(studio.state));
  const showOverlay = createMemo(() => studio.state.blueprintGrid || spec().gridGuides !== 'none');

  return (
    <Show when={showOverlay()}>
      <div class="absolute inset-0 pointer-events-none z-20 select-none overflow-hidden">
        {/* 1. Rule of Thirds / Standard Blueprint Lines */}
        <Show when={studio.state.blueprintGrid || spec().gridGuides === 'thirds' || spec().gridGuides === 'crosshair'}>
          <div class="absolute inset-y-0 left-1/3 w-px bg-cyan-400/20 border-r border-dashed border-cyan-400/30" />
          <div class="absolute inset-y-0 left-2/3 w-px bg-cyan-400/20 border-r border-dashed border-cyan-400/30" />
          <div class="absolute inset-x-0 top-1/3 h-px bg-cyan-400/20 border-b border-dashed border-cyan-400/30" />
          <div class="absolute inset-x-0 top-2/3 h-px bg-cyan-400/20 border-b border-dashed border-cyan-400/30" />
          <div
            class="absolute inset-y-0 left-1/2 w-px opacity-35"
            style={{ 'background-color': studio.state.palette.accent }}
          />
          <div
            class="absolute inset-x-0 top-1/2 h-px opacity-35"
            style={{ 'background-color': studio.state.palette.accent }}
          />
        </Show>

        {/* 2. Quad 2x2 Modular Grid */}
        <Show when={spec().gridGuides === 'quad'}>
          <div class="absolute inset-y-0 left-1/2 w-px border-l border-dashed border-cyan-400/40" />
          <div class="absolute inset-x-0 top-1/2 h-px border-t border-dashed border-cyan-400/40" />
        </Show>

        {/* 3. 3-Column Columnar Grid */}
        <Show when={spec().gridGuides === 'columns-3'}>
          <div class="absolute inset-y-0 left-1/3 w-px border-l border-dashed border-cyan-400/30" />
          <div class="absolute inset-y-0 left-2/3 w-px border-l border-dashed border-cyan-400/30" />
        </Show>

        {/* 4. Golden Spiral Fibonacci Overlay (SVG Path) */}
        <Show when={spec().gridGuides === 'golden-spiral'}>
          <svg class="absolute inset-0 w-full h-full opacity-35" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path
              d="M 0,100 A 100,100 0 0,1 100,0 A 61.8,61.8 0 0,1 38.2,61.8 A 38.2,38.2 0 0,1 76.4,100 A 23.6,23.6 0 0,1 100,76.4 A 14.6,14.6 0 0,1 85.4,61.8"
              fill="none"
              stroke={studio.state.palette.accent}
              stroke-width="0.75"
              stroke-dasharray="2,2"
            />
          </svg>
        </Show>

        {/* 5. F-Pattern Spine & Ridge Guide */}
        <Show when={spec().gridGuides === 'f-stem'}>
          <div
            class="absolute inset-y-0 left-4 w-1 opacity-50 shadow-sm"
            style={{ 'background-color': studio.state.palette.accent }}
          />
          <div class="absolute left-4 right-8 top-16 h-px border-b border-dashed border-cyan-400/40" />
          <div class="absolute left-4 right-24 top-36 h-px border-b border-dashed border-cyan-400/30" />
        </Show>
      </div>
    </Show>
  );
};
