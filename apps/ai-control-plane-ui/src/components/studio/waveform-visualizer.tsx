import { createSignal, createEffect, onMount, onCleanup, Show } from "solid-js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Sparkles,
  Activity,
  Radio,
  Maximize2,
  Minimize2,
} from "lucide-solid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface StudioAudioPlayerProps {
  audioUrl: string;
  voiceName: string;
  backendUsed: string;
  durationSeconds: number;
  roundtripSec: number;
  requestId: string;
  payloadSha256: string;
  compactDock?: boolean;
  onExpandInspector?: () => void;
  externalAnalyser?: AnalyserNode | null;
  isStreaming?: boolean;
}

export function StudioAudioPlayer(props: StudioAudioPlayerProps) {
  let audioEl: HTMLAudioElement | undefined;
  let canvasEl: HTMLCanvasElement | undefined;
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  let rafId: number | null = null;

  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isMuted, setIsMuted] = createSignal(false);
  const [isLooping, setIsLooping] = createSignal(false);
  const [playbackRate, setPlaybackRate] = createSignal<number>(1.0);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [totalDuration, setTotalDuration] = createSignal(props.durationSeconds || 0);
  const [visualMode, setVisualMode] = createSignal<"bars" | "wave" | "spectrogram">("bars");

  const cycleVisualMode = () => {
    const modes: Array<"bars" | "wave" | "spectrogram"> = ["bars", "wave", "spectrogram"];
    const nextIdx = (modes.indexOf(visualMode()) + 1) % modes.length;
    setVisualMode(modes[nextIdx]);
  };

  onCleanup(() => {
    if (rafId) cancelAnimationFrame(rafId);
    if (audioCtx && audioCtx.state !== "closed") {
      void audioCtx.close().catch(() => {});
      audioCtx = null;
    }
  });

  const drawIdleCanvas = () => {
    if (!canvasEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const width = canvasEl.width;
    const height = canvasEl.height;
    ctx.clearRect(0, 0, width, height);

    const style = getComputedStyle(document.documentElement);
    const primaryHsl = style.getPropertyValue("--primary").trim() || "238.7 83.5% 66.7%";

    if (visualMode() === "spectrogram") {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, `hsl(${primaryHsl} / 0.15)`);
      grad.addColorStop(1, `hsl(${primaryHsl} / 0.03)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = `hsl(${primaryHsl} / 0.2)`;
      ctx.lineWidth = 1;
      for (let y = 5; y < height; y += 6) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      return;
    }

    const barCount = props.compactDock ? 36 : 48;
    const gap = 3;
    const barWidth = (width - gap * (barCount - 1)) / barCount;

    for (let i = 0; i < barCount; i++) {
      const env = Math.sin((i / barCount) * Math.PI);
      const pseudo = (Math.sin(i * 1.7) * 0.3 + 0.4) * env;
      const barHeight = Math.max(4, pseudo * (height * 0.65));
      const x = i * (barWidth + gap);
      const y = (height - barHeight) / 2;

      ctx.fillStyle = `hsl(${primaryHsl} / 0.38)`;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 2);
      ctx.fill();
    }
  };

  createEffect(() => {
    // track dependencies
    const _url = props.audioUrl;
    const _mode = visualMode();
    const _dur = props.durationSeconds;
    const _streaming = props.isStreaming;
    const _extAnalyser = props.externalAnalyser;

    if (_streaming && _extAnalyser) {
      setIsPlaying(true);
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(renderFrame);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
      setTotalDuration(_dur || 0);
      drawIdleCanvas();
      if (rafId) cancelAnimationFrame(rafId);
    }
  });

  const getActiveAnalyser = () => props.externalAnalyser || analyser;

  const ensureAudioGraph = () => {
    if (!audioEl) return;
    if (!audioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const ana = ctx.createAnalyser();
      ana.fftSize = 128;
      ana.smoothingTimeConstant = 0.82;
      const src = ctx.createMediaElementSource(audioEl);
      src.connect(ana);
      ana.connect(ctx.destination);

      audioCtx = ctx;
      analyser = ana;
      source = src;
    }
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
  };

  const renderFrame = () => {
    const activeAnalyser = getActiveAnalyser();
    if (!canvasEl || !activeAnalyser) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const width = canvasEl.width;
    const height = canvasEl.height;
    if (visualMode() !== "spectrogram") {
      ctx.clearRect(0, 0, width, height);
    }

    const style = getComputedStyle(document.documentElement);
    const primaryHsl = style.getPropertyValue("--primary").trim() || "238.7 83.5% 66.7%";
    const accentHsl = style.getPropertyValue("--accent").trim() || primaryHsl;

    if (visualMode() === "bars") {
      const bufferLength = activeAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      activeAnalyser.getByteFrequencyData(dataArray);

      const barCount = props.compactDock ? 36 : 48;
      const gap = 3;
      const barWidth = (width - gap * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i % bufferLength] / 255.0;
        const barHeight = Math.max(4, val * (height - 6));
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, `hsl(${primaryHsl})`);
        grad.addColorStop(1, `hsl(${accentHsl} / 0.5)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    } else if (visualMode() === "wave") {
      const bufferLength = activeAnalyser.fftSize;
      const dataArray = new Uint8Array(bufferLength);
      activeAnalyser.getByteTimeDomainData(dataArray);

      ctx.lineWidth = 2;
      ctx.strokeStyle = `hsl(${primaryHsl})`;
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    } else {
      // Real-time Spectrogram Waterfall
      ctx.drawImage(canvasEl, -2, 0);
      ctx.clearRect(width - 2, 0, 2, height);

      const bufferLength = activeAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      activeAnalyser.getByteFrequencyData(dataArray);

      const numBins = Math.min(bufferLength, 24);
      const binHeight = height / numBins;

      for (let b = 0; b < numBins; b++) {
        const intensity = dataArray[b] / 255.0;
        const y = height - (b + 1) * binHeight;
        const hue = 260 - intensity * 240;
        const lightness = Math.max(12, intensity * 75);
        const alpha = Math.max(0.2, intensity);

        ctx.fillStyle = `hsla(${hue}, 85%, ${lightness}%, ${alpha})`;
        ctx.fillRect(width - 2, y, 2, Math.ceil(binHeight));
      }
    }

    rafId = requestAnimationFrame(renderFrame);
  };

  const togglePlay = async () => {
    if (!audioEl) return;
    try {
      ensureAudioGraph();
      if (audioEl.paused) {
        await audioEl.play();
        setIsPlaying(true);
        rafId = requestAnimationFrame(renderFrame);
      } else {
        audioEl.pause();
        setIsPlaying(false);
        if (rafId) cancelAnimationFrame(rafId);
      }
    } catch {
      if (audioEl.paused) {
        await audioEl.play();
        setIsPlaying(true);
      } else {
        audioEl.pause();
        setIsPlaying(false);
      }
    }
  };

  const toggleMute = () => {
    if (!audioEl) return;
    audioEl.muted = !audioEl.muted;
    setIsMuted(audioEl.muted);
  };

  const cyclePlaybackRate = () => {
    const rates = [0.75, 1.0, 1.25, 1.5];
    const nextIdx = (rates.indexOf(playbackRate()) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioEl) {
      audioEl.playbackRate = nextRate;
    }
  };

  const toggleLoop = () => {
    const nextLoop = !isLooping();
    setIsLooping(nextLoop);
    if (audioEl) {
      audioEl.loop = nextLoop;
    }
  };

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return "0:00.0";
    const mins = Math.floor(sec / 60);
    const rem = (sec % 60).toFixed(1).padStart(4, "0");
    return `${mins}:${rem}`;
  };

  return (
    <Show
      when={!props.compactDock}
      fallback={
        <div class="w-full flex items-center justify-between gap-3 px-4 py-2.5 bg-card/95 border-t border-border backdrop-blur-xl shadow-2xl">
          <audio
            ref={audioEl}
            src={props.audioUrl}
            onTimeUpdate={() => setCurrentTime(audioEl?.currentTime ?? 0)}
            onLoadedMetadata={() => {
              if (audioEl?.duration && Number.isFinite(audioEl.duration)) {
                setTotalDuration(audioEl.duration);
              }
            }}
            onEnded={() => {
              setIsPlaying(false);
              if (rafId) cancelAnimationFrame(rafId);
              drawIdleCanvas();
            }}
            class="hidden"
          />

          {/* Left: Active Voice & Engine Info */}
          <div class="flex items-center gap-3 min-w-0 sm:w-56">
            <Button
              type="button"
              size="icon"
              onClick={togglePlay}
              aria-label={isPlaying() ? "Pause master audio" : "Play master audio"}
              class="h-10 w-10 shrink-0 rounded-full"
            >
              <Show when={isPlaying()} fallback={<Play class="w-4 h-4 fill-current ml-0.5" />}>
                <Pause class="w-4 h-4 fill-current" />
              </Show>
            </Button>
            <div class="truncate">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-semibold text-foreground truncate">{props.voiceName}</span>
                <Show
                  when={props.isStreaming}
                  fallback={
                    <Badge variant="success" class="px-1.5 py-0 text-[9px] hidden sm:inline-flex">
                      48kHz
                    </Badge>
                  }
                >
                  <Badge variant="destructive" class="px-1.5 py-0 text-[9px] animate-pulse">
                    LIVE STREAM
                  </Badge>
                </Show>
              </div>
              <div class="text-[10px] font-mono text-muted-foreground truncate">
                {props.backendUsed} • {props.roundtripSec}s RT
              </div>
            </div>
          </div>

          {/* Center: Live Scrubber + Mini FFT Canvas */}
          <div class="flex-1 max-w-2xl flex items-center gap-3">
            <span class="text-[11px] font-mono text-muted-foreground hidden md:inline w-12 text-right">
              {formatTime(currentTime())}
            </span>

            <div class="flex-1 flex items-center gap-3 bg-surface/90 border border-border/80 rounded-lg px-3 py-1.5">
              <canvas
                ref={canvasEl}
                width={220}
                height={28}
                class="w-28 sm:w-40 h-7 shrink-0 block"
              />
              <input
                type="range"
                min={0}
                max={totalDuration() || props.durationSeconds || 1}
                step={0.05}
                value={currentTime()}
                onInput={(e) => {
                  const val = parseFloat(e.currentTarget.value);
                  if (audioEl) {
                    audioEl.currentTime = val;
                    setCurrentTime(val);
                  }
                }}
                aria-label="Master timeline scrubber"
                class="studio-slider flex-1"
              />
            </div>

            <span class="text-[11px] font-mono text-muted-foreground hidden md:inline w-12">
              {formatTime(totalDuration() || props.durationSeconds)}
            </span>
          </div>

          {/* Right: Mode Toggle, Mute, Download, Inspector */}
          <div class="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={cyclePlaybackRate}
              class="hidden md:inline-flex items-center px-2 py-1.5 rounded-lg border border-border bg-surface text-[11px] font-mono text-primary font-semibold hover:border-primary/50 transition"
              title="Cycle DAW Playback Rate (0.75x / 1.0x / 1.25x / 1.5x)"
            >
              {playbackRate()}x
            </button>

            <button
              type="button"
              onClick={toggleLoop}
              class={`hidden md:inline-flex items-center px-2 py-1.5 rounded-lg border text-[11px] font-mono transition ${
                isLooping()
                  ? "border-primary bg-primary/15 text-primary font-semibold"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
              title="Toggle Master Audio Loop"
            >
              Loop
            </button>

            <button
              type="button"
              onClick={cycleVisualMode}
              class="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface text-[11px] font-mono text-muted-foreground hover:text-foreground transition"
              title="Cycle Visualizer (FFT / Wave / Spectrogram Waterfall)"
            >
              <Activity class="w-3.5 h-3.5 text-primary" />
              <span>{visualMode() === "bars" ? "FFT" : visualMode() === "wave" ? "Wave" : "Waterfall"}</span>
            </button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              aria-label={isMuted() ? "Unmute master audio" : "Mute master audio"}
              class="hidden sm:inline-flex h-9 w-9"
            >
              <Show when={isMuted()} fallback={<Volume2 class="w-4 h-4" />}>
                <VolumeX class="w-4 h-4 text-destructive" />
              </Show>
            </Button>

            <a
              href={props.audioUrl}
              download={`vieneu-v3-turbo-${props.voiceName}-48khz.wav`}
              class="inline-flex h-9 px-3 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground hover:opacity-90 text-xs font-medium transition"
              title="Download 48 kHz WAV Master"
            >
              <Download class="w-3.5 h-3.5" />
              <span class="hidden sm:inline">WAV</span>
            </a>

            <Show when={props.onExpandInspector}>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={props.onExpandInspector}
                class="xl:hidden h-9 w-9"
                aria-label="Open Studio Inspector Drawer"
                title="Open Takes & Voice Inspector"
              >
                <Maximize2 class="w-4 h-4" />
              </Button>
            </Show>
          </div>
        </div>
      }
    >
      <div class="rounded-xl border border-border bg-surface/90 p-4 space-y-4 shadow-inner">
        <audio
          ref={audioEl}
          src={props.audioUrl}
          onTimeUpdate={() => setCurrentTime(audioEl?.currentTime ?? 0)}
          onLoadedMetadata={() => {
            if (audioEl?.duration && Number.isFinite(audioEl.duration)) {
              setTotalDuration(audioEl.duration);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            if (rafId) cancelAnimationFrame(rafId);
            drawIdleCanvas();
          }}
          class="hidden"
        />

        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <Badge variant="default">
              <Sparkles class="w-3 h-3" /> {props.voiceName}
            </Badge>
            <Badge variant="outline">{props.backendUsed}</Badge>
            <Show when={props.isStreaming}>
              <Badge variant="destructive" class="animate-pulse px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider">
                ● LIVE STREAMING
              </Badge>
            </Show>
          </div>

          <div class="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cyclePlaybackRate}
              class="text-[10px] font-mono px-2 py-1 rounded-md border border-border bg-card text-primary font-semibold hover:border-primary/50 transition"
              title="Cycle Playback Rate"
            >
              {playbackRate()}x
            </button>
            <button
              type="button"
              onClick={toggleLoop}
              class={`text-[10px] font-mono px-2 py-1 rounded-md border transition ${
                isLooping()
                  ? "border-primary bg-primary/15 text-primary font-semibold"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
              title="Toggle Region Loop"
            >
              Loop
            </button>
            <button
              type="button"
              onClick={cycleVisualMode}
              class="text-[11px] font-mono px-2.5 py-1 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground transition flex items-center gap-1"
              title="Cycle Visualizer (FFT / Wave / Spectrogram Waterfall)"
            >
              <Activity class="w-3 h-3 text-primary" />
              <span>{visualMode() === "bars" ? "FFT Spectrum" : visualMode() === "wave" ? "Oscilloscope" : "Waterfall Spec"}</span>
            </button>
          </div>
        </div>

        <div class="relative rounded-lg border border-border/80 bg-background/80 p-3 overflow-hidden">
          <canvas ref={canvasEl} width={480} height={88} class="w-full h-20 block" />
          <div class="mt-2 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span>{formatTime(currentTime())}</span>
            <span class="text-primary font-semibold">48,000 Hz • 16-bit PCM</span>
            <span>{formatTime(totalDuration() || props.durationSeconds)}</span>
          </div>
        </div>

        <div class="flex items-center gap-2.5">
          <Button
            type="button"
            size="icon"
            onClick={togglePlay}
            aria-label={isPlaying() ? "Pause audio" : "Play audio"}
          >
            <Show when={isPlaying()} fallback={<Play class="w-4 h-4 fill-current" />}>
              <Pause class="w-4 h-4 fill-current" />
            </Show>
          </Button>

          <input
            type="range"
            min={0}
            max={totalDuration() || props.durationSeconds || 1}
            step={0.05}
            value={currentTime()}
            onInput={(e) => {
              const val = parseFloat(e.currentTarget.value);
              if (audioEl) {
                audioEl.currentTime = val;
                setCurrentTime(val);
              }
            }}
            aria-label="Seek audio timeline"
            class="studio-slider flex-1"
          />

          <a
            href={props.audioUrl}
            download={`vieneu-v3-turbo-${props.voiceName}-48khz.wav`}
            class="inline-flex h-10 px-3 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary text-secondary-foreground hover:opacity-90 text-xs font-medium transition"
          >
            <Download class="w-3.5 h-3.5" />
            <span>WAV</span>
          </a>
        </div>

        <div class="grid grid-cols-3 gap-2 pt-2 border-t border-border/70 text-[10px] font-mono">
          <div class="p-2 rounded-lg bg-card border border-border/60">
            <span class="text-muted-foreground block">ROUNDTRIP</span>
            <span class="text-success font-semibold">{props.roundtripSec}s</span>
          </div>
          <div class="p-2 rounded-lg bg-card border border-border/60">
            <span class="text-muted-foreground block">REQ ID</span>
            <span class="text-foreground truncate block" title={props.requestId}>
              {props.requestId.slice(0, 8)}...
            </span>
          </div>
          <div class="p-2 rounded-lg bg-card border border-border/60">
            <span class="text-muted-foreground block">SHA-256</span>
            <span class="text-primary truncate block" title={props.payloadSha256}>
              {props.payloadSha256.slice(0, 8)}...
            </span>
          </div>
        </div>
      </div>
    </Show>
  );
}
