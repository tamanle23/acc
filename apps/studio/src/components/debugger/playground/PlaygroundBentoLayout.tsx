import { createSignal, createMemo, Show } from 'solid-js';
import {
  Layers,
  Sparkles,
  Sliders,
  Code2,
  Film,
  Activity,
} from 'lucide-solid';
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

  // Ergonomic Right-Workbench tab states
  const [topTab, setTopTab] = createSignal<'stack' | 'presets'>('presets');
  const [bottomTab, setBottomTab] = createSignal<'inspector' | 'catalog' | 'json'>('inspector');

  // Automatically show stack tab if layers exist
  createMemo(() => {
    if (engine.state.modifierStack.length > 0) {
      setTopTab('stack');
    }
  });

  return (
    <div
      data-testid="playground-bento-layout"
      class={`w-full h-full p-3 flex flex-col xl:flex-row gap-2.5 overflow-hidden bg-background/50 select-none ${
        props.class || ''
      }`}
    >
      {/* ======================================================== */}
      {/* LEFT STAGE (Hero Viewport + Storyboard & Curves)         */}
      {/* Takes ~62% of width on desktop, 100% on small screens   */}
      {/* ======================================================== */}
      <div class="flex-1 xl:flex-[7] flex flex-col gap-2.5 min-w-0 min-h-0 h-full">
        {/* 1. Hero Viewport: Maximized High-DPI Look-Dev Stage */}
        <div class="flex-1 min-h-[320px] min-w-0">
          <BentoHeroViewport engine={engine} class="h-full w-full" />
        </div>

        {/* 2. Dual Tooling Row: Storyboard Reel + Motion Curves */}
        <div class="h-[156px] shrink-0 flex flex-col sm:flex-row gap-2.5 min-w-0">
          {/* Storyboard Filmstrip (5 Keyframes) */}
          <div class="flex-[7] min-w-0 h-full">
            <BentoStoryboardFilmstrip engine={engine} class="h-full w-full" />
          </div>

          {/* Interactive Bezier Motion Curves */}
          <div class="flex-[5] min-w-0 h-full">
            <BentoCurveVisualizer engine={engine} class="h-full w-full" />
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* RIGHT CONTROL WORKBENCH (Stack, Presets, Inspector)      */}
      {/* Takes ~38% of width on desktop, 100% on small screens   */}
      {/* ======================================================== */}
      <div class="flex-1 xl:flex-[5] flex flex-col gap-2.5 min-w-0 min-h-0 h-full">
        {/* Top Dock Card: Modifier Pipeline & Curated Presets */}
        <div class="h-[215px] shrink-0 min-w-0 flex flex-col glass-panel rounded-2xl border border-[var(--glass-border)] border-t-[var(--glass-border-highlight)] bg-glass-surface/50 backdrop-blur-xl shadow-lg p-2.5 overflow-hidden">
          {/* Segmented Switcher Header */}
          <div class="flex items-center justify-between pb-2 border-b border-glass-border shrink-0">
            <div class="flex items-center rounded-lg bg-background/40 p-0.5 border border-glass-border text-xs font-mono">
              <button
                type="button"
                class={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  topTab() === 'presets'
                    ? 'bg-accent-theme/20 text-accent-theme font-bold border border-accent-theme/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setTopTab('presets')}
              >
                <Sparkles class="w-3.5 h-3.5" />
                <span>Presets</span>
              </button>

              <button
                type="button"
                class={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  topTab() === 'stack'
                    ? 'bg-accent-theme/20 text-accent-theme font-bold border border-accent-theme/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setTopTab('stack')}
              >
                <Layers class="w-3.5 h-3.5" />
                <span>
                  Stack ({engine.state.modifierStack.length > 0 ? engine.state.modifierStack.length : 'Single'})
                </span>
              </button>
            </div>

            <span class="text-[10px] font-mono text-muted-foreground pr-1">Look-Dev Pipeline</span>
          </div>

          {/* Top Dock Content */}
          <div class="flex-1 min-h-0 pt-1">
            <Show when={topTab() === 'presets'}>
              <BentoPresetShowcase engine={engine} class="h-full w-full !border-0 !p-0 !bg-transparent !shadow-none" />
            </Show>

            <Show when={topTab() === 'stack'}>
              <BentoModifierStack engine={engine} class="h-full w-full !border-0 !p-0 !bg-transparent !shadow-none" />
            </Show>
          </div>
        </div>

        {/* Bottom Dock Card: Precision Inspector, Catalog & JSON */}
        <div class="flex-1 min-h-0 min-w-0 flex flex-col glass-panel rounded-2xl border border-[var(--glass-border)] border-t-[var(--glass-border-highlight)] bg-glass-surface/50 backdrop-blur-xl shadow-lg p-2.5 overflow-hidden">
          {/* Segmented Switcher Header */}
          <div class="flex items-center justify-between pb-2 border-b border-glass-border shrink-0">
            <div class="flex items-center rounded-lg bg-background/40 p-0.5 border border-glass-border text-xs font-mono">
              <button
                type="button"
                class={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  bottomTab() === 'inspector'
                    ? 'bg-accent-theme/20 text-accent-theme font-bold border border-accent-theme/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setBottomTab('inspector')}
              >
                <Sliders class="w-3.5 h-3.5" />
                <span>Inspector</span>
              </button>

              <button
                type="button"
                class={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  bottomTab() === 'catalog'
                    ? 'bg-accent-theme/20 text-accent-theme font-bold border border-accent-theme/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setBottomTab('catalog')}
              >
                <Layers class="w-3.5 h-3.5" />
                <span>Plugins Catalog</span>
              </button>

              <button
                type="button"
                class={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  bottomTab() === 'json'
                    ? 'bg-accent-theme/20 text-accent-theme font-bold border border-accent-theme/30'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setBottomTab('json')}
              >
                <Code2 class="w-3.5 h-3.5" />
                <span>VideoIR JSON</span>
              </button>
            </div>

            <span class="text-[10px] font-mono text-muted-foreground pr-1">Parameter Controls</span>
          </div>

          {/* Bottom Dock Content */}
          <div class="flex-1 min-h-0 pt-1">
            <Show when={bottomTab() === 'inspector'}>
              <PlaygroundInspector engine={engine} class="h-full w-full !border-0 !p-0 !bg-transparent !shadow-none" />
            </Show>

            <Show when={bottomTab() === 'catalog' || bottomTab() === 'json'}>
              <BentoCatalogAndJson engine={engine} class="h-full w-full !border-0 !p-0 !bg-transparent !shadow-none" />
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
