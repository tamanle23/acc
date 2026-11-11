import { createSignal, onMount, onCleanup, For, Show, type Component } from 'solid-js';
import { Radio, Mic, Video, Activity, Zap } from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { BRAND_ARCHETYPES } from '@/constants/archetypes';
import { DeckCrossfadeMediator } from '@/engine/live-stage/deck-crossfader';
import { LineInAudioAdapter } from '@/adapters/driving/line-in-audio.adapter';
import { broadcastStreamAdapter } from '@/adapters/driven/broadcast-stream.adapter';
import { WebMidiManager, type MidiControlChangeEvent } from '@/lib/midi-controller';
import { renderPosterComposition } from '@/engine/composition-engine';
import { computeChoreography } from '@/core/domain/motion/choreography';
import type { StudioState } from '@/types/studio';

export interface VjPerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VjPerformanceModal: Component<VjPerformanceModalProps> = (props) => {
  const studio = useStudio();

  // Dual-Deck States
  const [deckAState, setDeckAState] = createSignal<StudioState>({ ...studio.state });
  const [deckBState, setDeckBState] = createSignal<StudioState>({
    ...studio.state,
    archetypeId: 'brutalist-club',
    bpm: 132,
    palette: {
      bg: '#0A0A0C',
      surface: '#141418',
      ink: '#00FF66',
      accent: '#FF0055',
      accent2: '#00E5FF',
    },
  });

  const [crossfader, setCrossfader] = createSignal<number>(0.0);
  const [isLineInActive, setIsLineInActive] = createSignal<boolean>(false);
  const [isStreaming, setIsStreaming] = createSignal<boolean>(false);
  const [kickPulse, setKickPulse] = createSignal<boolean>(false);

  let masterCanvasRef: HTMLCanvasElement | undefined;
  let mediator: DeckCrossfadeMediator | null = null;
  let lineInAdapter: LineInAudioAdapter | null = null;
  let midiManager: WebMidiManager | null = null;
  let animId: number | null = null;
  let frameCount = 0;

