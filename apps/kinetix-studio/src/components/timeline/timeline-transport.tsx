import { createSignal, type Component } from 'solid-js';
import { For, Show } from 'solid-js';
import { Play, Pause, RotateCcw, Layers, FastForward, Activity, Film } from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { Button } from '@/components/ui/button';
import { PhaseJumpPills } from './phase-jump-pills';
import { ScrubberBar } from './scrubber-bar';
import { KeyframeTrackEditor } from './keyframe-track-editor';
import { StoryboardDrawer } from './storyboard-drawer';

const SPEEDS = [0.5, 1.0, 2.0];

const LAYERS_TRACK = [
  { key: 'background', label: 'BG' },
  { key: 'shader', label: 'PLATE' },
  { key: 'hero', label: 'HERO' },
  { key: 'typography', label: 'TYPE' },
  { key: 'audio', label: 'AUDIO' },
] as const;

export const TimelineTransport: Component = () => {
  const studio = useStudio();
  const [showKeyframeEditor, setShowKeyframeEditor] = createSignal(false);

  return (
    <div class="border-t border-border bg-card text-card-foreground px-4 py-2 flex flex-col gap-1.5 shrink-0 select-none">
      {/* Top Transport & Multi-Track Header (Fluid Single-Row Deck) */}
      <div class="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar py-0.5 min-w-0">
        {/* Left: Playback & Frame Cadence */}
        <div class="flex items-center gap-1.5">
          <Button
            variant="primary"
            size="xs"
            onClick={() => studio.setIsPlaying((p) => !p)}
          >
            <Show
              when={studio.isPlaying}
              fallback={
                <>
                  <Play class="w-3 h-3" /> Play
                </>
              }
            >
              <Pause class="w-3 h-3" /> Pause
            </Show>
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              studio.setIsPlaying(false);
              studio.setCurrentFrame(0);
            }}
            title="Reset to frame 0"
          >
            <RotateCcw class="w-3 h-3" />
          </Button>
          <span class="text-xs font-mono text-muted-foreground ml-1">
            Frame{' '}
            <strong class="text-foreground">
              {String(studio.currentFrame).padStart(3, '0')}
            </strong>{' '}
            / {studio.totalFrames} ({(studio.rawProgress * studio.state.durationSec).toFixed(1)}s)
          </span>

          {/* Speed Selector (0.5x, 1x, 2x) */}
          <div class="flex items-center ml-2 border-l border-border pl-2 gap-1">
            <FastForward class="w-3 h-3 text-muted-foreground" />
            <For each={SPEEDS}>
              {(spd) => (
                <button
                  type="button"
                  onClick={() => studio.setPlaybackSpeed(spd)}
                  class={`px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                    studio.state.playbackSpeed === spd
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'bg-card text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {spd}x
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Center: Multi-Track Layer Solo / Mute Toggles */}
        <div class="flex items-center gap-1 bg-muted/50 p-0.5 rounded border border-border">
          <Layers class="w-3 h-3 text-muted-foreground ml-1 mr-0.5" />
          <For each={LAYERS_TRACK}>
            {({ key, label }) => {
              const isVisible = () => studio.state.layerVisibility[key];
              return (
                <button
                  type="button"
                  onClick={() => studio.toggleLayerVisibility(key)}
                  class={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer ${
                    isVisible()
                      ? 'bg-card text-card-foreground border border-border hover:bg-accent'
                      : 'bg-destructive/15 text-destructive border border-destructive/30 line-through'
                  }`}
                  title={`Toggle Layer ${label}`}
                >
                  {label}
                </button>
              );
            }}
          </For>
        </div>

        {/* Right: Phase Jump Pills & Keyframe Splines & Storyboard */}
        <div class="flex items-center gap-1.5">
          <PhaseJumpPills />
          <Button
            variant={showKeyframeEditor() ? 'primary' : 'ghost'}
            size="xs"
            onClick={() => setShowKeyframeEditor((v) => !v)}
            class="text-xs gap-1 px-2.5 py-1"
            title="Toggle Bezier Spline Keyframe Deck"
          >
            <Activity class="w-3 h-3 text-cyan-400" />
            <span>Splines</span>
            {studio.state.choreoMode === 'custom-keyframe' && (
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </Button>

          <Button
            variant={studio.state.isStoryboardMode ? 'primary' : 'ghost'}
            size="xs"
            onClick={() => studio.toggleStoryboardMode()}
            class="text-xs gap-1 px-2.5 py-1"
            title="Toggle Multi-Scene Storyboard Sequencer"
          >
            <Film class="w-3 h-3 text-amber-400" />
            <span>Storyboard</span>
            {studio.state.isStoryboardMode && (
              <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Expandable Multi-Scene Storyboard Sequencer */}
      <Show when={studio.state.isStoryboardMode}>
        <StoryboardDrawer />
      </Show>

      {/* Expandable Bezier Spline Keyframe Track Editor */}
      <Show when={showKeyframeEditor()}>
        <div class="border border-border rounded-lg p-2.5 bg-background/80 backdrop-blur-sm transition-all duration-200">
          <KeyframeTrackEditor />
        </div>
      </Show>

      {/* Bottom: Frame Scrubber Bar */}
      <ScrubberBar />
    </div>
  );
};
