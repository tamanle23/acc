import { createSignal, For, Show, type Component } from 'solid-js';
import {
  Film,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  Clock,
  ArrowRightLeft,
  Copy,
} from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { Button } from '@/components/ui/button';
import { STORYBOARD_PRESETS } from '@/constants/storyboard-presets';
import { TransitionPickerPopover } from './transition-picker-popover';
import type { StoryboardScene } from '@/types/storyboard';
import { exportStoryboardBatchAspects } from '@/lib/batch-aspect-exporter';

export const StoryboardDrawer: Component = () => {
  const studio = useStudio();
  const [isExporting, setIsExporting] = createSignal(false);
  const [exportStatus, setExportStatus] = createSignal<string | null>(null);
  const [selectedSceneForTransition, setSelectedSceneForTransition] = createSignal<string | null>(null);

  const handleAddScene = () => {
    const newIndex = studio.storyboard.sceneCount + 1;
    const newScene: StoryboardScene = {
      id: `scene-${Date.now().toString(36)}`,
      title: `Act ${newIndex}: Narrative Beat`,
      durationSec: 4.0,
      archetypeId: studio.state.archetypeId,
      statePatch: {
        content: {
          headline: ['NEW', 'SCENE', 'ARRIVED'],
          subhead: 'NARRATIVE EXPANSION',
          date: `ACT 0${newIndex} // 00:00:00`,
          location: 'STUDIO STAGE',
          tag: 'STORYBOARD',
          sponsor: 'KINETIX SEQUENCER',
        },
      },
      transitionOut: {
        type: 'cross-dissolve',
        durationSec: 0.8,
        easing: 'linear-sine',
      },
    };
    studio.addStoryboardScene(newScene);
  };

  const handleBatchExport = async () => {
    if (isExporting()) return;
    setIsExporting(true);
    setExportStatus('Rendering 9:16, 16:9, 1:1...');

    try {
      await exportStoryboardBatchAspects({
        sequence: studio.storyboard,
        baseState: studio.state,
        aspectRatios: ['9:16', '16:9', '1:1'],
        autoDownload: true,
        onProgress: (ratio, _, overall) => {
          setExportStatus(`Exporting ${ratio} (${Math.round(overall * 100)}%)`);
        },
      });
      studio.triggerToast('🎉 Multi-Aspect Batch Export Complete!');
    } catch (err: any) {
      studio.triggerToast(`Export error: ${err?.message ?? 'Unknown'}`);
    } finally {
      setIsExporting(false);
      setExportStatus(null);
    }
  };

  return (
    <div class="border-b border-border bg-card/95 backdrop-blur-md px-4 py-3 flex flex-col gap-2.5 shadow-lg select-none">
      {/* Header Bar: Presets & Batch Exporter */}
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2">
          <Film class="w-4 h-4 text-primary" />
          <span class="text-xs font-bold tracking-wider uppercase text-foreground">
            Storyboard Sequencer
          </span>
          <span class="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground flex items-center gap-1">
            <Clock class="w-3 h-3" />
            Total: {studio.storyboard.totalDurationSec.toFixed(1)}s ({studio.storyboard.sceneCount} Acts)
          </span>
        </div>

        {/* Preset Selector & Action Buttons */}
        <div class="flex items-center gap-2">
          <select
            class="text-xs bg-muted/60 border border-border rounded px-2 py-1 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            value={studio.state.activeSequenceId ?? ''}
            onChange={(e) => studio.loadStoryboardPreset(e.currentTarget.value)}
          >
            <For each={STORYBOARD_PRESETS}>
              {(preset) => (
                <option value={preset.id}>
                  Template: {preset.title}
                </option>
              )}
            </For>
          </select>

          <Button
            variant="outline"
            size="xs"
            onClick={handleAddScene}
            class="gap-1 text-xs"
          >
            <Plus class="w-3 h-3 text-primary" />
            Add Scene
          </Button>

          <Button
            variant="primary"
            size="xs"
            onClick={handleBatchExport}
            disabled={isExporting()}
            class="gap-1 text-xs font-semibold bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            <Download class="w-3 h-3" />
            {isExporting() ? (exportStatus() ?? 'Rendering...') : 'Batch Export (3 Ratios)'}
          </Button>
        </div>
      </div>

      {/* Active Act Editing Notification Banner */}
      <Show when={studio.state.isStoryboardMode && studio.storyboard.scenes.length > 0}>
        {(() => {
          const scenes = studio.storyboard.scenes;
          const currentId = studio.selectedSceneId ?? scenes[0]?.id;
          const activeIndex = Math.max(0, scenes.findIndex((s) => s.id === currentId));
          const activeScene = scenes[activeIndex] ?? scenes[0];
          if (!activeScene) return null;

          return (
            <div class="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-primary/10 border border-primary/25 text-xs font-mono text-primary shadow-xs">
              <div class="flex items-center gap-2 flex-wrap">
                <Film class="w-3.5 h-3.5 shrink-0" />
                <span class="font-bold">
                  Editing Act 0{activeIndex + 1}: &ldquo;{activeScene.title}&rdquo;
                </span>
                <span class="text-[10px] text-muted-foreground hidden sm:inline">
                  • Click any card to switch active editing scene
                </span>
              </div>
              <div class="flex items-center gap-2 text-[10px] text-primary font-semibold">
                <span class="bg-primary/15 px-1.5 py-0.5 rounded border border-primary/30">
                  {activeScene.archetypeId}
                </span>
                <span class="text-muted-foreground">|</span>
                <span>{activeScene.durationSec.toFixed(1)}s</span>
              </div>
            </div>
          );
        })()}
      </Show>

      {/* Horizontal Multi-Scene Strip */}
      <div class="flex items-stretch gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar">
        <For each={studio.storyboard.scenes}>
          {(scene, idx) => {
            const isLast = idx() === studio.storyboard.scenes.length - 1;
            const isSelected = () => studio.selectedSceneId === scene.id;

            return (
              <div class="flex items-center gap-2 shrink-0">
                {/* Scene Card */}
                <div
                  onClick={() => studio.selectStoryboardScene(scene.id)}
                  class={`w-56 bg-background border rounded-lg p-2.5 flex flex-col gap-2 transition-all shadow-xs cursor-pointer ${
                    isSelected()
                      ? 'ring-2 ring-primary border-primary bg-primary/5 shadow-md'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div class="flex items-center justify-between gap-1">
                    <span
                      class={`text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        isSelected()
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground bg-muted'
                      }`}
                    >
                      Act 0{idx() + 1}
                    </span>
                    <div class="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          studio.duplicateStoryboardScene(scene.id);
                        }}
                        class="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
                        title="Duplicate Act"
                      >
                        <Copy class="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          studio.reorderStoryboardScenes(idx(), Math.max(0, idx() - 1));
                        }}
                        disabled={idx() === 0}
                        class="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 cursor-pointer"
                        title="Move Scene Left"
                      >
                        <ChevronLeft class="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          studio.reorderStoryboardScenes(idx(), Math.min(studio.storyboard.sceneCount - 1, idx() + 1));
                        }}
                        disabled={isLast}
                        class="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 cursor-pointer"
                        title="Move Scene Right"
                      >
                        <ChevronRight class="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          studio.removeStoryboardScene(scene.id);
                        }}
                        disabled={studio.storyboard.sceneCount <= 1}
                        class="p-1 rounded hover:bg-destructive/20 text-destructive disabled:opacity-30 cursor-pointer ml-1"
                        title="Delete Scene"
                      >
                        <Trash2 class="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Scene Title Input */}
                  <input
                    type="text"
                    value={scene.title}
                    onClick={(e) => e.stopPropagation()}
                    onInput={(e) =>
                      studio.updateStoryboardScene(scene.id, { title: e.currentTarget.value })
                    }
                    class="text-xs font-semibold bg-muted/30 border border-border/50 rounded px-1.5 py-0.5 text-foreground focus:outline-none focus:border-primary"
                  />

                  {/* Archetype & Duration Controls */}
                  <div class="flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span class="text-primary truncate max-w-[110px]" title={scene.archetypeId}>
                      {scene.archetypeId ?? studio.state.archetypeId}
                    </span>
                    <div class="flex items-center gap-1 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                      <Clock class="w-3 h-3" />
                      <input
                        type="number"
                        min="1"
                        max="30"
                        step="0.5"
                        value={scene.durationSec}
                        onInput={(e) => {
                          const val = parseFloat(e.currentTarget.value);
                          if (!isNaN(val) && val > 0) {
                            studio.updateStoryboardScene(scene.id, { durationSec: val });
                          }
                        }}
                        class="w-12 text-right bg-muted/30 border border-border/50 rounded px-1 py-0.5 text-foreground focus:outline-none"
                      />
                      <span>s</span>
                    </div>
                  </div>
                </div>

                {/* Transition Connector Badge (Always visible, connects to next or loops to Act 1) */}
                {(() => {
                  let buttonRef: HTMLButtonElement | undefined;

                  return (
                    <div class="flex flex-col items-center justify-center relative">
                      <button
                        ref={buttonRef}
                        type="button"
                        onClick={() =>
                          setSelectedSceneForTransition(
                            selectedSceneForTransition() === scene.id ? null : scene.id
                          )
                        }
                        class={`px-2 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 border transition-all cursor-pointer shadow-xs ${
                          selectedSceneForTransition() === scene.id
                            ? 'bg-primary text-primary-foreground border-primary'
                            : isLast
                            ? 'bg-accent/20 hover:bg-accent/40 text-accent border-dashed border-accent/50'
                            : 'bg-muted hover:bg-accent text-muted-foreground hover:text-foreground border-border'
                        }`}
                        title={isLast ? 'Configure Loop Transition Back to Act 1' : 'Change Transition to Next Scene'}
                      >
                        <ArrowRightLeft class="w-2.5 h-2.5" />
                        <span>
                          {isLast
                            ? `Loop: ${scene.transitionOut?.type ?? 'cross-dissolve'}`
                            : (scene.transitionOut?.type ?? 'cross-dissolve')}
                        </span>
                      </button>

                      {/* Enhanced Reusable Transition Picker Popover */}
                      <TransitionPickerPopover
                        isOpen={selectedSceneForTransition() === scene.id}
                        onClose={() => setSelectedSceneForTransition(null)}
                        anchorRef={buttonRef}
                        scene={scene}
                        actIndex={idx()}
                        isLast={isLast}
                        onUpdateTransition={(transition) => {
                          studio.updateStoryboardScene(scene.id, { transitionOut: transition });
                        }}
                      />
                    </div>
                  );
                })()}
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
};