  onMount(() => {
    mediator = new DeckCrossfadeMediator(deckAState(), deckBState(), crossfader());
    midiManager = new WebMidiManager();
    midiManager.initialize().catch((err) => {
      console.warn('WebMidiManager initialization deferred:', err);
    });

    // Listen to hardware MIDI CC (Mod Wheel CC 1 / Slider CC 16)
    const unsubscribeMidi = midiManager.onControlChange((event: MidiControlChangeEvent) => {
      if (event.controller === 1 || event.controller === 16) {
        setCrossfader(event.normalizedValue);
        mediator?.setPosition(event.normalizedValue);
      }
    });

    // 60 FPS Render Loop for Live Master Stage
    const renderLoop = () => {
      frameCount++;
      if (masterCanvasRef && mediator) {
        const ctx = masterCanvasRef.getContext('2d');
        if (ctx) {
          const blendedState = mediator.resolveBlendedState();
          const totalFrames = 120;
          const currentFrame = frameCount % totalFrames;
          const choreo = computeChoreography(
            currentFrame / totalFrames,
            blendedState.timelineMode ?? 'studio3',
            blendedState.hicksLawDisclosure ?? true,
            blendedState.customKeyframes,
            blendedState.choreoMode ?? 'procedural-3phase'
          );

          renderPosterComposition(ctx, {
            width: masterCanvasRef.width,
            height: masterCanvasRef.height,
            state: blendedState,
            frame: currentFrame,
            totalFrames,
            choreo,
            scale: 1,
            audioTelemetry: studio.audioTelemetry,
          });
        }
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);

    onCleanup(() => {
      if (animId) cancelAnimationFrame(animId);
      unsubscribeMidi();
      midiManager?.disconnect();
      mediator?.dispose();
      lineInAdapter?.stop();
      broadcastStreamAdapter.stop();
    });
  });

  const handleCrossfaderChange = (val: number) => {
    setCrossfader(val);
    mediator?.setPosition(val);
  };

  const toggleLineIn = async () => {
    if (isLineInActive()) {
      lineInAdapter?.stop();
      setIsLineInActive(false);
      studio.triggerToast('Mic / Line-In Audio Disconnected');
      return;
    }

    if (!lineInAdapter) {
      lineInAdapter = new LineInAudioAdapter();
    }

    const success = await lineInAdapter.start();
    if (success) {
      setIsLineInActive(true);
      studio.triggerToast('🎤 Line-In Follower Connected');
      lineInAdapter.subscribe((telemetry) => {
        if (telemetry.beatPulse) {
          setKickPulse(true);
          setTimeout(() => setKickPulse(false), 80);
        }
      });
    } else {
      studio.triggerToast('Could not access microphone / line-in device');
    }
  };

  const toggleBroadcastStream = () => {
    if (isStreaming()) {
      broadcastStreamAdapter.stop();
      setIsStreaming(false);
      studio.triggerToast('Broadcast Canvas Stream Stopped');
    } else if (masterCanvasRef) {
      const stream = broadcastStreamAdapter.start(masterCanvasRef, 60);
      if (stream) {
        setIsStreaming(true);
        studio.triggerToast('🔴 Broadcast Stream Active (60 FPS NDI/OBS Compatible)');
      }
    }
  };

  const applyMasterToStage = () => {
    if (mediator) {
      studio.patchState(mediator.resolveBlendedState());
      studio.triggerToast('Applied VJ Master Blend to Main Stage');
      props.onClose();
    }
  };

  return (
    <Modal
      isOpen={props.isOpen}
      onClose={props.onClose}
      maxWidthClass="max-w-6xl"
      title={
        <div class="flex items-center gap-2">
          <Radio class="w-4 h-4 text-cyan-400 animate-pulse" />
          <h2 class="text-sm font-mono font-bold text-foreground">
            LIVE STAGE "VJ PERFORMANCE RIG" // DUAL-DECK MEDIATOR & BROADCAST
          </h2>
          <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-semibold">
            v6.0 Hardware MIDI CC 1
          </span>
        </div>
      }
    >
      <div class="p-6 flex flex-col gap-5 max-h-[85vh] overflow-y-auto no-scrollbar">
        {/* Top Hardware Controls Bar */}
        <div class="flex items-center justify-between gap-3 flex-wrap bg-muted/40 p-3 rounded-xl border border-border">
          <div class="flex items-center gap-2">
            {/* Line-In Mic Toggle */}
            <Button
              variant={isLineInActive() ? 'primary' : 'outline'}
              size="xs"
              onClick={toggleLineIn}
              class={`gap-1.5 text-xs font-mono font-semibold ${
                isLineInActive() ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : ''
              }`}
            >
              <Mic class="w-3.5 h-3.5" />
              <span>{isLineInActive() ? 'Line-In ACTIVE' : 'Connect Line-In'}</span>
              <Show when={kickPulse()}>
                <span class="w-2 h-2 rounded-full bg-red-500 animate-ping ml-1" />
              </Show>
            </Button>

            {/* OBS / Broadcast Stream Toggle */}
            <Button
              variant={isStreaming() ? 'destructive' : 'outline'}
              size="xs"
              onClick={toggleBroadcastStream}
              class="gap-1.5 text-xs font-mono font-semibold"
            >
              <Video class="w-3.5 h-3.5" />
              <span>{isStreaming() ? '🔴 ON AIR (60 FPS)' : 'Start OBS Stream'}</span>
            </Button>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <Activity class="w-3 h-3 text-cyan-400" />
              MIDI CC 1 / CC 16 Listening
            </span>
            <Button
              variant="primary"
              size="xs"
              onClick={applyMasterToStage}
              class="gap-1.5 text-xs font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90"
            >
              <Zap class="w-3.5 h-3.5" />
              Commit Master to Stage
            </Button>
          </div>
        </div>

        {/* 3-Column Layout: Deck A | Master Stage | Deck B */}
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
          {/* Deck A Control Panel */}
          <div class="border border-border rounded-xl p-4 bg-card flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                DECK A // {(100 - crossfader() * 100).toFixed(0)}%
              </span>
              <span class="text-xs font-mono text-muted-foreground">BPM {deckAState().bpm}</span>
            </div>

            {/* Archetype Selector */}
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-mono text-muted-foreground">Archetype:</label>
              <select
                class="text-xs bg-muted/50 border border-border rounded p-1.5 text-foreground font-mono"
                value={deckAState().archetypeId}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  const found = BRAND_ARCHETYPES.find((a) => a.id === val);
                  const nextState: StudioState = {
                    ...deckAState(),
                    ...(found?.patch ?? {}),
                    archetypeId: val,
                  };
                  setDeckAState(nextState);
                  if (mediator) mediator.deckA = nextState;
                }}
              >
                <For each={BRAND_ARCHETYPES}>
                  {(arch) => <option value={arch.id}>{arch.name}</option>}
                </For>
              </select>
            </div>

