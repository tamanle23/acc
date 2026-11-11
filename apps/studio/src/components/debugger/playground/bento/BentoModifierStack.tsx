import { createSignal, For, Show } from 'solid-js';
import {
  Layers,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Sparkles,
} from 'lucide-solid';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import { ModifierPluginRegistry } from '@acc/ir';
import type { PlaygroundEngine, ModifierStackItem } from '../usePlaygroundEngine';

export interface BentoModifierStackProps {
  engine: PlaygroundEngine;
  class?: string;
}

export function BentoModifierStack(props: BentoModifierStackProps) {
  const [selectedAddType, setSelectedAddType] = createSignal<string>('');
  const registry = ModifierPluginRegistry.getInstance();
  const allTypes = registry.listTypes();

  const { state } = props.engine;

  const handleAdd = (type: string) => {
    if (!type) return;
    props.engine.addModifierToStack(type);
    setSelectedAddType('');
  };

  return (
    <div
      class={`flex flex-col h-full w-full min-h-0 min-w-0 glass-panel rounded-2xl border border-[var(--glass-border)] border-t-[var(--glass-border-highlight)] bg-glass-surface/50 backdrop-blur-xl shadow-lg p-3 select-none overflow-hidden ${
        props.class || ''
      }`}
    >
      {/* Header */}
      <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-glass-border shrink-0">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-md bg-accent-theme/15 text-accent-theme flex items-center justify-center border border-accent-theme/30">
            <Layers class="w-3.5 h-3.5" />
          </div>
          <span class="text-xs font-bold text-foreground">Pipeline Stack</span>
          <Badge
            variant="outline"
            class="font-mono text-[9px] px-1.5 py-0 border-accent-theme/30 text-accent-theme bg-accent-theme/10"
          >
            {state.modifierStack.length > 0
              ? `${state.modifierStack.filter((l) => l.enabled).length}/${state.modifierStack.length}`
              : 'Single'}
          </Badge>
        </div>

        {/* Clear Stack Action */}
        <Show when={state.modifierStack.length > 0}>
          <Button
            variant="ghost"
            size="sm"
            class="h-6 px-2 text-[10px] font-mono text-muted-foreground hover:text-foreground"
            onClick={props.engine.clearStack}
            title="Clear stack and return to single modifier mode"
          >
            Reset
          </Button>
        </Show>
      </div>

      {/* Layer List / Empty State */}
      <div class="flex-1 min-h-0 overflow-y-auto py-2 flex flex-col gap-1.5">
        <Show
          when={state.modifierStack.length > 0}
          fallback={
            <div class="flex-1 flex flex-col items-center justify-center p-4 text-center text-muted-foreground gap-2">
              <Layers class="w-6 h-6 opacity-30" />
              <p class="text-xs">Single Modifier Mode</p>
              <p class="text-[10px] opacity-70 max-w-[200px]">
                Add more layers below to chain modifiers in sequential pass order.
              </p>
            </div>
          }
        >
          <For each={state.modifierStack}>
            {(item, idx) => (
              <div
                class={`flex items-center justify-between gap-2 p-2 rounded-xl transition-all border ${
                  item.enabled
                    ? 'bg-glass-surface/40 border-glass-border/60 hover:border-accent-theme/40'
                    : 'bg-black/20 border-transparent opacity-50'
                }`}
              >
                {/* Left: Reorder & Status */}
                <div class="flex items-center gap-1.5 min-w-0">
                  <div class="flex flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={idx() === 0}
                      class="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                      onClick={() => props.engine.reorderModifier(item.id, 'up')}
                      title="Move Up"
                    >
                      <ChevronUp class="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx() === state.modifierStack.length - 1}
                      class="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                      onClick={() => props.engine.reorderModifier(item.id, 'down')}
                      title="Move Down"
                    >
                      <ChevronDown class="w-3 h-3" />
                    </button>
                  </div>

                  <span class="font-mono text-[10px] text-muted-foreground w-4">
                    #{idx() + 1}
                  </span>

                  <div class="flex flex-col min-w-0">
                    <span class="text-xs font-semibold text-foreground truncate">
                      {item.name}
                    </span>
                    <span class="font-mono text-[9px] text-muted-foreground truncate">
                      {item.type}
                    </span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    class={`p-1 rounded-md transition-colors ${
                      item.enabled
                        ? 'text-accent-theme hover:bg-accent-theme/10'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => props.engine.toggleModifierEnabled(item.id)}
                    title={item.enabled ? 'Bypass Layer' : 'Enable Layer'}
                  >
                    {item.enabled ? <Eye class="w-3.5 h-3.5" /> : <EyeOff class="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    class="p-1 rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    onClick={() => props.engine.removeModifierFromStack(item.id)}
                    title="Remove Layer"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>

      {/* Add Layer Footer */}
      <div class="pt-2 border-t border-glass-border shrink-0 flex items-center gap-2">
        <Select value={selectedAddType()} onChange={handleAdd}>
          <SelectTrigger class="h-7 text-xs font-mono bg-background/50 border-glass-border flex-1">
            <SelectValue placeholder="+ Add Modifier Layer..." />
          </SelectTrigger>
          <SelectContent class="glass-panel border-glass-border max-h-56">
            <For each={allTypes}>
              {(t) => (
                <SelectItem value={t} class="text-xs font-mono">
                  {t}
                </SelectItem>
              )}
            </For>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
