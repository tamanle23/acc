// ============================================================================
// KINETIX STUDIO v5.0 - FULLSCREEN EXHIBITION & GALLERY KIOSK PRESENTER
// Immersive presentation mode with layered gyro/pointer parallax and live QR code
// ============================================================================

import {
  createSignal,
  createMemo,
  createEffect,
  onMount,
  onCleanup,
  Show,
  type Component,
} from 'solid-js';
import { Portal } from 'solid-js/web';
import { useStudio } from '@/context/studio-context';
import { ARCHETYPE_META } from '@/constants/archetype-categories';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Minimize2,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Sparkles,
  QrCode,
  Sliders,
  Mic,
  Video,
} from 'lucide-solid';
import { copyShareableLink, generateShareableUrl, generateSvgQrCode } from '@/lib/url-state';
import { renderPosterComposition } from '@/engine/composition-engine';
import { MidiLearnModal } from './midi-learn-modal';
import { LineInAudioAdapter } from '@/adapters/driving/line-in-audio.adapter';

export interface GalleryPresenterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GalleryPresenterModal: Component<GalleryPresenterModalProps> = (props) => {
  const studio = useStudio();
  let canvasRef: HTMLCanvasElement | undefined;

  const [copied, setCopied] = createSignal<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = createSignal<boolean>(false);
  const [showQrStamp, setShowQrStamp] = createSignal<boolean>(false);
  const [qrSvg, setQrSvg] = createSignal<string>('');
  const [mouseOffset, setMouseOffset] = createSignal<{ x: number; y: number }>({ x: 0, y: 0 });

  const [isMidiModalOpen, setIsMidiModalOpen] = createSignal<boolean>(false);
  const [isLineInActive, setIsLineInActive] = createSignal<boolean>(false);
  const [isVirtualCamActive, setIsVirtualCamActive] = createSignal<boolean>(false);
  let lineInAdapter: LineInAudioAdapter | null = null;
  let virtualCamStream: MediaStream | null = null;

  const toggleLineIn = async () => {
    if (isLineInActive()) {
      if (lineInAdapter) {
        lineInAdapter.stop();
        lineInAdapter = null;
      }
      setIsLineInActive(false);
      studio.triggerToast('Line-in Microphone Stopped');
    } else {
      lineInAdapter = new LineInAudioAdapter();
      const started = await lineInAdapter.start();
      if (started) {
        lineInAdapter.subscribe(() => {
          studio.patchState({ audioReactive: true });
        });
        setIsLineInActive(true);
        studio.triggerToast('Line-in Microphone Active: Pulse On Kick Drum');
      } else {
        studio.triggerToast('Microphone access denied or unavailable');
      }
    }
  };

  const toggleVirtualCam = () => {
    if (isVirtualCamActive()) {
      if (virtualCamStream) {
        for (const t of virtualCamStream.getTracks()) t.stop();
        virtualCamStream = null;
      }
      setIsVirtualCamActive(false);
      studio.triggerToast('Virtual Camera Broadcast Stopped');
    } else if (canvasRef && typeof (canvasRef as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }).captureStream === 'function') {
      virtualCamStream = (canvasRef as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(60);
      setIsVirtualCamActive(true);
      studio.triggerToast('Virtual Camera Output Active (60 FPS Stream)');
    } else {
      studio.triggerToast('Virtual Camera capture not supported in this browser');
    }
  };

  const meta = () =>
    ARCHETYPE_META[studio.state.archetypeId] || {
      badge: 'STUDIO',
      tagColor: '#ccff00',
      sphere: 'Universal Poster',
    };

  const handlePointerMove = (e: MouseEvent) => {
    if (typeof window === 'undefined') return;
    const nx = (e.clientX / window.innerWidth - 0.5) * 2;
    const ny = (e.clientY / window.innerHeight - 0.5) * 2;
    setMouseOffset({ x: nx, y: ny });
  };

  const handleCopyLink = async () => {
    const ok = await copyShareableLink(studio.state);
    if (ok) {
      setCopied(true);
      studio.triggerToast('Copied Live Exhibition Deep-Link');
      setTimeout(() => setCopied(false), 2400);
    }
  };

