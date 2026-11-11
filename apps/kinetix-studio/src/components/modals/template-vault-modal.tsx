import { createSignal, createMemo, Show, For, Component } from 'solid-js';
import { Sparkles, Film, Bookmark, Trash2 } from 'lucide-solid';
import type { TemplatePreset } from '@/types/preset';
import { useStudio } from '@/context/studio-context';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TEMPLATE_VAULT } from '@/constants/template-vault';
import { cn } from '@/lib/utils';

export interface TemplateVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onQuickVideoRender: (preset: TemplatePreset) => void;
}

export const TemplateVaultModal: Component<TemplateVaultModalProps> = (props) => {
  const studio = useStudio();
  const [filter, setFilter] = createSignal<
    'All' | 'My Presets' | 'Music' | 'Fashion' | 'Tech' | 'Cinema'
  >('All');

  const filteredVault = createMemo(() => {
    const f = filter();
    if (f === 'All') return TEMPLATE_VAULT;
    if (f === 'My Presets') return [];
    return TEMPLATE_VAULT.filter((t) => t.category === f);
  });

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      maxWidthClass="max-w-5xl"
      title={
        <div class="flex items-center gap-2">
          <Sparkles class="w-4 h-4 text-primary" />
          <h2 class="text-sm font-mono font-bold text-foreground">
            STUDIO TEMPLATE VAULT // {TEMPLATE_VAULT.length + studio.userPresets.length} PRODUCTIONS
          </h2>
        </div>
      }
      headerActions={
        <div class="flex items-center gap-1.5 mr-2">
          <For
            each={
              ['All', 'My Presets', 'Music', 'Fashion', 'Tech', 'Cinema'] as const
            }
          >
            {(cat) => {
              const isActive = () => filter() === cat;
              return (
                <button
                  type="button"
                  onClick={() => setFilter(cat)}
                  class={cn(
                    'px-3 py-1.5 rounded text-xs font-mono font-medium cursor-pointer transition-colors',
                    isActive()
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'bg-card text-muted-foreground hover:text-foreground'
                  )}
                >
                  {cat === 'My Presets'
                    ? `★ My Presets (${studio.userPresets.length})`
                    : cat}
                </button>
              );
            }}
          </For>
        </div>
      }
    >
      <Show
        when={filter() === 'My Presets'}
        fallback={
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <For each={filteredVault()}>
              {(preset) => (
                <div class="p-3 rounded-lg bg-card border border-border hover:border-primary/50 flex flex-col justify-between gap-2.5 transition-all">
                  <div>
                    <div class="flex items-center justify-between gap-1 mb-1">
                      <Badge variant="lime">{preset.category}</Badge>
                      <span class="text-[11px] font-mono font-medium text-muted-foreground">
                        {preset.badge}
                      </span>
                    </div>
                    <div class="text-xs font-bold text-foreground">
                      {preset.title}
                    </div>
                    <div class="text-xs font-mono text-muted-foreground mt-1">
                      {preset.statePatch.content?.headline.join(' • ')}
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 pt-2 border-t border-border">
                    <Button
                      variant="secondary"
                      size="xs"
                      class="flex-1"
                      onClick={() => {
                        studio.patchState(preset.statePatch);
                        props.onClose();
                        studio.triggerToast(`Loaded Preset: ${preset.title}`);
                      }}
                    >
                      Load in Studio
                    </Button>
                    <Button
                      variant="accent"
                      size="xs"
                      onClick={() => {
                        props.onClose();
                        props.onQuickVideoRender(preset);
                      }}
                      title="1-Click Video Render from this Preset"
                    >
                      <Film class="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </For>
          </div>
        }
      >
        <Show
          when={studio.userPresets.length > 0}
          fallback={
            <div class="py-12 text-center text-muted-foreground font-mono text-xs flex flex-col items-center gap-2">
              <Bookmark class="w-8 h-8 text-muted-foreground/80 mb-1" />
              <div>No saved user presets found in browser storage.</div>
              <div class="text-xs text-muted-foreground">
                Customize your design and save a preset in the "1. Config" inspector tab!
              </div>
            </div>
          }
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <For each={studio.userPresets}>
              {(preset) => (
                <div class="p-3 rounded-lg bg-card border border-border hover:border-primary/50 flex flex-col justify-between gap-2.5 transition-all">
                  <div>
                    <div class="flex items-center justify-between gap-1 mb-1">
                      <Badge variant="cyan">{preset.category}</Badge>
                      <span class="text-[11px] font-mono font-medium text-muted-foreground">
                        {new Date(preset.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div class="text-xs font-bold text-foreground">
                      {preset.title}
                    </div>
                    <div class="text-xs font-mono text-muted-foreground mt-1">
                      {preset.statePatch.content?.headline?.join(' • ') ??
                        'Custom Layout'}
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 pt-2 border-t border-border">
                    <Button
                      variant="secondary"
                      size="xs"
                      class="flex-1"
                      onClick={() => {
                        studio.patchState(preset.statePatch);
                        props.onClose();
                        studio.triggerToast(`Loaded Preset: ${preset.title}`);
                      }}
                    >
                      Load in Studio
                    </Button>
                    <Button
                      variant="accent"
                      size="xs"
                      onClick={() => {
                        props.onClose();
                        props.onQuickVideoRender(preset as unknown as TemplatePreset);
                      }}
                      title="1-Click Video Render from this Preset"
                    >
                      <Film class="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => studio.deleteCustomPreset(preset.id)}
                      class="text-red-400 hover:text-red-300 px-1.5"
                      title="Delete Preset"
                    >
                      <Trash2 class="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </Modal>
  );
};
