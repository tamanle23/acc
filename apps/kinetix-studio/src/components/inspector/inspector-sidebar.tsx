import { Component, For, Switch, Match, Show } from 'solid-js';
import { SlidersHorizontal, Palette, Activity, FileText, ChevronLeft, ChevronRight, Film } from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { ConfigTab } from './config-tab';
import { BrandAndStylesTab } from './brand-and-styles-tab';
import { MotionTab } from './motion-tab';
import { PayloadTab } from './payload-tab';
import { cn } from '@/lib/utils';

export type InspectorTabId = 'config' | 'brand' | 'motion' | 'payload';

export interface InspectorSidebarProps {
  onOpenLottieHub: () => void;
  onOpenMediaVault?: () => void;
  width?: number;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const InspectorSidebar: Component<InspectorSidebarProps> = (props) => {
  const studio = useStudio();

  const tabs = [
    { id: 'config' as InspectorTabId, num: '1', label: 'Config', icon: SlidersHorizontal },
    { id: 'brand' as InspectorTabId, num: '2', label: 'Styles', icon: Palette },
    { id: 'motion' as InspectorTabId, num: '3', label: 'Motion', icon: Activity },
    { id: 'payload' as InspectorTabId, num: '4', label: 'Payload', icon: FileText },
  ];

  return (
    <Show
      when={!props.collapsed}
      fallback={
        <aside class="w-11 min-w-11 max-w-11 shrink-0 flex-none border-r border-border bg-card text-card-foreground flex flex-col items-center py-2 gap-2 select-none z-10">
          <button
            type="button"
            onClick={props.onToggleCollapse}
            title="Expand Inspector Sidebar (Hotkey: [)"
            class="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
          <div class="w-6 h-px bg-border my-1" />
          <For each={tabs}>
            {(t) => {
              const Icon = t.icon;
              const active = () => studio.activeTab === t.id;
              return (
                <button
                  type="button"
                  onClick={() => {
                    studio.setActiveTab(t.id);
                    props.onToggleCollapse?.();
                  }}
                  title={`Open ${t.num}. ${t.label}`}
                  class={cn(
                    'p-2 rounded-md transition-colors cursor-pointer relative group',
                    active()
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  <Icon class="w-4 h-4" />
                </button>
              );
            }}
          </For>
        </aside>
      }
    >
      <aside
        style={{ width: `${props.width ?? 384}px` }}
        class="shrink-0 flex-none border-r border-border bg-card text-card-foreground flex flex-col overflow-hidden select-none transition-[width] duration-75"
      >
        {/* Inspector Navigation Tabs: Segmented Header with Collapse Toggle */}
        <div class="flex items-center border-b border-border bg-muted/60 p-1 gap-1 shrink-0 w-full">
          <div class="grid grid-cols-4 gap-1 flex-1 min-w-0">
            <For each={tabs}>
              {(t) => {
                const Icon = t.icon;
                const active = () => studio.activeTab === t.id;
                return (
                  <button
                    type="button"
                    onClick={() => studio.setActiveTab(t.id)}
                    class={cn(
                      'flex items-center justify-center gap-1 py-1.5 px-1 rounded text-xs font-mono font-medium transition-all cursor-pointer min-w-0',
                      active()
                        ? 'bg-card text-primary font-bold shadow-sm border border-border'
                        : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
                    )}
                  >
                    <Icon class="w-3.5 h-3.5 shrink-0" />
                    <span class="truncate">
                      <span class="opacity-60">{t.num}. </span>
                      {t.label}
                    </span>
                  </button>
                );
              }}
            </For>
          </div>

          <Show when={props.onToggleCollapse}>
            <button
              type="button"
              onClick={props.onToggleCollapse}
              title="Collapse Inspector (Hotkey: [)"
              class="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground shrink-0 cursor-pointer transition-colors ml-0.5"
            >
              <ChevronLeft class="w-3.5 h-3.5" />
            </button>
          </Show>
        </div>

        {/* Active Storyboard Act Header & Scene Switcher */}
        <Show when={studio.state.isStoryboardMode && studio.storyboard.scenes.length > 0}>
          {(() => {
            const scenes = studio.storyboard.scenes;
            const currentId = studio.selectedSceneId ?? scenes[0]?.id;
            const activeIndex = Math.max(0, scenes.findIndex((s) => s.id === currentId));
            const activeScene = scenes[activeIndex] ?? scenes[0];
            const totalScenes = scenes.length;

            const handlePrev = () => {
              if (activeIndex > 0) {
                studio.selectStoryboardScene(scenes[activeIndex - 1].id);
              }
            };

            const handleNext = () => {
              if (activeIndex < totalScenes - 1) {
                studio.selectStoryboardScene(scenes[activeIndex + 1].id);
              }
            };

            return (
              <div class="px-3 py-2 bg-primary/10 border-b border-primary/25 flex flex-col gap-1.5 shrink-0">
                <div class="flex items-center justify-between gap-2">
                  {/* Act Badge & Title */}
                  <div class="flex items-center gap-1.5 min-w-0">
                    <Film class="w-3.5 h-3.5 shrink-0 text-primary" />
                    <span class="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary text-primary-foreground shrink-0">
                      Act 0{activeIndex + 1}
                    </span>
                    <span
                      class="text-xs font-mono font-bold text-foreground truncate"
                      title={activeScene.title}
                    >
                      {activeScene.title}
                    </span>
                  </div>

                  {/* Act Switcher Buttons */}
                  <div class="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handlePrev}
                      disabled={activeIndex === 0}
                      class="p-1 rounded hover:bg-primary/20 text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title="Previous Act"
                    >
                      <ChevronLeft class="w-3.5 h-3.5" />
                    </button>
                    <span class="text-[10px] font-mono text-primary font-bold px-0.5">
                      {activeIndex + 1} / {totalScenes}
                    </span>
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={activeIndex >= totalScenes - 1}
                      class="p-1 rounded hover:bg-primary/20 text-foreground disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      title="Next Act"
                    >
                      <ChevronRight class="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Scope Indicator Note */}
                <div class="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span class="flex items-center gap-1 text-primary">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Scene-scoped edits active
                  </span>
                  <span class="opacity-80 truncate max-w-[140px]">
                    {activeScene.archetypeId} • {activeScene.durationSec.toFixed(1)}s
                  </span>
                </div>
              </div>
            );
          })()}
        </Show>

        {/* Inspector Scroll Body */}
        <div class="flex-1 overflow-y-auto overflow-x-hidden p-3.5 space-y-4 min-w-0 w-full">
          <Switch>
            <Match when={studio.activeTab === 'config'}>
              <ConfigTab onOpenMediaVault={props.onOpenMediaVault} />
            </Match>
            <Match when={studio.activeTab === 'brand'}>
              <BrandAndStylesTab
                onOpenLottieHub={() => props.onOpenLottieHub()}
                onOpenMediaVault={props.onOpenMediaVault}
              />
            </Match>
            <Match when={studio.activeTab === 'motion'}>
              <MotionTab />
            </Match>
            <Match when={studio.activeTab === 'payload'}>
              <PayloadTab />
            </Match>
          </Switch>
        </div>
      </aside>
    </Show>
  );
};