  // Generate live mobile scanning QR code
  createEffect(async () => {
    if (!props.isOpen) return;
    try {
      const url = await generateShareableUrl(studio.state);
      setQrSvg(generateSvgQrCode(url, 120));
    } catch {
      // Fallback: silent
    }
  });

  // Calculate Responsive Fullscreen Stage Dimensions
  const stageDimensions = createMemo(() => {
    if (typeof window === 'undefined') return { width: 420, height: 746 };
    const maxH = Math.min(window.innerHeight * 0.86, 920);
    const maxW = Math.min(window.innerWidth * 0.88, 1280);

    let targetW: number;
    let targetH: number;

    if (studio.state.aspectRatio === '9:16') {
      targetH = maxH;
      targetW = (targetH * 9) / 16;
      if (targetW > maxW) {
        targetW = maxW;
        targetH = (targetW * 16) / 9;
      }
    } else if (studio.state.aspectRatio === '4:5') {
      targetH = maxH;
      targetW = (targetH * 4) / 5;
      if (targetW > maxW) {
        targetW = maxW;
        targetH = (targetW * 5) / 4;
      }
    } else if (studio.state.aspectRatio === '16:9') {
      targetW = maxW;
      targetH = (targetW * 9) / 16;
      if (targetH > maxH) {
        targetH = maxH;
        targetW = (targetH * 16) / 9;
      }
    } else {
      // 1:1 Square
      const side = Math.min(maxW, maxH);
      targetW = side;
      targetH = side;
    }

    return {
      width: Math.round(targetW),
      height: Math.round(targetH),
    };
  });

