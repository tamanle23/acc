import { createSignal, createEffect, createMemo, Show, For, Component } from 'solid-js';
import {
  Sparkles,
  RotateCcw,
  Palette,
  Layers,
  Wand2,
  Volume2,
  Share2,
  Download,
  Upload,
  Check,
  Trash2,
  Code2,
  BookmarkPlus,
  RefreshCw,
  Maximize2,
  Cpu,
  Music,
  Radio,
  FileAudio,
} from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SwitchRow } from '@/components/ui/switch-row';
import {
  shufflePalette,
  shuffleLayout,
  shuffleAesthetics,
  shuffleAudio,
  shuffleAll,
} from '@/lib/config-engine';
import { generateDeclarativeSchema } from '@/lib/schema';
import type { AspectRatio } from '@/types/spatial';
import type { SubsystemId } from '@/types/studio';
import { probeRenderBackendCapabilities } from '@/engine/webgpu/webgpu-probe';
import { webGpuShaderBridge } from '@/engine/shaders/webgpu-bridge';
import type { RenderBackendCapabilities } from '@/core/ports/driven/render-backend.port';
import { userAudioTrack } from '@/engine/audio-user-track';
import { MEDIA_CATALOG } from '@/constants/media-catalog';
import { SYNTH_PATTERNS } from '@/engine/audio-synth';
import { cn } from '@/lib/utils';

export interface ConfigTabProps {
  onOpenMediaVault?: () => void;
}

