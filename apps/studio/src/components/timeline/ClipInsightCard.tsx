import React, { useState, useEffect, useRef } from 'react';
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
  Loader2,
  Maximize2
} from 'lucide-react';
import { RationalTime } from '@acc/core-isomorphic';
import { IRStateManager } from '../../lib/ir/irState';
import { AssetTextureCache } from '../../lib/textures/AssetTextureCache';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

export interface ClipInsightCardProps {
  seq: any;
  track: any;
  fps: number;
}

/**
 * ClipInsightCard:
 * Rich, semantic inspection card showing clip archetype, duration, SMPTE In/Out,
 * active modifiers, and rich interactive media previews:
 * - Video: Inline muted video preview player with play/pause and time scrub
 * - Audio: Inline interactive audio playback controller with play/pause toggle and wave animation
 * - Image: High-fidelity image thumbnail with quick modal / external full-resolution inspection
 * Designed to be embedded cleanly inside Shadcn's HoverCardContent.
 */
export const ClipInsightCard: React.FC<ClipInsightCardProps> = ({
  seq,
  track,
  fps,
}) => {
  const startFrame = seq.startFrame ?? 0;
  const durationFrames = seq.durationFrames ?? 30;
  const endFrame = startFrame + durationFrames;

  const startSMPTE = RationalTime.fromFrame(startFrame, fps).toSMPTE(fps);
  const endSMPTE = RationalTime.fromFrame(endFrame, fps).toSMPTE(fps);
  const durationSMPTE = RationalTime.fromFrame(durationFrames, fps).toSMPTE(fps);

  // Determine media classification
  const isAudio = track?.type === 'audio' || seq.type === 'audio';
  const isText = track?.type === 'text' || track?.type === 'timed_text' || seq.type === 'text' || Boolean(seq.cues?.length);
  const isVideo = !isAudio && !isText && (track?.type === 'video' || seq.type === 'video' || seq.type === 'media');
  const isImage = !isAudio && !isText && (track?.type === 'image' || seq.type === 'image');
  const isFx = seq.modifiers?.some((m: any) => m.type.startsWith('vfx/'));

  // Resolve Asset definition from VideoIRDocument
  const [irDoc, setIrDoc] = useState(() => IRStateManager.getInstance().getState().doc);
  useEffect(() => {
    return IRStateManager.getInstance().subscribe((state) => {
      setIrDoc(state.doc);
    });
  }, []);

  const assetDef = seq.assetId ? irDoc?.assets?.[seq.assetId] : undefined;
  const assetSrc = assetDef?.src || (typeof seq.source === 'string' ? seq.source : undefined);
  const assetType = assetDef?.type || seq.type || (isVideo ? 'video' : isImage ? 'image' : isAudio ? 'audio' : 'text');

  // Interactive Media States
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generate or retrieve procedural / cached thumbnail if src is not standard image URL
  useEffect(() => {
    if (seq.assetId) {
      try {
        const url = AssetTextureCache.getInstance().getThumbnailDataUrl(seq.assetId, 160, 90);
        if (url) {
          setThumbDataUrl(url);
        }
      } catch (e) {
        // Fallback gracefully
      }
    }
  }, [seq.assetId, assetSrc]);

  // Cleanup media when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, []);

  const toggleVideoPlayback = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (isVideoPlaying) {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsVideoPlaying(true);
      }).catch(() => {
        setIsVideoPlaying(false);
      });
    }
  };

  const toggleAudioPlayback = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isAudioPlaying) {
      audioRef.current.pause();
      setIsAudioPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsAudioPlaying(true);
      }).catch(() => {
        setIsAudioPlaying(false);
      });
    }
  };

  const getArchetypeIcon = () => {
    if (isAudio) return <Music className="w-3.5 h-3.5 text-emerald-400" />;
    if (isText) return <Type className="w-3.5 h-3.5 text-violet-400" />;
    if (isFx) return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
    if (isImage) return <ImageIcon className="w-3.5 h-3.5 text-sky-400" />;
    return <Film className="w-3.5 h-3.5 text-indigo-400" />;
  };

  const modifiers: any[] = seq.modifiers || [];
  const cueText = seq.cues?.[0]?.text;

  return (
    <div className="flex flex-col w-full text-foreground select-none pointer-events-auto">
      {/* 1. Header with Archetype & Duration */}
      <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-border/50">
        <div className="flex items-center gap-1.5 min-w-0">
          {getArchetypeIcon()}
          <span className="font-mono font-semibold text-xs truncate text-foreground">{seq.name || seq.id}</span>
          <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-muted/60 text-muted-foreground border border-border/50">
            {track?.type || 'media'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 font-mono text-[10px] text-accent-theme">
          <Clock className="w-3 h-3 text-accent-theme" />
          <span>{durationSMPTE} ({durationFrames}f)</span>
        </div>
      </div>

      {/* 2. Interactive Media Preview Section (Video / Audio / Image) */}
      {(isVideo || assetType === 'video' || assetType === 'media') && assetSrc && (
        <div className="mb-2 relative rounded-lg overflow-hidden border border-border/50 bg-black/60 aspect-video flex items-center justify-center group/video">
          {mediaError ? (
            <div className="flex flex-col items-center justify-center p-2 text-center text-muted-foreground">
              <AlertCircle className="w-5 h-5 text-amber-400 mb-1" />
              <span className="text-[10px] font-mono">Video Stream Unavailable</span>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                src={assetSrc}
                playsInline
                muted
                loop
                preload="metadata"
                className="w-full h-full object-contain"
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
                onError={() => setMediaError(true)}
              />
              {/* Overlay Controls */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-90 transition-opacity flex flex-col justify-between p-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-black/60 text-white/90 backdrop-blur-xs">
                    VIDEO PREVIEW
                  </span>
                  <a
                    href={assetSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-colors"
                    title="Open full video in new tab"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={toggleVideoPlayback}
                    className="p-2 rounded-full bg-accent-theme/90 hover:bg-accent-theme text-primary-foreground shadow-lg backdrop-blur-xs transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                    aria-label={isVideoPlaying ? 'Pause video' : 'Play video'}
                  >
                    {isVideoPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[8px] font-mono text-white/70 px-0.5">
                  <span>{isVideoPlaying ? 'Playing' : 'Paused'}</span>
                  <span>{RationalTime.fromFrame(durationFrames, fps).toSMPTE(fps)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Image Preview with External Link & Enlarged Modal */}
      {(isImage || assetType === 'image') && (
        <div className="mb-2 relative rounded-lg overflow-hidden border border-border/50 bg-black/40 aspect-video flex items-center justify-center group/image">
          {assetSrc ? (
            <img
              src={assetSrc}
              alt={seq.name || seq.id}
              className="w-full h-full object-cover"
              onError={() => setMediaError(true)}
            />
          ) : thumbDataUrl ? (
            <img
              src={thumbDataUrl}
              alt={seq.name || seq.id}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground p-2">
              <ImageIcon className="w-6 h-6 mb-1 text-muted-foreground/60" />
              <span className="text-[10px] font-mono">No Source Preview</span>
            </div>
          )}

          {/* Quick Action Badges */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono font-semibold px-1 py-0.2 rounded bg-black/60 text-white/90 backdrop-blur-xs">
                IMAGE THUMBNAIL
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageModalOpen(true);
                  }}
                  className="p-1 rounded bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-colors cursor-pointer"
                  title="Enlarge Image"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
                {assetSrc && (
                  <a
                    href={assetSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded bg-black/60 hover:bg-black/90 text-white/80 hover:text-white transition-colors"
                    title="Open external original image in new tab"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
            <div className="text-[8px] font-mono text-white/80 px-0.5 truncate">
              {assetDef?.src ? new URL(assetDef.src, 'https://example.com').pathname.split('/').pop() : seq.id}
            </div>
          </div>
        </div>
      )}

      {/* Audio Playback Controller */}
      {(isAudio || assetType === 'audio') && (
        <div className="mb-2 p-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 flex flex-col gap-1.5">
          <audio
            ref={audioRef}
            src={assetSrc}
            preload="metadata"
            onPlay={() => setIsAudioPlaying(true)}
            onPause={() => setIsAudioPlaying(false)}
            onEnded={() => setIsAudioPlaying(false)}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleAudioPlayback}
                disabled={!assetSrc}
                className="w-7 h-7 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={isAudioPlaying ? 'Pause audio' : 'Play audio'}
              >
                {isAudioPlaying ? (
                  <Pause className="w-3.5 h-3.5 fill-current" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                )}
              </button>
              <div className="flex flex-col">
                <span className="text-[10px] font-mono font-semibold text-emerald-300">
                  {isAudioPlaying ? 'Playing Audio...' : 'Audio Track'}
                </span>
                <span className="text-[8px] font-mono text-muted-foreground truncate max-w-[150px]">
                  {assetSrc ? assetSrc.split('/').pop()?.split('?')[0] : 'Synthesized / Procedural Audio'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {assetSrc && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!audioRef.current) return;
                    audioRef.current.muted = !isAudioMuted;
                    setIsAudioMuted(!isAudioMuted);
                  }}
                  className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400 transition-colors cursor-pointer"
                  title={isAudioMuted ? 'Unmute' : 'Mute'}
                >
                  {isAudioMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                </button>
              )}
              {assetSrc && (
                <a
                  href={assetSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                  title="Open audio in new tab"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Mini Playback Equalizer Wave Animation */}
          {isAudioPlaying && (
            <div className="flex items-center gap-0.5 h-2 w-full pt-1">
              {[40, 70, 30, 90, 60, 100, 50, 80, 45, 85, 65, 95, 35, 75, 55, 90].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-emerald-400 rounded-full animate-pulse"
                  style={{
                    height: `${h}%`,
                    animationDelay: `${(i % 5) * 100}ms`,
                    animationDuration: '600ms',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Boundary Metrics (In / Out) */}
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground mb-2 bg-black/20 p-1.5 rounded-lg border border-border/40">
        <div>
          <span className="text-[9px] uppercase text-muted-foreground/60 block">In Point</span>
          <span className="text-foreground font-semibold">{startSMPTE}</span>
          <span className="text-[9px] ml-1 text-muted-foreground">({startFrame}f)</span>
        </div>
        <div>
          <span className="text-[9px] uppercase text-muted-foreground/60 block">Out Point</span>
          <span className="text-foreground font-semibold">{endSMPTE}</span>
          <span className="text-[9px] ml-1 text-muted-foreground">({endFrame}f)</span>
        </div>
      </div>

      {/* 4. Dialogue Cue Preview (if any) */}
      {cueText && (
        <div className="mb-2 text-[11px] font-sans italic text-violet-200 bg-violet-950/40 border border-violet-500/30 p-2 rounded-lg">
          "{cueText}"
        </div>
      )}

      {/* 5. Active Modifiers Chips */}
      {modifiers.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center pt-1">
          <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-0.5 mr-1">
            <Layers className="w-2.5 h-2.5" /> Modifiers ({modifiers.length}):
          </span>
          {modifiers.slice(0, 4).map((m: any, idx: number) => {
            const shortName = m.type.split('/').pop() || m.type;
            return (
              <span
                key={idx}
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-accent-theme/10 border border-accent-theme/30 text-accent-theme truncate max-w-[100px]"
              >
                {shortName}
              </span>
            );
          })}
          {modifiers.length > 4 && (
            <span className="text-[9px] font-mono text-muted-foreground">+{modifiers.length - 4}</span>
          )}
        </div>
      )}

      {/* Modal Dialog for Enlarged Image Inspection */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-3xl glass-panel border border-glass-border p-4 bg-popover/95 text-foreground backdrop-blur-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-sm font-mono">
              <span className="truncate">{seq.name || seq.id} (Full Resolution)</span>
              {assetSrc && (
                <a
                  href={assetSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-accent-theme hover:underline mr-4"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Original Asset
                </a>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 relative rounded-lg overflow-hidden border border-border/50 bg-black/80 flex items-center justify-center max-h-[70vh]">
            <img
              src={assetSrc || thumbDataUrl || ''}
              alt={seq.name || seq.id}
              className="max-h-[68vh] w-auto object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Backward-compatible alias
export const TimelineClipInsightCard = ClipInsightCard;
export type TimelineClipInsightCardProps = ClipInsightCardProps;
