import { createSignal, Show, For, type Component } from 'solid-js';
import { Sparkles, Wand2, Check, Film, ShieldCheck, Zap } from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import type { DirectorTake } from '@/core/domain/ai-copilot/copilot-types';
import { winterTcCopilotAdapter } from '@/adapters/driving/ai-copilot/wintertc-copilot.adapter';
import type { StoryboardScene } from '@/types/storyboard';

export interface CopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  'Berlin Underground Club: Dark industrial strobe, high sound pressure, raw acid green',
  'Kyoto Zen Garden: Wabi-sabi negative space, stone monolith, contemplative stillness',
  'Swiss International Order: Pure geometric grid, stark contrast, monolithic typography',
  'Tokyo Cyberpunk Neon: Electric cyan, acrylic caustics, chromatic dispersion, 128 BPM',
  'Auteur Theatrical Cinema: Dramatic film grain, anamorphic ratio, slow burn cello drone',
];

export const CopilotModal: Component<CopilotModalProps> = (props) => {
  const studio = useStudio();
  const [prompt, setPrompt] = createSignal('');
  const [isDirecting, setIsDirecting] = createSignal(false);
  const [takes, setTakes] = createSignal<DirectorTake[]>([]);
  const [selectedTakeId, setSelectedTakeId] = createSignal<string | null>(null);

  const handleGenerate = async (customPrompt?: string) => {
    const text = customPrompt ?? prompt();
    if (!text.trim()) return;

    setIsDirecting(true);
    try {
      const generated = await winterTcCopilotAdapter.directConcept(text, studio.state);
      setTakes(generated);
      if (generated.length > 0) {
        setSelectedTakeId(generated[0].id);
      }
    } catch (err: any) {
      studio.triggerToast(`Copilot Error: ${err?.message ?? 'Unknown'}`);
    } finally {
      setIsDirecting(false);
    }
  };

  const handleApplyToStage = (take: DirectorTake) => {
    studio.patchState(take.statePatch);
    studio.triggerToast(`Applied Director Take: "${take.title}"`);
    props.onClose();
  };

  const handleAddToStoryboard = (take: DirectorTake) => {
    const scene: StoryboardScene = {
      id: `scene-ai-${Date.now().toString(36)}`,
      title: take.title,
      durationSec: 4.5,
      archetypeId: take.archetypeId,
      statePatch: take.statePatch,
      transitionOut: {
        type: take.style === 'kinetic-chaos' ? 'glitch-dissolve' : 'cross-dissolve',
        durationSec: 0.8,
        easing: 'expo-out',
      },
    };
    studio.addStoryboardScene(scene);
    studio.triggerToast(`Added "${take.title}" to Storyboard`);
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      maxWidthClass="max-w-5xl"
      title={
        <div class="flex items-center gap-2">
          <Wand2 class="w-4 h-4 text-primary animate-pulse" />
          <h2 class="text-sm font-mono font-bold text-foreground">
            AI CREATIVE DIRECTOR // PROMPT-TO-POSTER CO-PILOT
          </h2>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
            v6.0 WinterTC
          </span>
        </div>
      }
    >
      <div class="p-6 flex flex-col gap-5 max-h-[80vh] overflow-y-auto no-scrollbar">
        {/* Top Input Bar */}
        <div class="flex flex-col gap-2">
          <label class="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
            Natural Language Creative Brief
          </label>
          <div class="flex items-center gap-2">
            <input
              type="text"
              placeholder="e.g. Acid house rave in 1992 Manchester warehouse with neon yellow and industrial grid..."
              value={prompt()}
              onInput={(e) => setPrompt(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleGenerate();
              }}
              class="flex-1 bg-muted/40 border border-border rounded-lg px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary font-sans"
            />
            <Button
              variant="primary"
              size="md"
              onClick={() => handleGenerate()}
              disabled={isDirecting() || !prompt().trim()}
              class="gap-2 px-5 font-bold bg-gradient-to-r from-primary to-accent hover:opacity-95"
            >
              <Sparkles class="w-4 h-4" />
              <span>{isDirecting() ? 'Directing...' : 'Direct Concept'}</span>
            </Button>
          </div>

          {/* Quick Prompt Chips */}
          <div class="flex items-center gap-1.5 flex-wrap pt-1">
            <span class="text-[11px] font-mono text-muted-foreground mr-1">Inspirations:</span>
            <For each={QUICK_PROMPTS}>
              {(qp) => (
                <button
                  type="button"
                  onClick={() => {
                    setPrompt(qp);
                    handleGenerate(qp);
                  }}
                  class="text-[11px] font-mono px-2.5 py-1 rounded-full bg-muted/60 hover:bg-primary/20 text-muted-foreground hover:text-foreground border border-border/70 transition-all cursor-pointer text-left truncate max-w-xs"
                >
                  {qp.split(':')[0]}
                </button>
              )}
            </For>
          </div>
        </div>

        {/* 3-Take Audition Strip */}
        <Show
          when={takes().length > 0}
          fallback={
            <div class="border border-dashed border-border rounded-xl p-10 flex flex-col items-center justify-center text-center gap-2 text-muted-foreground">
              <Sparkles class="w-8 h-8 text-muted-foreground/40" />
              <p class="text-sm font-medium">
                Enter a creative prompt above or select an inspiration to generate 3 Director Takes.
              </p>
              <p class="text-xs text-muted-foreground/70">
                100% offline deterministic rule engine with WCAG 2.2 AA and CMYK TAC pre-press verification.
              </p>
            </div>
          }
        >
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">
                3-Take Audition Strip
              </span>
              <span class="text-xs text-muted-foreground font-mono">
                WCAG 2.2 AA & CMYK TAC Verified
              </span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <For each={takes()}>
                {(take) => {
                  const isSelected = selectedTakeId() === take.id;

                  return (
                    <div
                      onClick={() => setSelectedTakeId(take.id)}
                      class={`border rounded-xl p-4 flex flex-col justify-between gap-3 cursor-pointer transition-all shadow-xs ${
                        isSelected
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                          : 'border-border bg-card hover:border-primary/40'
                      }`}
                    >
                      <div class="flex flex-col gap-2.5">
                        <div class="flex items-center justify-between">
                          <span
                            class={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              take.style === 'minimalist'
                                ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                : take.style === 'avant-garde'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-red-500/15 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {take.style}
                          </span>
                          <Show when={isSelected}>
                            <Check class="w-4 h-4 text-primary" />
                          </Show>
                        </div>

                        <div>
                          <h3 class="text-sm font-bold text-foreground">{take.title}</h3>
                          <p class="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                            {take.rationale}
                          </p>
                        </div>

                        {/* Palette Swatch Strip */}
                        <div class="flex flex-col gap-1 pt-1">
                          <span class="text-[10px] font-mono text-muted-foreground">Harmonic Palette:</span>
                          <div class="flex h-5 rounded overflow-hidden border border-border">
                            <div class="flex-1" style={{ 'background-color': take.palette.bg }} title={`bg: ${take.palette.bg}`} />
                            <div class="flex-1" style={{ 'background-color': take.palette.surface }} title={`surface: ${take.palette.surface}`} />
                            <div class="flex-1" style={{ 'background-color': take.palette.ink }} title={`ink: ${take.palette.ink}`} />
                            <div class="flex-1" style={{ 'background-color': take.palette.accent }} title={`accent: ${take.palette.accent}`} />
                            <div class="flex-1" style={{ 'background-color': take.palette.accent2 }} title={`accent2: ${take.palette.accent2}`} />
                          </div>
                        </div>

                        {/* Design Guard Specs */}
                        <div class="grid grid-cols-2 gap-1.5 text-[11px] font-mono bg-muted/40 p-2 rounded border border-border/50">
                          <div>
                            <span class="text-muted-foreground">Archetype: </span>
                            <strong class="text-foreground truncate block">{take.archetypeId}</strong>
                          </div>
                          <div>
                            <span class="text-muted-foreground">Layout: </span>
                            <strong class="text-foreground truncate block">{take.layoutId}</strong>
                          </div>
                          <div class="flex items-center gap-1">
                            <ShieldCheck class="w-3 h-3 text-emerald-400" />
                            <span class="text-muted-foreground">WCAG: </span>
                            <strong class="text-emerald-400">{take.wcagContrastRatio}:1</strong>
                          </div>
                          <div>
                            <span class="text-muted-foreground">CMYK TAC: </span>
                            <strong class="text-foreground">{take.cmykTacPct}%</strong>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div class="flex items-center gap-2 pt-2 border-t border-border">
                        <Button
                          variant="primary"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApplyToStage(take);
                          }}
                          class="flex-1 gap-1 text-xs"
                        >
                          <Zap class="w-3 h-3" />
                          Apply Stage
                        </Button>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToStoryboard(take);
                          }}
                          class="gap-1 text-xs"
                          title="Append to Multi-Scene Storyboard"
                        >
                          <Film class="w-3 h-3 text-primary" />
                          + Scene
                        </Button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>
        </Show>
      </div>
    </Modal>
  );
};