export const ConfigTab: Component<ConfigTabProps> = (props) => {
  const studio = useStudio();
  const {
    state,
    patchState,
    resetSubsystem,
    resetState,
    saveCustomPreset,
    loadCustomPreset,
    deleteCustomPreset,
    applyDeclarativeContract,
    copyShareUrl,
    triggerToast,
    handleToggleBpmSynth,
    triggerAnalogSynthBeat,
  } = studio;

  let audioInputRef: HTMLInputElement | undefined;

  const [newPresetTitle, setNewPresetTitle] = createSignal<string>('');
  const [jsonText, setJsonText] = createSignal<string>('');
  const [jsonEditorOpen, setJsonEditorOpen] = createSignal<boolean>(false);
  const [jsonError, setJsonError] = createSignal<string | null>(null);
  const [gpuCaps, setGpuCaps] = createSignal<RenderBackendCapabilities | null>(null);

  createEffect(() => {
    probeRenderBackendCapabilities().then((caps) => {
      setGpuCaps(caps);
    });
  });

  const activeAudioStem = createMemo(() => {
    if (state.activeMediaAssetId) {
      return MEDIA_CATALOG.find((m) => m.id === state.activeMediaAssetId && m.mediaType === 'audio');
    }
    return null;
  });

  const handleAudioUpload = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    try {
      triggerToast('Decoding Audio & Analyzing 3-Band Frequency Stems...');
      await userAudioTrack.loadAudioFile(file);
      patchState({
        audioSource: 'user-file',
        userAudioKey: `audio_${Date.now()}`,
        audioReactive: true,
      });
      triggerToast(`Loaded Audio Track: ${file.name}`);
    } catch {
      triggerToast('Failed to decode audio file');
    }
  };

  const handleResetAudio = () => {
    userAudioTrack.stop();
    patchState({
      audioSource: 'synth',
      userAudioKey: null,
    });
    triggerToast('Switched back to Procedural Web Audio Synth');
  };

  // Handle Export Config JSON Download
  const handleExportJson = () => {
    const jsonStr = generateDeclarativeSchema(state, studio.wcagContrast);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kinetix_${state.archetypeId}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    triggerToast('Exported Studio Configuration (.json)');
  };

  // Handle Import Config JSON File
  const handleImportFile = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const result = applyDeclarativeContract(content);
        if (result.success) {
          triggerToast(`Imported Config: ${file.name}`);
        } else {
          triggerToast(`Import failed: ${result.error}`);
        }
      }
    };
    reader.readAsText(file);
    target.value = '';
  };

  // Handle Live JSON Apply
  const handleApplyJson = () => {
    if (!jsonText().trim()) return;
    const result = applyDeclarativeContract(jsonText());
    if (result.success) {
      setJsonError(null);
      triggerToast('Applied Declarative Contract');
    } else {
      setJsonError(result.error ?? 'Failed to apply schema');
    }
  };

  return (
    <div class="space-y-4 w-full min-w-0">
      {/* SECTION 1: GLOBAL TARGET FORMAT & ASPECT RATIO */}
      <div class="p-3 rounded-lg bg-card border border-border space-y-2.5 text-card-foreground">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <Maximize2 class="w-3.5 h-3.5 text-primary" />
            <span class="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
              Target Format Aspect Ratio
            </span>
          </div>
          <Badge variant="amber" class="text-[9px] py-0 px-1 font-bold">GLOBAL TIMELINE</Badge>
        </div>

        <div class="grid grid-cols-4 gap-1.5">
          <For each={['9:16', '4:5', '1:1', '16:9'] as AspectRatio[]}>
            {(ratio) => {
              const isActive = () => state.aspectRatio === ratio;
              return (
                <button
                  type="button"
                  onClick={() => {
                    patchState({ aspectRatio: ratio });
                    triggerToast(`Aspect Ratio: ${ratio}`);
                  }}
                  class={cn(
                    'py-2 px-1 rounded border text-center font-mono text-xs transition-all cursor-pointer min-w-0',
                    isActive()
                      ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                      : 'bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  <div class="truncate font-bold">{ratio}</div>
                  <div class="text-[10px] text-muted-foreground truncate mt-0.5">
                    {ratio === '9:16'
                      ? 'Reels'
                      : ratio === '4:5'
                      ? 'Feed'
                      : ratio === '1:1'
                      ? 'Square'
                      : 'Landscape'}
                  </div>
                </button>
              );
            }}
          </For>
        </div>
      </div>

      {/* SECTION 2: AUDIO SOUNDSCAPE & STEM INGESTION */}
      <div class="p-3 rounded-lg bg-card border border-border space-y-2.5 text-card-foreground">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <Music class="w-3.5 h-3.5 text-emerald-400" />
            <span class="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
              Audio Soundscape & Reactivity
            </span>
          </div>
          <Badge variant="amber" class="text-[9px] py-0 px-1 font-bold">GLOBAL TIMELINE</Badge>
        </div>

        {/* Audio Mode Tabs */}
        <div class="grid grid-cols-2 gap-1 p-0.5 rounded bg-muted/60 border border-border text-xs font-mono">
          <button
            type="button"
            onClick={handleResetAudio}
            class={`py-1 rounded text-center transition-colors cursor-pointer ${
              state.audioSource !== 'user-file'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Procedural Synth
          </button>
          <button
            type="button"
            onClick={() => audioInputRef?.click()}
            class={`py-1 rounded text-center transition-colors cursor-pointer flex items-center justify-center gap-1 ${
              state.audioSource === 'user-file'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Upload class="w-2.5 h-2.5" />
            External Track
          </button>
        </div>

        <Show when={props.onOpenMediaVault}>
          <Button
            variant="outline"
            size="xs"
            onClick={() => props.onOpenMediaVault?.()}
            class="w-full text-xs font-mono border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 flex items-center justify-center gap-1.5"
            title="Browse Open-Source CC0 Audio Stems (Đàn Tranh, Vinyl, Rhodes, 909)"
          >
            <Music class="w-3 h-3 text-emerald-400" />
            <span>✦ Load Media Vault Stems</span>
          </Button>
        </Show>

        <input
          ref={audioInputRef}
          type="file"
          accept="audio/mp3,audio/wav,audio/m4a,audio/ogg,.mp3,.wav,.m4a,.ogg"
          onChange={handleAudioUpload}
          class="hidden"
        />

        <Show
          when={state.audioSource === 'user-file' && userAudioTrack.hasAudio()}
          fallback={
            <div class="text-xs font-mono text-muted-foreground flex items-center gap-1.5 p-2 rounded bg-muted/20 border border-border/40">
              <Radio class="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Synthesizing phase-locked 4-voice analog clock ({state.bpm} BPM)</span>
            </div>
          }
        >
          <div class="space-y-2 p-2 rounded bg-muted/30 border border-emerald-500/20">
            <div class="flex items-center justify-between text-xs font-mono">
              <span class="text-emerald-400 font-semibold flex items-center gap-1 truncate max-w-[240px]">
                <FileAudio class="w-3 h-3 shrink-0" />
                <span class="truncate">
                  {activeAudioStem() ? activeAudioStem()!.name : 'Custom Stem Track Loaded'}
                </span>
              </span>
              <button
                type="button"
                onClick={handleResetAudio}
                class="text-destructive hover:underline cursor-pointer"
              >
                Reset Synth
              </button>
            </div>

            {/* Visual Waveform Strip */}
            <div class="h-10 w-full bg-black/40 rounded flex items-center justify-between px-1 gap-px overflow-hidden border border-white/5">
              <For each={userAudioTrack.getWaveformPoints().slice(0, 64)}>
                {(val) => (
                  <div
                    class="flex-1 bg-emerald-400/80 rounded-full min-h-[2px]"
                    style={{
                      height: `${Math.max(4, Math.round(val * 36))}px`,
                    }}
                  />
                )}
              </For>
            </div>
            <div class="text-[11px] font-mono text-muted-foreground flex justify-between">
              <span>Bass (0-220Hz)</span>
              <span>Mid (220-1.8kHz)</span>
              <span>High (&gt;1.8kHz)</span>
            </div>
          </div>
        </Show>
      </div>

      {/* SECTION 3: BPM SYNTH AUDIO-REACTIVE ENGINE CONTROLS */}
      <div class="p-3 rounded-lg bg-card border border-border space-y-2 text-card-foreground">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-mono uppercase text-foreground font-bold">
              BPM Synth Audio-Reactive Engine
            </span>
            <Badge variant="amber" class="text-[9px] py-0 px-1 font-bold">GLOBAL TIMELINE</Badge>
          </div>
          <Badge variant={state.audioReactive ? 'cyan' : 'default'}>
            {state.bpm} BPM
          </Badge>
        </div>
        <SwitchRow
          label="Enable BPM Harmonic Modulation"
          sublabel="Modulates hero scale & triggers audible analog synth beat"
          checked={state.audioReactive}
          onChange={(v) => handleToggleBpmSynth(v)}
        />
        <Show when={state.audioReactive}>
          <SwitchRow
            label="Web Audio Synthesizer Sound"
            sublabel="Plays analog 909 kick & acid synth pulse on beat"
            checked={state.synthAudioSound}
            onChange={(v) => {
              patchState({ synthAudioSound: v });
              if (v) triggerAnalogSynthBeat(state.bpm);
            }}
          />
          <div>
            <div class="flex justify-between text-xs font-mono text-muted-foreground">
              <span>Tempo (90 – 160 BPM)</span>
              <span>{state.bpm} BPM</span>
            </div>
            <input
              type="range"
              min={90}
              max={160}
              step={2}
              value={state.bpm}
              onInput={(e) =>
                patchState({ bpm: Number(e.currentTarget.value) })
              }
              class="w-full accent-primary cursor-pointer"
            />
          </div>

          {/* Rhythm Pattern Selector */}
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-mono text-muted-foreground">
                Audio Sequencer Pattern ({SYNTH_PATTERNS.length})
              </label>
              <span class="text-[10px] font-mono text-primary font-bold">
                {SYNTH_PATTERNS.find((p) => p.id === state.synthPattern)?.name ?? state.synthPattern}
              </span>
            </div>
            <select
              value={state.synthPattern}
              onChange={(e) =>
                patchState({
                  synthPattern: e.currentTarget.value as typeof state.synthPattern,
                })
              }
              class="w-full bg-background border border-border rounded px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary cursor-pointer"
            >
              <For each={SYNTH_PATTERNS}>
                {(p) => (
                  <option value={p.id}>
                    {p.name} — {p.desc}
                  </option>
                )}
              </For>
            </select>
            <p class="text-[10px] text-muted-foreground mt-1">
              {SYNTH_PATTERNS.find((p) => p.id === state.synthPattern)?.desc}
            </p>
          </div>

          {/* Parametric Filter & Volume */}
          <div class="grid grid-cols-2 gap-2 pt-1 border-t border-border">
            <div>
              <div class="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>Filter Cutoff</span>
                <span>{Math.round(state.synthFilterCutoff)} Hz</span>
              </div>
              <input
                type="range"
                min={400}
                max={12000}
                step={200}
                value={state.synthFilterCutoff}
                onInput={(e) =>
                  patchState({
                    synthFilterCutoff: Number(e.currentTarget.value),
                  })
                }
                class="w-full accent-primary cursor-pointer"
              />
            </div>
            <div>
              <div class="flex justify-between text-[11px] font-mono text-muted-foreground">
                <span>Master Volume</span>
                <span>{Math.round(state.synthMasterVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={state.synthMasterVolume}
                onInput={(e) =>
                  patchState({
                    synthMasterVolume: Number(e.currentTarget.value),
                  })
                }
                class="w-full accent-primary cursor-pointer"
              />
            </div>
          </div>
        </Show>
      </div>

      {/* SECTION 4: HARDWARE ACCELERATION & GPU DIAGNOSTICS */}
      <div class="p-3 rounded-lg bg-card border border-border space-y-2 text-card-foreground">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <Cpu class="w-3.5 h-3.5 text-cyan-400" />
            <span class="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
              Hardware Acceleration & Diagnostics
            </span>
          </div>
          <Badge variant="cyan" class="text-[9px] py-0 px-1">
            {webGpuShaderBridge.getSupported() ? 'WEBGPU ACTIVE' : 'FALLBACK 2D'}
          </Badge>
        </div>

        <Show when={gpuCaps()}>
          {(caps) => (
            <div class="text-[10px] font-mono bg-background/60 p-2 rounded border border-border flex flex-col gap-1">
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Probe Backend:</span>
                <span class="font-bold uppercase text-cyan-400">{caps().backend}</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Renderer:</span>
                <span class="text-foreground truncate max-w-[160px]" title={caps().rendererName}>
                  {caps().rendererName}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Max Texture:</span>
                <span class="text-foreground">{caps().maxTextureSize}px</span>
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Compute Shaders:</span>
                <span class={caps().computeShadersSupported ? 'text-emerald-400 font-bold' : 'text-muted-foreground'}>
                  {caps().computeShadersSupported ? 'YES' : 'NO (FALLBACK)'}
                </span>
              </div>
            </div>
          )}
        </Show>
      </div>

      {/* SECTION 5: CREATIVE SHUFFLERS & RANDOMIZERS */}
      <div class="p-3 rounded-lg bg-card border border-border space-y-2.5 text-card-foreground">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono uppercase tracking-wider text-primary font-bold flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5" />
            Creative Shufflers & Mutations
          </span>
          <span class="text-xs font-mono text-muted-foreground">1-Click Variation</span>
        </div>

        <div class="grid grid-cols-2 gap-1.5">
          <Button
            variant="secondary"
            size="xs"
            onClick={() => {
              patchState(shuffleAesthetics());
              triggerToast('Shuffled Aesthetics (Background + Shader + Hero)');
            }}
            class="text-left justify-start"
          >
            <Wand2 class="w-3 h-3 text-primary" />
            <span>Shuffle Aesthetics</span>
          </Button>

          <Button
            variant="secondary"
            size="xs"
            onClick={() => {
              patchState({ palette: shufflePalette() });
              triggerToast('Synthesized High-Contrast Palette');
            }}
            class="text-left justify-start"
          >
            <Palette class="w-3 h-3 text-primary" />
            <span>Shuffle Palette</span>
          </Button>

          <Button
            variant="secondary"
            size="xs"
            onClick={() => {
              patchState(shuffleLayout());
              triggerToast('Cycled Spatial Layout');
            }}
            class="text-left justify-start"
          >
            <Layers class="w-3 h-3 text-primary" />
            <span>Shuffle Layout</span>
          </Button>

          <Button
            variant="secondary"
            size="xs"
            onClick={() => {
              patchState(shuffleAudio());
              triggerToast('Randomized BPM & Synth Engine');
            }}
            class="text-left justify-start"
          >
            <Volume2 class="w-3 h-3 text-primary" />
            <span>Shuffle Audio</span>
          </Button>
        </div>

        <Button
          variant="primary"
          size="xs"
          onClick={() => {
            patchState(shuffleAll(state));
            triggerToast('Full Studio Creative Re-roll (Content Preserved)');
          }}
          class="w-full font-bold"
        >
          <RefreshCw class="w-3 h-3" />
          ⚡ Full Creative Re-roll (All Layers)
        </Button>
      </div>

      {/* SECTION 6: GRANULAR SUBSYSTEM RESETS */}
      <div class="p-3 rounded-lg bg-card border border-border space-y-2 text-card-foreground">
        <span class="text-xs font-mono uppercase tracking-wider text-muted-foreground block font-bold">
          Granular Subsystem Resets
        </span>
        <div class="grid grid-cols-2 gap-1.5 text-xs">
          <For
            each={[
              ['palette', 'Reset Palette'],
              ['spatial', 'Reset Spatial Layout'],
              ['background', 'Reset Background'],
              ['ambient', 'Reset Shader'],
              ['hero', 'Reset Hero Stage'],
              ['motion', 'Reset Motion'],
              ['audio', 'Reset Audio'],
            ] as Array<[SubsystemId, string]>}
          >
            {([sys, label]) => (
              <Button
                variant="secondary"
                size="xs"
                onClick={() => {
                  resetSubsystem(sys);
                  triggerToast(`Reset [${sys.toUpperCase()}] to Defaults`);
                }}
                class="text-left justify-start"
              >
                <RotateCcw class="w-2.5 h-2.5 text-muted-foreground" />
                <span>{label}</span>
              </Button>
            )}
          </For>

          <Button
            variant="destructive"
            size="xs"
            onClick={resetState}
            class="text-left justify-start"
          >
            <RotateCcw class="w-2.5 h-2.5" />
            <span>Factory Reset (All)</span>
          </Button>
        </div>
      </div>

      {/* SECTION 7: SAVE & MANAGE USER PRESETS */}
      <div class="p-3 rounded-lg bg-card border border-border space-y-2.5 text-card-foreground">
        <span class="text-xs font-mono uppercase tracking-wider text-foreground block font-bold flex items-center gap-1.5">
          <BookmarkPlus class="w-3.5 h-3.5 text-primary" />
          Custom User Presets ({studio.userPresets.length})
        </span>

        <div class="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Preset title (e.g. Neon Cyberpunk)..."
            value={newPresetTitle()}
            onInput={(e) => setNewPresetTitle(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newPresetTitle().trim()) {
                saveCustomPreset(newPresetTitle());
                setNewPresetTitle('');
              }
            }}
            class="flex-1 bg-background border border-border rounded px-2 py-1 text-xs font-mono text-foreground focus:border-primary focus:outline-none"
          />
          <Button
            variant="primary"
            size="xs"
            onClick={() => {
              if (newPresetTitle().trim()) {
                saveCustomPreset(newPresetTitle());
                setNewPresetTitle('');
              }
            }}
          >
            Save
          </Button>
        </div>

        <Show when={studio.userPresets.length > 0}>
          <div class="max-h-36 overflow-y-auto space-y-1.5 pt-1">
            <For each={studio.userPresets}>
              {(p) => (
                <div class="flex items-center justify-between p-1.5 rounded bg-background border border-border text-xs font-mono">
                  <div class="min-w-0 flex-1 mr-2">
                    <div class="font-bold text-foreground leading-snug">{p.title}</div>
                    <div class="text-[11px] text-muted-foreground">
                      {new Date(p.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div class="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => loadCustomPreset(p.id)}
                      class="h-6 px-1.5 text-primary"
                    >
                      Load
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => deleteCustomPreset(p.id)}
                      class="h-6 px-1.5 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 class="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      {/* SECTION 8: DATA PORTABILITY & SHARING */}
      <div class="p-3 rounded-lg bg-card border border-border space-y-2 text-card-foreground">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono uppercase tracking-wider text-foreground block font-bold flex items-center gap-1.5">
            <Share2 class="w-3.5 h-3.5 text-primary" />
            Portability & Deep Linking
          </span>
          <Badge variant="amber" class="text-[9px] py-0 px-1 font-bold">GLOBAL PROJECT</Badge>
        </div>

        <Button
          variant="outline"
          size="xs"
          onClick={async () => {
            await copyShareUrl();
            triggerToast('Copied Shareable Deep Link (#config=...)');
          }}
          class="w-full text-foreground border-border hover:bg-accent"
        >
          <Share2 class="w-3 h-3" />
          <span>Copy Shareable Deep-Link URL</span>
        </Button>

        <div class="grid grid-cols-2 gap-1.5">
          <Button
            variant="secondary"
            size="xs"
            onClick={handleExportJson}
            class="text-left justify-start"
          >
            <Download class="w-3 h-3 text-primary" />
            <span>Export JSON File</span>
          </Button>

          <label class="flex items-center justify-start gap-1 px-2.5 py-1 rounded bg-secondary border border-border text-xs font-mono text-secondary-foreground hover:bg-accent cursor-pointer transition-colors">
            <Upload class="w-3 h-3 text-foreground" />
            <span>Import JSON File</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportFile}
              class="hidden"
            />
          </label>
        </div>
      </div>

      {/* SECTION 9: LIVE DECLARATIVE CONTRACT EDITOR */}
      <div class="p-3 rounded-lg bg-card border border-border space-y-2 text-card-foreground">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <Code2 class="w-3.5 h-3.5 text-primary" />
            <span class="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
              Live Declarative Contract
            </span>
          </div>
          <div class="flex items-center gap-1.5">
            <Badge variant="amber" class="text-[9px] py-0 px-1 font-bold">GLOBAL PROJECT</Badge>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                if (!jsonEditorOpen()) {
                  setJsonText(generateDeclarativeSchema(state, studio.wcagContrast));
                }
                setJsonEditorOpen((prev) => !prev);
              }}
            >
              {jsonEditorOpen() ? 'Collapse' : 'Edit / Paste'}
            </Button>
          </div>
        </div>

        <Show when={jsonEditorOpen()}>
          <div class="space-y-2 pt-1">
            <textarea
              rows={8}
              value={jsonText()}
              onInput={(e) => {
                setJsonText(e.currentTarget.value);
                setJsonError(null);
              }}
              placeholder="Paste declarative contract JSON..."
              class="w-full p-2 rounded bg-background border border-border text-xs font-mono text-foreground leading-relaxed focus:border-primary focus:outline-none select-text"
            />

            <Show when={jsonError()}>
              <div class="text-xs font-mono text-destructive px-1">
                {jsonError()}
              </div>
            </Show>

            <div class="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(jsonText());
                    setJsonText(JSON.stringify(parsed, null, 2));
                  } catch {
                    setJsonError('Invalid JSON formatting');
                  }
                }}
              >
                Format
              </Button>
              <Button
                variant="primary"
                size="xs"
                onClick={handleApplyJson}
                class="flex-1"
              >
                <Check class="w-3 h-3" />
                Apply Contract to Studio
              </Button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};
