import { createSignal, createMemo, For, Show } from 'solid-js';
import {
  Layers,
  Code2,
  Search,
  X,
  Copy,
  Check,
  PlusCircle,
  Plus,
  Sparkles,
  Film,
  Activity,
  Type,
  Square,
  Scissors,
  Volume2,
} from 'lucide-solid';
import { Input } from '../../../ui/input';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { ShikiCodeViewer } from '../../code-editor/ShikiCodeViewer';
import { ModifierPluginRegistry, type ModifierPlugin } from '@acc/ir';
import type { PlaygroundEngine } from '../usePlaygroundEngine';

export interface BentoCatalogAndJsonProps {
  engine: PlaygroundEngine;
  class?: string;
}

type TabType = 'catalog' | 'json';

type CatalogCategory =
  | 'all'
  | 'vfx'
  | 'overlay'
  | 'time_space'
  | 'motion'
  | 'text'
  | 'shapes'
  | 'editorial'
  | 'audio';

interface PluginCardItem {
  type: string;
  name: string;
  category: CatalogCategory;
  categoryLabel: string;
  plugin: ModifierPlugin<any>;
}

export function BentoCatalogAndJson(props: BentoCatalogAndJsonProps) {
  const { state, generatedModifierNode } = props.engine;
  const [activeTab, setActiveTab] = createSignal<TabType>('catalog');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [activeCategory, setActiveCategory] = createSignal<CatalogCategory>('all');
  const [copiedNotification, setCopiedNotification] = createSignal(false);
  const [applyFeedback, setApplyFeedback] = createSignal<string | null>(null);
  const [jsonScope, setJsonScope] = createSignal<'active' | 'stack'>('active');

  const registry = ModifierPluginRegistry.getInstance();

  const categorizeType = (type: string, plugin: ModifierPlugin<any>): { category: CatalogCategory; label: string } => {
    const pCat = plugin.schema?.category;
    if (pCat === 'vfx' || type.startsWith('vfx/')) return { category: 'vfx', label: 'VFX' };
    if (
      pCat === 'overlay' ||
      type.startsWith('overlay/') ||
      type.startsWith('generator/') ||
      type.startsWith('timeline/')
    ) {
      return { category: 'overlay', label: 'Overlays' };
    }
    if (pCat === 'time_space' || type.startsWith('time_space')) return { category: 'time_space', label: 'TimeSpace' };
    if (pCat === 'motion' || type.startsWith('motion/') || type === 'transform') return { category: 'motion', label: 'Motion' };
    if (pCat === 'text' || pCat === 'typography' || type.startsWith('text/') || type.startsWith('timed_text/')) {
      return { category: 'text', label: 'Text' };
    }
    if (pCat === 'shapes' || type.startsWith('shape/')) return { category: 'shapes', label: 'Shapes' };
    if (pCat === 'editorial' || type.startsWith('editorial/') || type.startsWith('transition/') || type === 'transition') {
      return { category: 'editorial', label: 'Editorial' };
    }
    if (pCat === 'audio' || pCat === 'sfx' || type.startsWith('audio/') || type.startsWith('sfx/')) {
      return { category: 'audio', label: 'Audio' };
    }
    return { category: 'vfx', label: 'VFX' };
  };

  const allPluginItems = createMemo<PluginCardItem[]>(() => {
    const types = registry.listTypes();
    return types.map((type) => {
      const plugin = registry.get(type)!;
      const { category, label } = categorizeType(type, plugin);
      const name =
        plugin.schema?.displayName ||
        type
          .split('/')
          .pop()!
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
      return {
        type,
        name,
        category,
        categoryLabel: label,
        plugin,
      };
    });
  });

  const filteredPlugins = createMemo(() => {
    const q = searchQuery().toLowerCase().trim();
    const cat = activeCategory();

    return allPluginItems().filter((item) => {
      const matchesCat = cat === 'all' || item.category === cat;
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        (item.plugin.schema?.description && item.plugin.schema.description.toLowerCase().includes(q));
      return matchesCat && matchesQuery;
    });
  });

  const displayedJson = () => {
    if (jsonScope() === 'stack' && state.modifierStack.length > 0) {
      return JSON.stringify(
        {
          version: '1.0',
          type: 'modifier_pipeline_stack',
          layers: state.modifierStack,
        },
        null,
        2
      );
    }
    return JSON.stringify(generatedModifierNode(), null, 2);
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(displayedJson());
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2000);
    } catch (e) {
      console.error('Failed to copy JSON:', e);
    }
  };

  const handleApplyToStudio = () => {
    const res = props.engine.applyToActiveSequence();
    setApplyFeedback(res.message);
    setTimeout(() => setApplyFeedback(null), 3000);
  };

  return (
    <div
      class={`flex flex-col h-full w-full min-h-0 min-w-0 glass-panel rounded-2xl border border-[var(--glass-border)] border-t-[var(--glass-border-highlight)] bg-glass-surface/50 backdrop-blur-xl shadow-lg p-2.5 transition-all duration-200 overflow-hidden select-none ${
        props.class || ''
      }`}
    >
      {/* Header with Tab switcher */}
      <div class="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-glass-border shrink-0">
        <div class="flex items-center rounded-lg bg-background/40 p-0.5 border border-glass-border text-xs font-mono">
          <button
            type="button"
            class={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab() === 'catalog'
                ? 'bg-accent-theme/20 text-accent-theme font-bold border border-accent-theme/30'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('catalog')}
          >
            <Layers class="h-3.5 w-3.5" />
            <span>Catalog ({allPluginItems().length})</span>
          </button>
          <button
            type="button"
            class={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
              activeTab() === 'json'
                ? 'bg-accent-theme/20 text-accent-theme font-bold border border-accent-theme/30'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('json')}
          >
            <Code2 class="h-3.5 w-3.5" />
            <span>VideoIR JSON</span>
          </button>
        </div>

        {/* Apply feedback badge */}
        <Show when={applyFeedback()}>
          {(msg) => (
            <span class="text-[10px] font-mono text-accent-theme animate-pulse truncate max-w-[140px]">{msg()}</span>
          )}
        </Show>
      </div>

      {/* Tab 1: Catalog View */}
      <Show when={activeTab() === 'catalog'}>
        <div class="flex flex-col flex-1 min-h-0">
          {/* Search Bar */}
          <div class="relative mb-2 shrink-0">
            <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search plugins & effects..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.currentTarget.value)}
              class="h-7 text-xs pl-8 pr-7 bg-background/50 border-glass-border rounded-lg text-foreground placeholder:text-muted-foreground focus-visible:ring-accent-theme/40"
            />
            <Show when={searchQuery()}>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </Show>
          </div>

          {/* Category Filter Chips */}
          <div class="flex items-center gap-1 overflow-x-auto pb-1.5 mb-2 no-scrollbar shrink-0">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'vfx', label: 'VFX' },
                { id: 'overlay', label: 'Overlays' },
                { id: 'motion', label: 'Motion' },
                { id: 'time_space', label: 'Time' },
                { id: 'text', label: 'Text' },
                { id: 'shapes', label: 'Shapes' },
                { id: 'editorial', label: 'Editorial' },
                { id: 'audio', label: 'Audio' },
              ] as const
            ).map((cat) => (
              <button
                type="button"
                onClick={() => setActiveCategory(cat.id as CatalogCategory)}
                class={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap border transition-all ${
                  activeCategory() === cat.id
                    ? 'bg-accent-theme/20 text-accent-theme border-accent-theme/40 font-semibold'
                    : 'bg-glass-surface/40 text-muted-foreground border-glass-border hover:text-foreground hover:bg-glass-surface'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Plugin Items List */}
          <div class="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            <For
              each={filteredPlugins()}
              fallback={
                <div class="p-4 text-center text-xs text-muted-foreground font-mono">No matching plugins found.</div>
              }
            >
              {(item) => {
                const isSelected = () => state.selectedPluginType === item.type;
                return (
                  <div
                    class={`group flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-all duration-150 ${
                      isSelected()
                        ? 'bg-accent-theme/15 border-accent-theme/50 shadow-accent-glow text-foreground'
                        : 'bg-background/50 border-glass-border text-foreground hover:border-accent-theme/40 hover:bg-glass-surface'
                    }`}
                    onClick={() => props.engine.selectPlugin(item.type)}
                  >
                    <div class="flex items-center gap-2 min-w-0">
                      <div
                        class={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 border ${
                          isSelected()
                            ? 'bg-accent-theme/20 text-accent-theme border-accent-theme/40'
                            : 'bg-glass-surface text-muted-foreground border-glass-border group-hover:text-foreground'
                        }`}
                      >
                        <Sparkles class="h-3 w-3" />
                      </div>
                      <div class="min-w-0">
                        <div class="font-medium truncate group-hover:text-foreground leading-tight">{item.name}</div>
                        <div class="text-[9px] font-mono text-muted-foreground truncate">{item.type}</div>
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" class="text-[9px] py-0 px-1.5 h-4 border-glass-border text-muted-foreground">
                        {item.categoryLabel}
                      </Badge>
                      {/* Add to Stack Button */}
                      <button
                        type="button"
                        title="Add as Layer to Stack"
                        onClick={(e) => {
                          e.stopPropagation();
                          props.engine.addModifierToStack(item.type);
                        }}
                        class="p-1 rounded hover:bg-accent-theme/20 text-muted-foreground hover:text-accent-theme transition-colors"
                      >
                        <Plus class="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* Tab 2: Shiki JSON View */}
      <Show when={activeTab() === 'json'}>
        <div class="flex flex-col flex-1 min-h-0">
          {/* JSON Controls Bar */}
          <div class="flex items-center justify-between mb-2 shrink-0">
            <div class="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setJsonScope('active')}
                class={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  jsonScope() === 'active'
                    ? 'bg-accent-theme/20 text-accent-theme border-accent-theme/40 font-bold'
                    : 'bg-glass-surface/40 text-muted-foreground border-glass-border hover:text-foreground'
                }`}
              >
                Active Node
              </button>
              <button
                type="button"
                onClick={() => setJsonScope('stack')}
                class={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                  jsonScope() === 'stack'
                    ? 'bg-accent-theme/20 text-accent-theme border-accent-theme/40 font-bold'
                    : 'bg-glass-surface/40 text-muted-foreground border-glass-border hover:text-foreground'
                }`}
              >
                Stack ({state.modifierStack.length})
              </button>
            </div>

            <Button
              size="sm"
              variant="ghost"
              class="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground hover:bg-glass-surface flex items-center gap-1 border border-glass-border"
              onClick={handleCopyJson}
            >
              <Show when={copiedNotification()} fallback={<Copy class="h-3 w-3" />}>
                <Check class="h-3 w-3 text-emerald-400" />
              </Show>
              <span>{copiedNotification() ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>

          {/* Shiki Code Viewer Container */}
          <div class="flex-1 min-h-[140px] rounded-xl overflow-hidden border border-glass-border bg-background/80 relative">
            <ShikiCodeViewer
              code={displayedJson()}
              readOnly={true}
              onChange={() => {}}
              class="h-full w-full"
            />
          </div>

          {/* Bottom Commit Action */}
          <div class="mt-2 pt-2 border-t border-glass-border flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              class="w-full h-8 text-xs font-semibold bg-accent-theme hover:bg-accent-theme/90 text-primary-foreground shadow-accent-glow flex items-center justify-center gap-1.5"
              onClick={handleApplyToStudio}
            >
              <PlusCircle class="h-3.5 w-3.5" />
              <span>
                {state.modifierStack.length > 0 ? `Commit Stack (${state.modifierStack.length}) to Studio` : 'Apply to Active Sequence'}
              </span>
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
}
