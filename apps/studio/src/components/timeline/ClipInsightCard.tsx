import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js';
import {
  Film,
  Music,
  Type,
  Sparkles,
  Clock,
  Layers,
  Play,
  Pause,
  ExternalLink,
  Volume2,
  VolumeX,
  Image as ImageIcon,
  AlertCircle,
  Maximize2,
} from 'lucide-solid';
import { RationalTime } from '@acc/core-isomorphic';
import type { ModifierNode } from '@acc/ir';
import { useIRSelector } from '../../lib/ir/useStudioStore';
import {
  getSequenceDurationFrames,
  getSequenceStartFrame,
  type StudioSequence,
  type StudioTrack,
} from '../../lib/ir/studioTypes';
import { AssetTextureCache } from '../../lib/textures/AssetTextureCache';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

export interface ClipInsightCardProps {
  seq: StudioSequence;
  track?: StudioTrack | null;
  fps: number;
}

/**
 * ClipInsightCard:
 * Rich, semantic inspection card showing clip archetype, duration, SMPTE In/Out,
 * active modifiers, and rich interactive media previews:
 * - Video: Inline muted video preview player with play/pause and time scrub
 * - Audio: Inline interactive audio playback controller with play/pause toggle and wave animation
 * - Image: High-fidelity image thumbnail with quick modal / external full-resolution inspection
 * Designed to be embedded cleanly inside HoverCardContent.
 */