  // Master Canvas Rendering Loop in Fullscreen Presentation Mode
  createEffect(() => {
    if (!props.isOpen) return;
    const canvas = canvasRef;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const { width: displayW, height: displayH } = stageDimensions();

    const targetW = Math.round(displayW * dpr);
    const targetH = Math.round(displayH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    renderPosterComposition(ctx, {
      width: displayW,
      height: displayH,
      state: studio.state,
      frame: studio.currentFrame,
      totalFrames: studio.totalFrames,
      choreo: studio.choreo,
      scale: dpr,
      audioTelemetry: studio.audioTelemetry,
    });
  });

  onMount(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!props.isOpen) return;
      if (e.key === 'Escape' || e.key === 'f' || e.key === 'F') {
        props.onClose();
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMidiModalOpen(!isMidiModalOpen());
      } else if (e.key === 'l' || e.key === 'L') {
        toggleLineIn();
      } else if (e.key === 'c' || e.key === 'C') {
        toggleVirtualCam();
      }
    };
    window.addEventListener('keydown', handleKey);
    onCleanup(() => {
      window.removeEventListener('keydown', handleKey);
      if (lineInAdapter) {
        lineInAdapter.stop();
        lineInAdapter = null;
      }
      if (virtualCamStream) {
        for (const t of virtualCamStream.getTracks()) t.stop();
        virtualCamStream = null;
      }
    });
  });

  return (
    <Show when={props.isOpen}>
      <Portal mount={typeof document !== 'undefined' ? document.body : undefined}>
        <div
          role="dialog"
          aria-modal="true"
          class="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden select-none"
          onMouseMove={handlePointerMove}
        >
          {/* Subtle Ambient Vignette & 3D Parallax Stage */}
          <div
            class="relative flex items-center justify-center transition-transform duration-75 ease-out"
            style={{
              transform: `perspective(1000px) rotateY(${mouseOffset().x * 3.5}deg) rotateX(${
                -mouseOffset().y * 3.5
              }deg) translate3d(${mouseOffset().x * 12}px, ${mouseOffset().y * 12}px, 0)`,
            }}
          >
            {/* Visual Stage Container */}
            <div
              class="relative rounded-lg overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.85)] border border-white/10"
              style={{
                width: `${stageDimensions().width}px`,
                height: `${stageDimensions().height}px`,
                'background-color': studio.state.palette.bg,
              }}
            >
              <canvas
                ref={canvasRef}
                class="w-full h-full block"
                style={{
                  width: `${stageDimensions().width}px`,
                  height: `${stageDimensions().height}px`,
                }}
              />
            </div>
          </div>

          {/* TOP RIGHT FLOATING CONTROLS */}
          <div class="absolute top-6 right-6 flex items-center gap-2 z-10 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15">
            <Button
              variant="outline"
              size="xs"
              onClick={() => setShowQrStamp(!showQrStamp())}
              title={showQrStamp() ? 'Hide Mobile QR Code' : 'Show Mobile QR Code'}
            >
              <QrCode class="w-3.5 h-3.5 text-primary" />
            </Button>

            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                const next = !isAudioMuted();
                setIsAudioMuted(next);
                studio.patchState({ synthAudioSound: !next });
              }}
              title={isAudioMuted() ? 'Unmute Sound' : 'Mute Sound'}
            >
              <Show when={isAudioMuted()} fallback={<Volume2 class="w-3.5 h-3.5 text-primary" />}>
                <VolumeX class="w-3.5 h-3.5 text-muted-foreground" />
              </Show>
            </Button>

            <Button
              variant={isMidiModalOpen() ? 'primary' : 'outline'}
              size="xs"
              onClick={() => setIsMidiModalOpen(!isMidiModalOpen())}
              title="Hardware MIDI Learn (M)"
            >
              <Sliders class="w-3.5 h-3.5" />
            </Button>

            <Button
              variant={isLineInActive() ? 'primary' : 'outline'}
              size="xs"
              onClick={toggleLineIn}
              title="Line-In Audio Transient Follower (L)"
              class={isLineInActive() ? 'animate-pulse text-primary' : ''}
            >
              <Mic class="w-3.5 h-3.5" />
            </Button>

            <Button
              variant={isVirtualCamActive() ? 'primary' : 'outline'}
              size="xs"
              onClick={toggleVirtualCam}
              title="Broadcast Virtual Camera 60FPS Stream (C)"
            >
              <Video class={`w-3.5 h-3.5 ${isVirtualCamActive() ? 'text-primary' : ''}`} />
            </Button>

            <Button
              variant="outline"
              size="xs"
              onClick={handleCopyLink}
              title="Copy Live Poster Share Link"
            >
              <Show when={copied()} fallback={<Copy class="w-3.5 h-3.5" />}>
                <Check class="w-3.5 h-3.5 text-lime-400" />
              </Show>
            </Button>

            <Button
              variant="outline"
              size="xs"
              onClick={props.onClose}
              title="Exit Fullscreen Gallery (Esc)"
            >
              <Minimize2 class="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* TOP LEFT LIVE QR STAMP POPUP */}
          <Show when={showQrStamp()}>
            <div class="absolute top-20 right-6 z-10 bg-black/90 backdrop-blur-md p-3 rounded-xl border border-white/20 shadow-2xl flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
              <div
                class="p-2 bg-white rounded-lg shadow-sm"
                innerHTML={qrSvg()}
              />
              <span class="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                Scan with Phone Camera
              </span>
            </div>
          </Show>

          {/* BOTTOM LEFT EXHIBITION TITLE CARD */}
          <div class="absolute bottom-6 left-6 z-10 bg-black/75 backdrop-blur-md p-4 rounded-xl border border-white/15 max-w-sm space-y-1.5 text-white font-sans pointer-events-auto shadow-2xl">
            <div class="flex items-center gap-2">
              <Badge variant="lime" class="text-[10px]">
                {meta().badge}
              </Badge>
              <span class="text-xs font-mono font-bold tracking-widest text-zinc-400 uppercase">
                {meta().sphere}
              </span>
            </div>

            <h3 class="text-base font-bold tracking-tight text-white line-clamp-1">
              {studio.state.content.headline.join(' ')}
            </h3>

            <p class="text-xs text-zinc-400 line-clamp-1">
              {studio.state.content.subhead}
            </p>

            <div class="flex items-center gap-3 pt-1 text-[11px] font-mono text-zinc-500">
              <span>
                BPM: <strong class="text-white">{studio.state.bpm}</strong>
              </span>
              <span>•</span>
              <span>
                RATIO: <strong class="text-white">{studio.state.aspectRatio}</strong>
              </span>
              <span>•</span>
              <span class="flex items-center gap-1 text-primary">
                <Sparkles class="w-3 h-3" /> LIVE KINETIC
              </span>
            </div>
          </div>

          {/* HARDWARE MIDI LEARN MODAL */}
          <MidiLearnModal
            isOpen={isMidiModalOpen()}
            onClose={() => setIsMidiModalOpen(false)}
          />
        </div>
      </Portal>
    </Show>
  );
};
