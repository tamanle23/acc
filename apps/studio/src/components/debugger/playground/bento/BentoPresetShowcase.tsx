import { createSignal, createMemo, For, Show } from 'solid-js';
import { Sparkles, Check, Search, X } from 'lucide-solid';
import { Badge } from '../../../ui/badge';
import { Input } from '../../../ui/input';
import { getPresetsForPlugin } from '../playgroundPresets';
import type { PlaygroundEngine } from '../usePlaygroundEngine';

export interface BentoPresetShowcaseProps {
  engine: PlaygroundEngine;
  class?: string;
}

export function BentoPresetShowcase(props: BentoPresetShowcaseProps) {
  const [filterQuery, setFilterQuery] = createSignal('');
  const [activePresetName, setActivePresetName] = createSignal<string>('');

  const { state, activePlugin } = props.engine;

  const presets = createMemo(() => {
    const plugin = activePlugin();
    const list = getPresetsForPlugin(state.selectedPluginType, plugin?.schema);
    if (!activePresetName() && list.length > 0) {
      setActivePresetName(list[0].name);
    }
    return list;
  });

  const filteredPresets = createMemo(() => {
    const q = filterQuery().trim().toLowerCase();
    if (!q) return presets();
    return presets().filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  });

  const handleSelectPreset = (name: string, params: Record<string, any>) => {
    setActivePresetName(name);
    props.engine.loadPreset(params);
  };

  return (
    <div
      class={`flex flex-col h-full w-full min-h-0 min-w-0 glass-panel rounded-2xl border border-[var(--glass-border)] border-t-[var(--glass-border-highlight)] bg-glass-surface/50 backdrop-blur-xl shadow-lg p-3 select-none overflow-hidden ${
        props.class || ''
      }`}
    >
      {/* Tile Header */}
      <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-glass-border shrink-0">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-md bg-accent-theme/15 text-accent-theme flex items-center justify-center border border-accent-theme/30">
            <Sparkles class="w-3.5 h-3.5" />
          </div>
          <span class="text-xs font-bold text-foreground">Curated Presets</span>
          <Badge
            variant="outline"
            class="font-mono text-[9px] px-1.5 py-0 border-accent-theme/30 text-accent-theme bg-accent-theme/10"
          >
            {presets().length}
          </Badge>
        </div>

        {/* Mini Search */}
        <Show when={presets().length > 2}>
          <div class="relative w-32">
            <Input
              value={filterQuery()}
              onInput={(e) => setFilterQuery(e.currentTarget.value)}
              placeholder="Filter..."
              class="h-6 text-[10px] pl-2 pr-5 font-mono bg-background/50 border-glass-border"
            />
            <Show when={filterQuery().length > 0}>
              <button
                type="button"
                class="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground p-0.5"
                onClick={() => setFilterQuery('')}
              >
                <X class="w-2.5 h-2.5" />
              </button>
            </Show>
          </div>
        </Show>
      </div>

      {/* Preset Cards Grid (Scrollable) */}
      <div class="flex-1 min-h-0 overflow-y-auto pt-2.5 flex flex-col gap-2">
        <For each={filteredPresets()}>
          {(preset) => {
            const isSelected = () => activePresetName() === preset.name;
            return (
              <div
                role="button"
                tabIndex={0}
                data-testid={`preset-card-${preset.name}`}
                class={`group flex flex-col gap-1.5 p-2.5 rounded-xl cursor-pointer text-left transition-all border ${
                  isSelected()
                    ? 'bg-accent-theme/15 border-accent-theme/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]'
                    : 'bg-glass-surface/30 border-transparent hover:bg-glass-surface/70 hover:border-glass-border/70'
                }`}
                onClick={() => handleSelectPreset(preset.name, preset.params)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectPreset(preset.name, preset.params);
                  }
                }}
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5 truncate">
                    <div
                      class={`w-2 h-2 rounded-full ${
                        isSelected() ? 'bg-accent-theme animate-pulse' : 'bg-muted-foreground/40'
                      }`}
                    />
                    <span
                      class={`text-xs font-semibold truncate transition-colors ${
                        isSelected() ? 'text-accent-theme font-bold' : 'text-foreground'
                      }`}
                    >
                      {preset.name}
                    </span>
                  </div>

                  <Show when={isSelected()}>
                    <span class="w-4 h-4 rounded-full bg-accent-theme/20 text-accent-theme flex items-center justify-center shrink-0">
                      <Check class="w-2.5 h-2.5" />
                    </span>
                  </Show>
                </div>

                <p class="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {preset.description}
                </p>

                {/* Micro tags */}
                <div class="flex items-center gap-1 flex-wrap mt-0.5">
                  <Show when={preset.params.useSIMD}>
                    <span class="text-[9px] font-mono px-1 py-0 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      SIMD
                    </span>
                  </Show>
                  <Show when={preset.params.shaders?.bloom?.enabled}>
                    <span class="text-[9px] font-mono px-1 py-0 rounded bg-accent-theme/15 text-accent-theme border border-accent-theme/30">
                      Bloom
                    </span>
                  </Show>
                  <Show when={preset.params.speedMultiplier}>
                    <span class="text-[9px] font-mono px-1 py-0 rounded bg-white/5 text-muted-foreground">
                      {preset.params.speedMultiplier}x Speed
                    </span>
                  </Show>
                </div>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