export function ClipInsightCard(props: ClipInsightCardProps) {
  const startFrame = () => getSequenceStartFrame(props.seq);
  const durationFrames = () => getSequenceDurationFrames(props.seq, 30);
  const endFrame = () => startFrame() + durationFrames();

  const startSMPTE = () => RationalTime.fromFrame(startFrame(), props.fps).toSMPTE(props.fps);
  const endSMPTE = () => RationalTime.fromFrame(endFrame(), props.fps).toSMPTE(props.fps);
  const durationSMPTE = () => RationalTime.fromFrame(durationFrames(), props.fps).toSMPTE(props.fps);

  // Determine media classification
  const isAudio = () => props.track?.type === 'audio' || props.seq.type === 'audio';
  const isText = () =>
    props.track?.type === 'timed_text' ||
    props.seq.type === 'text' ||
    Boolean(props.seq.cues?.length);
  const isVideo = () => !isAudio() && !isText() && props.seq.type === 'video';
  const isImage = () => !isAudio() && !isText() && props.seq.type === 'image';
  const isFx = () => props.seq.modifiers?.some((m: ModifierNode) => m.type.startsWith('vfx/'));

  // Resolve Asset definition from VideoIRDocument
  const irDoc = useIRSelector((s) => s.doc);

  const assetDef = () => (props.seq.assetId ? irDoc()?.assets?.[props.seq.assetId] : undefined);
  const legacySource = () =>
    'source' in props.seq && typeof (props.seq as { source?: unknown }).source === 'string'
      ? (props.seq as { source: string }).source
      : undefined;
  const assetSrc = () => assetDef()?.src || legacySource();
  const assetType = () =>
    assetDef()?.type || props.seq.type || (isVideo() ? 'video' : isImage() ? 'image' : isAudio() ? 'audio' : 'text');

  // Interactive Media States
  const [isVideoPlaying, setIsVideoPlaying] = createSignal(false);
  const [isAudioPlaying, setIsAudioPlaying] = createSignal(false);
  const [isAudioMuted, setIsAudioMuted] = createSignal(false);
  const [mediaError, setMediaError] = createSignal(false);
  const [imageModalOpen, setImageModalOpen] = createSignal(false);
  const [thumbDataUrl, setThumbDataUrl] = createSignal<string | null>(null);

  let videoRef: HTMLVideoElement | undefined;
  let audioRef: HTMLAudioElement | undefined;

  // Generate or retrieve procedural / cached thumbnail if src is not standard image URL
  createEffect(() => {
    if (props.seq.assetId) {
      try {
        const url = AssetTextureCache.getInstance().getThumbnailDataUrl(props.seq.assetId, 160, 90);
        if (url) {
          setThumbDataUrl(url);
        }
      } catch (e) {
        // Fallback gracefully
      }
    }
  });

  // Cleanup media when component unmounts
  onCleanup(() => {
    if (audioRef) {
      audioRef.pause();
      audioRef.currentTime = 0;
    }
    if (videoRef) {
      videoRef.pause();
    }
  });

  const toggleVideoPlayback = (e: MouseEvent) => {
    e.stopPropagation();
    if (!videoRef) return;
    if (isVideoPlaying()) {
      videoRef.pause();
      setIsVideoPlaying(false);
    } else {
      videoRef
        .play()
        .then(() => {
          setIsVideoPlaying(true);
        })
        .catch(() => {
          setIsVideoPlaying(false);
        });
    }
  };

  const toggleAudioPlayback = (e: MouseEvent) => {
    e.stopPropagation();
    if (!audioRef) return;
    if (isAudioPlaying()) {
      audioRef.pause();
      setIsAudioPlaying(false);
    } else {
      audioRef
        .play()
        .then(() => {
          setIsAudioPlaying(true);
        })
        .catch(() => {
          setIsAudioPlaying(false);
        });
    }
  };

  const modifiers = () => props.seq.modifiers || [];
  const cueText = () => props.seq.cues?.[0]?.text;

  return (
    <div class="flex flex-col w-full text-foreground select-none pointer-events-auto">
      {/* 1. Header with Archetype & Duration */}
      <div class="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border/50">
        <div class="flex items-center gap-1.5 min-w-0">
          <Show
            when={isAudio()}
            fallback={
              <Show
                when={isText()}
                fallback={
                  <Show
                    when={isFx()}
                    fallback={
                      <Show when={isImage()} fallback={<Film class="w-3.5 h-3.5 text-indigo-400" />}>
                        <ImageIcon class="w-3.5 h-3.5 text-sky-400" />
                      </Show>
                    }
                  >
                    <Sparkles class="w-3.5 h-3.5 text-amber-400" />
                  </Show>
                }
              >
                <Type class="w-3.5 h-3.5 text-violet-400" />
              </Show>
            }
          >
            <Music class="w-3.5 h-3.5 text-emerald-400" />
          </Show>
          <span class="font-mono font-semibold text-xs truncate text-foreground">{props.seq.name || props.seq.id}</span>
          <span class="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-muted/60 text-muted-foreground border border-border/50">
            {props.track?.type}
          </span>
        </div>
        <div class="flex items-center gap-1 shrink-0 font-mono text-[10px] text-accent-theme">
          <Clock class="w-3 h-3 text-accent-theme" />
          <span>
            {durationSMPTE()} ({durationFrames()}f)
          </span>
        </div>
      </div>

      {/* 2. Interactive Media Preview Section (Video / Audio / Image) */}
      <Show when={(isVideo() || assetType() === 'video') && assetSrc()}>
        <div class="mb-2 relative rounded-lg overflow-hidden border border-border/50 bg-black/60 aspect-video flex items-center justify-center group/video">
          <Show
            when={!mediaError()}
            fallback={
              <div class="flex flex-col items-center justify-center p-2 text-center text-muted-foreground">
                <AlertCircle class="w-5 h-5 text-amber-400 mb-1" />
                <span class="text-[10px] font-mono">Video Stream Unavailable</span>
              </div>
            }
          >
            <video
              ref={videoRef}
              src={assetSrc()}
              {...{ playsinline: true }}
              muted
              loop
              preload="metadata"
              class="w-full h-full object-contain"
              onPlay={() => setIsVideoPlaying(true)}
              onPause={() => setIsVideoPlaying(false)}
              onError={(err) => {
                console.error('Video Error Code:', err);
                setMediaError(true);
              }}
            />
            {/* Overlay Controls */}
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-90 transition-opacity flex flex-col justify-between p-1.5">
              <div class="flex items-center justify-between">
                <span class="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-black/60 text-white/90 backdrop-blur-xs">
                  VIDEO PREVIEW
                </span>
                <a
                  href={assetSrc()}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="p-1 rounded bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-colors"
                  title="Open full video in new tab"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink class="w-3 h-3" />
                </a>
              </div>
              <div class="flex items-center justify-center">
                <button
                  type="button"
                  onClick={toggleVideoPlayback}
                  class="p-2 rounded-full bg-accent-theme/90 hover:bg-accent-theme text-primary-foreground shadow-lg backdrop-blur-xs transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                  aria-label={isVideoPlaying() ? 'Pause video' : 'Play video'}
                >
                  <Show when={isVideoPlaying()} fallback={<Play class="w-4 h-4 fill-current ml-0.5" />}>
                    <Pause class="w-4 h-4 fill-current" />
                  </Show>
                </button>
              </div>
              <div class="flex items-center justify-between text-[8px] font-mono text-white/70 px-0.5">
                <span>{isVideoPlaying() ? 'Playing' : 'Paused'}</span>
                <span>{durationSMPTE()}</span>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Image Preview with External Link & Enlarged Modal */}
      <Show when={isImage() || assetType() === 'image'}>
        <div class="mb-2 relative rounded-lg overflow-hidden border border-border/50 bg-black/40 aspect-video flex items-center justify-center group/image">
          <Show
            when={assetSrc()}
            fallback={
              <Show
                when={thumbDataUrl()}
                fallback={
                  <div class="flex flex-col items-center justify-center text-muted-foreground p-2">
                    <ImageIcon class="w-6 h-6 mb-1 text-muted-foreground/60" />
                    <span class="text-[10px] font-mono">No Source Preview</span>
                  </div>
                }
              >
                <img
                  src={thumbDataUrl()!}
                  alt={props.seq.name || props.seq.id}
                  class="w-full h-full object-cover"
                />
              </Show>
            }
          >
            <img
              src={assetSrc()}
              alt={props.seq.name || props.seq.id}
              class="w-full h-full object-cover"
              onError={(err) => {
                console.error('Image Error Code:', err);
                setMediaError(true);
              }}
            />
          </Show>

          {/* Quick Action Badges */}
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-black/60 text-white/90 backdrop-blur-xs">
                IMAGE THUMBNAIL
              </span>
              <div class="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageModalOpen(true);
                  }}
                  class="p-1 rounded bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-colors cursor-pointer"
                  title="Enlarge Image"
                >
                  <Maximize2 class="w-3 h-3" />
                </button>
                <Show when={assetSrc()}>
                  <a
                    href={assetSrc()}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="p-1 rounded bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-colors"
                    title="Open external original image in new tab"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink class="w-3 h-3" />
                  </a>
                </Show>
              </div>
            </div>
            <div class="text-[8px] font-mono text-white/80 px-0.5 truncate">
              {assetDef()?.src ? new URL(assetDef()!.src, 'https://example.com').pathname.split('/').pop() : props.seq.id}
            </div>
          </div>
        </div>
      </Show>

      {/* Audio Playback Controller */}
      <Show when={isAudio() || assetType() === 'audio'}>
        <div class="mb-2 p-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 flex flex-col gap-1.5">
          <audio
            ref={audioRef}
            src={assetSrc()}
            preload="metadata"
            onPlay={() => setIsAudioPlaying(true)}
            onPause={() => setIsAudioPlaying(false)}
            onEnded={() => setIsAudioPlaying(false)}
          />
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleAudioPlayback}
                disabled={!assetSrc()}
                class="w-7 h-7 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={isAudioPlaying() ? 'Pause audio' : 'Play audio'}
              >
                <Show when={isAudioPlaying()} fallback={<Play class="w-3.5 h-3.5 fill-current ml-0.5" />}>
                  <Pause class="w-3.5 h-3.5 fill-current" />
                </Show>
              </button>
              <div class="flex flex-col">
                <span class="text-[10px] font-mono font-semibold text-emerald-300">
                  {isAudioPlaying() ? 'Playing Audio...' : 'Audio Track'}
                </span>
                <span class="text-[8px] font-mono text-muted-foreground truncate max-w-[150px]">
                  {assetSrc() ? assetSrc()!.split('/').pop()?.split('?')[0] : 'Synthesized / Procedural Audio'}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-1">
              <Show when={assetSrc()}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!audioRef) return;
                    audioRef.muted = !isAudioMuted();
                    setIsAudioMuted(!isAudioMuted());
                  }}
                  class="p-1 rounded hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer"
                  title={isAudioMuted() ? 'Unmute' : 'Mute'}
                >
                  <Show when={isAudioMuted()} fallback={<Volume2 class="w-3 h-3" />}>
                    <VolumeX class="w-3 h-3" />
                  </Show>
                </button>
                <a
                  href={assetSrc()}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="p-1 rounded hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                  title="Open audio in new tab"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink class="w-3 h-3" />
                </a>
              </Show>
            </div>
          </div>

          {/* Mini Playback Equalizer Wave Animation */}
          <Show when={isAudioPlaying()}>
            <div class="flex items-center gap-0.5 h-2 w-full pt-1">
              <For each={[40, 70, 30, 90, 60, 100, 50, 80, 45, 85, 65, 95, 35, 75, 55, 90]}>
                {(h, i) => (
                  <div
                    class="flex-1 bg-emerald-400 rounded-full animate-pulse"
                    style={{
                      height: `${h}%`,
                      'animation-delay': `${(i() % 5) * 100}ms`,
                      'animation-duration': '600ms',
                    }}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>

      {/* 3. Boundary Metrics (In / Out) */}
      <div class="grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground mb-2 bg-black/20 p-1.5 rounded-lg border border-border/40">
        <div>
          <span class="text-[9px] uppercase text-muted-foreground/60 block">In Point</span>
          <span class="text-foreground font-semibold">{startSMPTE()}</span>
          <span class="text-[9px] ml-1 text-muted-foreground">({startFrame()}f)</span>
        </div>
        <div>
          <span class="text-[9px] uppercase text-muted-foreground/60 block">Out Point</span>
          <span class="text-foreground font-semibold">{endSMPTE()}</span>
          <span class="text-[9px] ml-1 text-muted-foreground">({endFrame()}f)</span>
        </div>
      </div>

      {/* 4. Dialogue Cue Preview (if any) */}
      <Show when={cueText()}>
        <div class="mb-2 text-[11px] font-sans italic text-violet-200 bg-violet-950/40 border border-violet-500/30 p-2 rounded-lg">
          "{cueText()}"
        </div>
      </Show>

      {/* 5. Active Modifiers Chips */}
      <Show when={modifiers().length > 0}>
        <div class="flex flex-wrap gap-1 items-center pt-1">
          <span class="text-[9px] font-mono text-muted-foreground flex items-center gap-0.5 mr-1">
            <Layers class="w-2.5 h-2.5" /> Modifiers ({modifiers().length}):
          </span>
          <For each={modifiers().slice(0, 4)}>
            {(m) => {
              const shortName = m.type.split('/').pop() || m.type;
              return (
                <span class="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-accent-theme/10 border border-accent-theme/30 text-accent-theme truncate max-w-[100px]">
                  {shortName}
                </span>
              );
            }}
          </For>
          <Show when={modifiers().length > 4}>
            <span class="text-[9px] font-mono text-muted-foreground">+{modifiers().length - 4}</span>
          </Show>
        </div>
      </Show>

      {/* Modal Dialog for Enlarged Image Inspection */}
      <Dialog open={imageModalOpen()} onOpenChange={setImageModalOpen}>
        <DialogContent class="max-w-3xl glass-panel border border-glass-border p-4 bg-popover/95 text-foreground backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle class="flex items-center justify-between text-sm font-mono">
              <span class="truncate">{props.seq.name || props.seq.id} (Full Resolution)</span>
              <Show when={assetSrc()}>
                <a
                  href={assetSrc()}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center gap-1 text-xs text-accent-theme hover:underline mr-4"
                >
                  <ExternalLink class="w-3.5 h-3.5" />
                  Original Asset
                </a>
              </Show>
            </DialogTitle>
          </DialogHeader>
          <div class="mt-2 relative rounded-lg overflow-hidden border border-border/50 bg-black/80 flex items-center justify-center max-h-[70vh]">
            <img
              src={assetSrc() || thumbDataUrl() || ''}
              alt={props.seq.name || props.seq.id}
              class="max-h-[68vh] w-auto object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Backward-compatible alias
export const TimelineClipInsightCard = ClipInsightCard;
export type TimelineClipInsightCardProps = ClipInsightCardProps;
