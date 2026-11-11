import { Show } from 'solid-js';
import type { PlaygroundEngine } from './usePlaygroundEngine';
import { BentoHeroViewport } from './bento/BentoHeroViewport';
import { BentoModifierStack } from './bento/BentoModifierStack';
import { BentoPresetShowcase } from './bento/BentoPresetShowcase';
import { BentoStoryboardFilmstrip } from './bento/BentoStoryboardFilmstrip';
import { BentoCurveVisualizer } from './bento/BentoCurveVisualizer';
import { BentoCatalogAndJson } from './bento/BentoCatalogAndJson';
import { PlaygroundInspector } from './PlaygroundInspector';

export interface PlaygroundBentoLayoutProps {
  engine: PlaygroundEngine;
  class?: string;
}

export function PlaygroundBentoLayout(props: PlaygroundBentoLayoutProps) {
  const { engine } = props;

  return (
    <div
      class={`w-full h-full overflow-y-auto p-4 custom-scrollbar bg-slate-950/80 ${
        props.class || ''
      }`}
    >
      <div class="grid grid-cols-12 gap-4 max-w-[1920px] mx-auto">
        {/* ======================================================== */}
        {/* TIER 1: LOOK-DEV & PIPELINE STAGE                       */}
        {/* ======================================================== */}

        {/* 1. Hero Viewport: 8 cols on desktop */}
        <div class="col-span-12 xl:col-span-8 flex flex-col min-h-[480px]">
          <BentoHeroViewport engine={engine} class="h-full w-full" />
        </div>

        {/* 2 & 3. Side Column: Modifier Stack & Preset Showcase */}
        <div class="col-span-12 xl:col-span-4 flex flex-col gap-4 min-h-[480px]">
          {/* Multi-Modifier Chaining Pipeline */}
          <BentoModifierStack engine={engine} class="flex-1 min-h-[230px]" />

          {/* Visual Preset Showcase */}
          <BentoPresetShowcase engine={engine} class="flex-1 min-h-[230px]" />
        </div>

        {/* ======================================================== */}
        {/* TIER 2: PRECISION TOOLING & TEMPORAL ANALYSIS           */}
        {/* ======================================================== */}

        {/* 4. Precision Inspector Form: 5 cols on desktop */}
        <div class="col-span-12 lg:col-span-5 flex flex-col rounded-2xl bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-xl overflow-hidden min-h-[420px]">
          <PlaygroundInspector engine={engine} class="h-full w-full !border-l-0 !bg-transparent" />
        </div>

        {/* 5. Motion & Bezier Curve Visualizer: 3 cols on desktop */}
        <div class="col-span-12 sm:col-span-6 lg:col-span-3 flex flex-col min-h-[420px]">
          <BentoCurveVisualizer engine={engine} class="h-full w-full" />
        </div>

        {/* 6. Searchable Catalog & Shiki VideoIR JSON: 4 cols on desktop */}
        <div class="col-span-12 sm:col-span-6 lg:col-span-4 flex flex-col min-h-[420px]">
          <BentoCatalogAndJson engine={engine} class="h-full w-full" />
        </div>

        {/* ======================================================== */}
        {/* TIER 3: STORYBOARD REEL & KEYFRAME SNAPSHOTS (12 cols)  */}
        {/* ======================================================== */}
        <div class="col-span-12 min-h-[170px]">
          <BentoStoryboardFilmstrip engine={engine} class="w-full" />
        </div>
      </div>
    </div>
  );
}
