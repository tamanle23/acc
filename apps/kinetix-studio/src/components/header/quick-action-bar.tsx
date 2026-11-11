import { createSignal, Show, Component } from 'solid-js';
import {
  Volume2,
  Radio,
  Box,
  LayoutGrid,
  Sparkles,
  Camera,
  Film,
  FileCode2,
  ChevronDown,
  Share2,
  SlidersHorizontal,
  Maximize,
} from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { Button } from '@/components/ui/button';
import { TEMPLATE_VAULT } from '@/constants/template-vault';
import type { ExportResolutionScale } from '@/lib/export-video';

export interface QuickActionBarProps {
  onOpenVault: () => void;
  onOpenMediaVault?: () => void;
  onOpenLottieHub: () => void;
  onOpenMatrixTest: () => void;
  onOpenShare?: () => void;
  onOpenPresenter?: () => void;
  onOpenCopilot?: () => void;
  onOpenVjRig?: () => void;
  onExportSnapshot: (scale?: ExportResolutionScale) => void;
  onExportSvg?: () => void;
  onRecordVideo: () => void;
  onExportMp4?: () => void;
  onExportGif?: () => void;
  isRecording: boolean;
  recordProgress: number;
  matrixTestOpen: boolean;
  batchCycleActive: boolean;
}

