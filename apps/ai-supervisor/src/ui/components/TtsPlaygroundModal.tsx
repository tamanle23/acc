import { createSignal, Show } from "solid-js";
import { Dialog, Slider } from "@ark-ui/solid";
import {
  Volume2,
  Play,
  Square,
  Sparkles,
  Zap,
  Activity,
  X,
  Gauge,
  Clock,
} from "lucide-solid";
import type { createSupervisorStore } from "../stores/supervisorStore";

interface TtsPlaygroundModalProps {
  store: ReturnType<typeof createSupervisorStore>;
}

export function TtsPlaygroundModal(props: TtsPlaygroundModalProps) {
  const [text, setText] = createSignal<string>(
    "Welcome to the Visual Storytelling Generator. Real-time neural speech synthesis operational."
  );
  const [strategy, setStrategy] = createSignal<string>("kokoro");
  const [voiceId, setVoiceId] = createSignal<string>("af_heart");
  const [speed, setSpeed] = createSignal<number[]>([1.0]);
  const [isSynthesizing, setIsSynthesizing] = createSignal<boolean>(false);
  const [benchmarkResult, setBenchmarkResult] = createSignal<{
    latencyMs: number;
    rtf: number;
    durationMs: number;
    sampleRate: number;
  } | null>(null);
  const [audioUrl, setAudioUrl] = createSignal<string | null>(null);
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null);

  const handleSynthesize = async () => {
    setIsSynthesizing(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/tts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text(),
          voice_id: voiceId(),
          speed: speed()[0],
          model_strategy: strategy(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Synthesis failed");
      }

      setBenchmarkResult({
        latencyMs: data.latencyMs,
        rtf: data.rtf,
        durationMs: data.durationMs,
        sampleRate: data.sampleRate,
      });

      // Construct audio object URL from Base64 WAV
      const binaryStr = atob(data.audioBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "audio/wav" });
      if (audioUrl()) {
        URL.revokeObjectURL(audioUrl()!);
      }
      setAudioUrl(URL.createObjectURL(blob));
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <Dialog.Root
      open={props.store.isTtsPlaygroundOpen()}
      onOpenChange={(e) => props.store.setIsTtsPlaygroundOpen(e.open)}
    >
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs transition-opacity duration-200" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <Dialog.Content class="w-full max-w-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* Header */}
          <div class="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
            <div class="flex items-center gap-3">
              <div class="p-2.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--border-focus)]/30 text-[var(--accent-primary)]">
                <Volume2 class="w-5 h-5" />
              </div>
              <div>
                <Dialog.Title class="text-base font-bold text-[var(--text-primary)]">
                  Neural TTS Synthesis Playground
                </Dialog.Title>
                <Dialog.Description class="text-xs text-[var(--text-muted)]">
                  Verify speech inference latency, voice cadence, and real-time factor
                </Dialog.Description>
              </div>
            </div>

            <Dialog.CloseTrigger class="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer">
              <X class="w-5 h-5" />
            </Dialog.CloseTrigger>
          </div>

          {/* Form Content */}
          <div class="p-6 space-y-5 overflow-y-auto">
            {/* Model Strategy Tabs */}
            <div>
              <label class="block text-xs font-semibold text-[var(--text-primary)] mb-2">
                Synthesis Strategy
              </label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStrategy("kokoro");
                    setVoiceId("af_heart");
                  }}
                  class={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                    strategy() === "kokoro"
                      ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)]/30 ring-1 ring-[var(--accent-primary)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)]"
                  }`}
                >
                  <div class="font-bold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                    <Sparkles class="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    Kokoro 82M
                  </div>
                  <div class="text-[10px] text-[var(--text-muted)] mt-0.5">Expressive Multilingual</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStrategy("vieneu");
                    setVoiceId("vie_turbo_female");
                  }}
                  class={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                    strategy() === "vieneu"
                      ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)]/30 ring-1 ring-[var(--accent-primary)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)]"
                  }`}
                >
                  <div class="font-bold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                    <Zap class="w-3.5 h-3.5 text-amber-400" />
                    VieNeu-v3-Turbo
                  </div>
                  <div class="text-[10px] text-[var(--text-muted)] mt-0.5">Vietnamese Tonal</div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStrategy("cadence");
                    setVoiceId("cadence");
                  }}
                  class={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                    strategy() === "cadence"
                      ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)]/30 ring-1 ring-[var(--accent-primary)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)]"
                  }`}
                >
                  <div class="font-bold text-xs text-[var(--text-primary)] flex items-center gap-1.5">
                    <Activity class="w-3.5 h-3.5 text-emerald-400" />
                    Cadence Tone
                  </div>
                  <div class="text-[10px] text-[var(--text-muted)] mt-0.5">Zero-Memory Fallback</div>
                </button>
              </div>
            </div>

            {/* Prompt Input */}
            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-semibold text-[var(--text-primary)]">
                  Text Prompt
                </label>
                <span class="text-[10px] text-[var(--text-muted)] font-mono">
                  {text().length} chars
                </span>
              </div>
              <textarea
                value={text()}
                onInput={(e) => setText(e.currentTarget.value)}
                rows={3}
                class="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors resize-none"
                placeholder="Enter text to synthesize..."
              />
            </div>

            {/* Voice Preset & Ark UI Speed Slider */}
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
                  Voice Profile
                </label>
                <select
                  value={voiceId()}
                  onChange={(e) => setVoiceId(e.currentTarget.value)}
                  class="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] cursor-pointer"
                >
                  <Show when={strategy() === "kokoro"}>
                    <option value="af_heart">af_heart (Expressive Neutral)</option>
                    <option value="af_bella">af_bella (Warm Female)</option>
                    <option value="am_adam">am_adam (Deep Male)</option>
                  </Show>
                  <Show when={strategy() === "vieneu"}>
                    <option value="vie_turbo_female">Ngọc Trân (VieNeu Turbo)</option>
                    <option value="vie_turbo_male">Nam Khánh (VieNeu Male)</option>
                  </Show>
                  <Show when={strategy() === "cadence"}>
                    <option value="cadence">Acoustic Cadence (24kHz Harmonic)</option>
                  </Show>
                </select>
              </div>

              {/* Ark UI Slider */}
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="text-xs font-semibold text-[var(--text-primary)]">
                    Playback Speed
                  </label>
                  <span class="text-[11px] font-mono text-[var(--accent-primary)] font-bold">
                    {speed()[0].toFixed(1)}x
                  </span>
                </div>
                <Slider.Root
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  value={speed()}
                  onValueChange={(details) => setSpeed(details.value)}
                  class="relative flex items-center select-none touch-none w-full h-8 cursor-pointer"
                >
                  <Slider.Control class="relative flex items-center w-full">
                    <Slider.Track class="bg-[var(--border-subtle)] relative grow rounded-full h-2">
                      <Slider.Range class="absolute bg-[var(--accent-primary)] rounded-full h-full" />
                    </Slider.Track>
                    <Slider.Thumb index={0} class="block w-4 h-4 bg-white border-2 border-[var(--accent-primary)] rounded-full shadow-md focus:outline-none" />
                  </Slider.Control>
                  <Slider.HiddenInput />
                </Slider.Root>
              </div>
            </div>

            {/* Error Banner */}
            <Show when={errorMsg()}>
              <div class="p-3 rounded-xl bg-[var(--status-error-bg)] border border-[var(--status-error-border)] text-xs text-[var(--status-error-text)]">
                {errorMsg()}
              </div>
            </Show>

            {/* Benchmark Card */}
            <Show when={benchmarkResult()}>
              {(res) => (
                <div class="p-3.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                  <div class="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)] border-b border-[var(--border-subtle)]/50 pb-1.5">
                    <span class="flex items-center gap-1.5 text-[var(--text-primary)]">
                      <Gauge class="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                      Inference Telemetry
                    </span>
                    <span class="font-mono text-emerald-400 font-bold">
                      RTF: {res().rtf} ({res().rtf < 1.0 ? "Faster than Real-time" : "Real-time"})
                    </span>
                  </div>

                  <div class="grid grid-cols-3 gap-2 text-center text-xs">
                    <div class="p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
                      <div class="text-[10px] text-[var(--text-muted)]">LATENCY</div>
                      <div class="font-mono font-bold text-[var(--text-primary)] mt-0.5">{res().latencyMs} ms</div>
                    </div>
                    <div class="p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
                      <div class="text-[10px] text-[var(--text-muted)]">DURATION</div>
                      <div class="font-mono font-bold text-[var(--text-primary)] mt-0.5">{res().durationMs} ms</div>
                    </div>
                    <div class="p-2 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
                      <div class="text-[10px] text-[var(--text-muted)]">SAMPLING</div>
                      <div class="font-mono font-bold text-[var(--text-primary)] mt-0.5">{res().sampleRate} Hz</div>
                    </div>
                  </div>

                  <Show when={audioUrl()}>
                    <div class="pt-2">
                      <audio controls src={audioUrl()!} class="w-full h-8" />
                    </div>
                  </Show>
                </div>
              )}
            </Show>
          </div>

          {/* Footer */}
          <div class="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => props.store.setIsTtsPlaygroundOpen(false)}
              class="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSynthesize}
              disabled={isSynthesizing() || !text().trim()}
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Show when={isSynthesizing()} fallback={<Play class="w-3.5 h-3.5" />}>
                <Clock class="w-3.5 h-3.5 animate-spin" />
              </Show>
              <span>{isSynthesizing() ? "Synthesizing..." : "Synthesize Speech"}</span>
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