            {/* Deck A Color Swatch */}
            <div class="flex h-4 rounded overflow-hidden border border-border">
              <div class="flex-1" style={{ 'background-color': deckAState().palette.bg }} />
              <div class="flex-1" style={{ 'background-color': deckAState().palette.surface }} />
              <div class="flex-1" style={{ 'background-color': deckAState().palette.ink }} />
              <div class="flex-1" style={{ 'background-color': deckAState().palette.accent }} />
              <div class="flex-1" style={{ 'background-color': deckAState().palette.accent2 }} />
            </div>
          </div>

          {/* Master Live Canvas Viewport (Center 2 columns) */}
          <div class="lg:col-span-2 border-2 border-border/80 rounded-xl p-4 bg-background/90 flex flex-col items-center gap-3 shadow-xl">
            <div class="flex items-center justify-between w-full">
              <span class="text-xs font-mono font-bold text-foreground flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                MASTER STAGE OUT // 60 FPS
              </span>
              <span class="text-xs font-mono text-muted-foreground">
                X-FADE: {(crossfader() * 100).toFixed(0)}%
              </span>
            </div>

            {/* Live Master Canvas */}
            <div class="relative rounded-lg overflow-hidden border border-border shadow-2xl bg-black">
              <canvas
                ref={masterCanvasRef}
                width={380}
                height={380}
                class="w-[320px] h-[320px] sm:w-[380px] sm:h-[380px] object-contain"
              />
            </div>

            {/* Big Dual-Deck Crossfader Slider */}
            <div class="w-full flex flex-col gap-1.5 pt-2">
              <div class="flex items-center justify-between text-xs font-mono font-bold">
                <span class="text-cyan-400">DECK A (0.0)</span>
                <button
                  type="button"
                  onClick={() => handleCrossfaderChange(0.5)}
                  class="px-2 py-0.5 rounded bg-muted hover:bg-accent text-[10px] text-muted-foreground cursor-pointer"
                  title="Snap Crossfader to 50/50 Center"
                >
                  CENTER 50/50
                </button>
                <span class="text-red-400">DECK B (1.0)</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.005"
                value={crossfader()}
                onInput={(e) => handleCrossfaderChange(parseFloat(e.currentTarget.value))}
                class="w-full h-3 bg-muted rounded-lg appearance-none cursor-ew-resize accent-primary"
              />
            </div>
          </div>

          {/* Deck B Control Panel */}
          <div class="border border-border rounded-xl p-4 bg-card flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-bold text-red-400 uppercase tracking-wider">
                DECK B // {(crossfader() * 100).toFixed(0)}%
              </span>
              <span class="text-xs font-mono text-muted-foreground">BPM {deckBState().bpm}</span>
            </div>

            {/* Archetype Selector */}
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-mono text-muted-foreground">Archetype:</label>
              <select
                class="text-xs bg-muted/50 border border-border rounded p-1.5 text-foreground font-mono"
                value={deckBState().archetypeId}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  const found = BRAND_ARCHETYPES.find((a) => a.id === val);
                  const nextState: StudioState = {
                    ...deckBState(),
                    ...(found?.patch ?? {}),
                    archetypeId: val,
                  };
                  setDeckBState(nextState);
                  if (mediator) mediator.deckB = nextState;
                }}
              >
                <For each={BRAND_ARCHETYPES}>
                  {(arch) => <option value={arch.id}>{arch.name}</option>}
                </For>
              </select>
            </div>

            {/* Deck B Color Swatch */}
            <div class="flex h-4 rounded overflow-hidden border border-border">
              <div class="flex-1" style={{ 'background-color': deckBState().palette.bg }} />
              <div class="flex-1" style={{ 'background-color': deckBState().palette.surface }} />
              <div class="flex-1" style={{ 'background-color': deckBState().palette.ink }} />
              <div class="flex-1" style={{ 'background-color': deckBState().palette.accent }} />
              <div class="flex-1" style={{ 'background-color': deckBState().palette.accent2 }} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