export const QuickActionBar: Component<QuickActionBarProps> = (props) => {
  const { state, handleToggleBpmSynth, copyShareUrl, triggerToast, setActiveTab } =
    useStudio();
  const [scaleMenuOpen, setScaleMenuOpen] = createSignal(false);
  const [videoMenuOpen, setVideoMenuOpen] = createSignal(false);

  return (
    <div class="flex items-center gap-1.5 shrink-0">
      {/* AI Creative Director Co-Pilot Trigger */}
      <Show when={props.onOpenCopilot}>
        <Button
          variant="primary"
          size="xs"
          onClick={() => props.onOpenCopilot?.()}
          title="Open AI Creative Director Co-Pilot (Prompt-to-Poster)"
          class="bg-gradient-to-r from-primary to-accent hover:opacity-90 font-bold shadow-xs text-xs"
        >
          <Sparkles class="w-3 h-3 text-primary-foreground animate-pulse" />
          <span class="hidden md:inline">AI Director</span>
        </Button>
      </Show>

      {/* Live Stage VJ Performance Rig Trigger */}
      <Show when={props.onOpenVjRig}>
        <Button
          variant="secondary"
          size="xs"
          onClick={() => props.onOpenVjRig?.()}
          title="Open Live Stage VJ Performance Rig (Dual Deck & Stream Capture)"
          class="font-mono text-xs border border-border/70 hover:border-cyan-400/50"
        >
          <Radio class="w-3 h-3 text-cyan-400" />
          <span class="hidden md:inline">VJ Rig</span>
        </Button>
      </Show>

      {/* 1. Config Hub Jump */}
      <Button
        variant="ghost"
        size="xs"
        onClick={() => setActiveTab('config')}
        title="Open Studio Configuration & Presets (Hotkey: C)"
        class="text-muted-foreground hover:text-primary"
      >
        <SlidersHorizontal class="w-3 h-3 text-primary" />
        <span class="hidden xl:inline">Config</span>
      </Button>

      {/* 2. Deep-Link Share URL / Modal */}
      <Button
        variant="ghost"
        size="xs"
        onClick={async () => {
          if (props.onOpenShare) {
            props.onOpenShare();
          } else {
            await copyShareUrl();
            triggerToast('Copied Shareable Deep Link (#p=...)');
          }
        }}
        title="Share Live Composition (Compressed URL & QR Code) (Hotkey: S)"
        class="text-muted-foreground hover:text-foreground"
      >
        <Share2 class="w-3 h-3 text-cyan-400" />
        <span class="hidden xl:inline">Share</span>
      </Button>

      {/* Exhibition Kiosk / Gallery Presenter */}
      <Show when={props.onOpenPresenter}>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => props.onOpenPresenter?.()}
          title="Open Fullscreen Exhibition & Gallery Kiosk Presenter (Hotkey: F)"
          class="text-muted-foreground hover:text-foreground font-mono"
        >
          <Maximize class="w-3.5 h-3.5 text-emerald-400" />
          <span class="hidden sm:inline ml-1">Kiosk</span>
        </Button>
      </Show>

      {/* BPM Synth Quick Toggle */}
      <Button
        variant={state.audioReactive ? 'primary' : 'secondary'}
        size="xs"
        onClick={() => handleToggleBpmSynth()}
        title="Toggle Audible BPM Audio-Reactive Synthesizer"
      >
        <Show
          when={state.audioReactive && state.synthAudioSound}
          fallback={<Radio class="w-3 h-3" />}
        >
          <Volume2 class="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
        </Show>
        <span class="hidden xl:inline">BPM {state.bpm}</span>
      </Button>

      {/* Lottie Hub Modal Trigger */}
      <Button
        variant="secondary"
        size="xs"
        onClick={() => props.onOpenLottieHub()}
        title="Open Bodymovin / Lottie Vector Hub"
      >
        <Box class="w-3 h-3 text-primary" />
        <span class="hidden xl:inline">Lottie Hub</span>
      </Button>

      {/* Multi-Format Matrix Test & Batch Variant Cycle */}
      <Button
        variant={
          props.matrixTestOpen || props.batchCycleActive ? 'accent' : 'secondary'
        }
        size="xs"
        onClick={() => props.onOpenMatrixTest()}
        title="Open 4-Format Responsive Matrix Test & Batch Variant Cycle"
      >
        <LayoutGrid class="w-3 h-3" />
        <span class="hidden lg:inline">Matrix Test</span>
      </Button>

      {/* Template Vault (30 Presets) */}
      <Button
        variant="outline"
        size="xs"
        onClick={() => props.onOpenVault()}
        class="border-primary/50 text-primary hover:bg-primary/10"
      >
        <Sparkles class="w-3 h-3" />
        <span>✦ Vault ({TEMPLATE_VAULT.length})</span>
      </Button>

      {/* Real-World Media Vault (CC0 Photography, Video Footages & Audio Stems) */}
      <Show when={props.onOpenMediaVault}>
        <Button
          variant="outline"
          size="xs"
          onClick={() => props.onOpenMediaVault?.()}
          title="Open Media Vault: Curated CC0 Photos, Motion Footages & Audio Stems (Hotkey: M)"
          class="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
        >
          <Film class="w-3 h-3 text-cyan-400" />
          <span class="hidden sm:inline">Media Vault</span>
        </Button>
      </Show>

      {/* Snap PNG with Resolution Menu */}
      <div class="relative">
        <div class="flex items-center">
          <Button
            variant="secondary"
            size="xs"
            onClick={() => props.onExportSnapshot(1)}
            class="rounded-r-none pr-1"
          >
            <Camera class="w-3 h-3" />
            <span class="hidden md:inline">Snap PNG</span>
          </Button>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => setScaleMenuOpen((v) => !v)}
            class="rounded-l-none pl-1 pr-1 border-l border-border"
            title="Choose Export Resolution (1x, 2x 4K, 4x Print)"
          >
            <ChevronDown class="w-2.5 h-2.5" />
          </Button>
        </div>

        <Show when={scaleMenuOpen()}>
          <div class="absolute right-0 top-full mt-1 w-32 bg-popover border border-border text-popover-foreground rounded shadow-xl py-1 z-50">
            <button
              type="button"
              onClick={() => {
                props.onExportSnapshot(1);
                setScaleMenuOpen(false);
              }}
              class="w-full text-left px-2.5 py-1 text-xs font-mono text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              1x Standard (1080p)
            </button>
            <button
              type="button"
              onClick={() => {
                props.onExportSnapshot(2);
                setScaleMenuOpen(false);
              }}
              class="w-full text-left px-2.5 py-1 text-xs font-mono text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              2x Retina (4K)
            </button>
            <button
              type="button"
              onClick={() => {
                props.onExportSnapshot(4);
                setScaleMenuOpen(false);
              }}
              class="w-full text-left px-2.5 py-1 text-xs font-mono text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              4x Print (300 DPI)
            </button>
          </div>
        </Show>
      </div>

      {/* SVG Vector Snapshot */}
      <Show when={props.onExportSvg}>
        <Button
          variant="secondary"
          size="xs"
          onClick={() => props.onExportSvg?.()}
          title="Export Scalable Vector Graphics (.svg)"
        >
          <FileCode2 class="w-3 h-3 text-foreground" />
          <span class="hidden md:inline">SVG</span>
        </Button>
      </Show>

      {/* 1-Click Multi-Format Video/Motion Export */}
      <div class="relative">
        <div class="flex items-center">
          <Button
            variant="accent"
            size="xs"
            onClick={() => (props.onExportMp4 ? props.onExportMp4() : props.onRecordVideo())}
            class="rounded-r-none pr-1.5"
          >
            <Film class="w-3 h-3" />
            <span>
              {props.isRecording ? `${props.recordProgress}%` : 'Export MP4'}
            </span>
          </Button>
          <Button
            variant="accent"
            size="xs"
            onClick={() => setVideoMenuOpen((v) => !v)}
            class="rounded-l-none pl-1 pr-1 border-l border-white/20"
            title="Choose Motion Format (MP4, WebM, GIF)"
          >
            <ChevronDown class="w-2.5 h-2.5" />
          </Button>
        </div>

        <Show when={videoMenuOpen()}>
          <div class="absolute right-0 top-full mt-1 w-36 bg-popover border border-border text-popover-foreground rounded shadow-xl py-1 z-50">
            <button
              type="button"
              onClick={() => {
                setVideoMenuOpen(false);
                if (props.onExportMp4) props.onExportMp4();
                else props.onRecordVideo();
              }}
              class="w-full text-left px-2.5 py-1 text-xs font-mono text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer"
            >
              🎬 MP4 (H.264 / AAC)
            </button>
            <button
              type="button"
              onClick={() => {
                setVideoMenuOpen(false);
                props.onRecordVideo();
              }}
              class="w-full text-left px-2.5 py-1 text-xs font-mono text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer"
            >
              📹 WebM Video
            </button>
            <button
              type="button"
              onClick={() => {
                setVideoMenuOpen(false);
                if (props.onExportGif) props.onExportGif();
              }}
              class="w-full text-left px-2.5 py-1 text-xs font-mono text-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer"
            >
              🎞️ Animated GIF
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
};
