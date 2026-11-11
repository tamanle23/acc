import { createSignal, onMount, onCleanup, For, type Component } from 'solid-js';
import { Volume2, VolumeX, Activity, Music } from 'lucide-solid';
import { useStudio } from '@/context/studio-context';
import { SYNTH_PATTERNS, type SynthPatternId, type VoiceMuteMap } from '@/engine/audio-synth';

const VOICES: { id: keyof VoiceMuteMap; label: string }[] = [
  { id: 'kick', label: 'KICK' },
  { id: 'bass', label: '303 BASS' },
  { id: 'hat', label: 'HAT' },
  { id: 'pad', label: 'PAD' },
];

export const LiveBpmStrip: Component = () => {
  const studio = useStudio();

  const [spectrum, setSpectrum] = createSignal<number[]>(new Array(16).fill(15));
  const [dbLevel, setDbLevel] = createSignal<number>(0);
  const freqBuffer = new Uint8Array(32);

  onMount(() => {
    let animId = 0;
    const updateSpectrum = () => {
      if (studio.state.audioReactive && studio.state.synthAudioSound) {
        studio.getByteFrequencyData(freqBuffer);
        const bars: number[] = [];
        for (let i = 0; i < 16; i++) {
          const val1 = freqBuffer[i * 2] ?? 0;
          const val2 = freqBuffer[i * 2 + 1] ?? 0;
          const avg = (val1 + val2) / 2;
          const pct = Math.max(8, Math.min(100, (avg / 255) * 100));
          bars.push(pct);
        }
        setSpectrum(bars);
        setDbLevel(Math.round(studio.getAudioLevel() * 100));
      } else {
        const bars: number[] = [];
        for (let i = 0; i < 16; i++) {
          const pct =
            15 +
            Math.abs(
              Math.sin(studio.rawProgress * Math.PI * 2 * 2 + i * 0.45)
            ) * 55;
          bars.push(pct);
        }
        setSpectrum(bars);
        setDbLevel(12);
      }
      animId = requestAnimationFrame(updateSpectrum);
    };

    animId = requestAnimationFrame(updateSpectrum);
    onCleanup(() => cancelAnimationFrame(animId));
  });

  return (
    <div class="p-2 rounded bg-card border border-border flex flex-col gap-2">
      {/* Top Row: BPM Status & Live Audio Spectrum */}
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => studio.handleToggleBpmSynth()}
            class="flex items-center gap-1 text-xs font-mono text-foreground hover:text-primary transition-colors cursor-pointer"
            title="Toggle Master BPM Synth Audio"
          >
            {studio.state.audioReactive && studio.state.synthAudioSound ? (
              <Volume2 class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            ) : (
              <VolumeX class="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span class="font-semibold">{studio.state.bpm} BPM</span>
          </button>
          <span class="text-[11px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {dbLevel() > 0 ? `${dbLevel()} dB` : 'MUTE'}
          </span>
        </div>

        {/* 16-Band Real-Time FFT Spectrum Analyzer */}
        <div
          class="flex items-end gap-0.5 h-4 flex-1 max-w-[140px] justify-end"
          aria-label="Real-time Audio FFT Spectrum"
        >
          <For each={spectrum()}>
            {(pct, idx) => (
              <span
                style={{
                  height: `${pct}%`,
                  'background-color':
                    idx() < 4
                      ? studio.state.palette.accent
                      : idx() < 10
                      ? studio.state.palette.accent2
                      : '#ec4899',
                }}
                class="w-1 rounded-xs transition-all duration-75 min-h-[3px]"
              />
            )}
          </For>
        </div>
      </div>

      {/* Middle Row: Full 31-Pattern Synthesizer Catalog */}
      <div class="flex flex-col gap-1 pt-0.5">
        <div class="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <span class="flex items-center gap-1 font-semibold text-foreground">
            <Music class="w-3 h-3 text-primary shrink-0" />
            SYNTH PATTERN ({SYNTH_PATTERNS.length})
          </span>
          <select
            value={studio.state.synthPattern}
            onChange={(e) => studio.setSynthPattern(e.currentTarget.value as SynthPatternId)}
            class="bg-background border border-border rounded px-1.5 py-0.5 text-[10px] font-mono text-foreground focus:outline-none focus:border-primary max-w-[150px] truncate cursor-pointer"
            title="Select Synth Sequencer Pattern"
          >
            <For each={SYNTH_PATTERNS}>
              {(p) => (
                <option value={p.id}>
                  {p.name}
                </option>
              )}
            </For>
          </select>
        </div>

        {/* Scrollable Quick Switch Pills for all Patterns */}
        <div class="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          <Activity class="w-3 h-3 text-muted-foreground shrink-0" />
          <For each={SYNTH_PATTERNS}>
            {(p) => (
              <button
                type="button"
                onClick={() => studio.setSynthPattern(p.id)}
                title={`${p.name} // ${p.desc}`}
                class={`px-2 py-0.5 rounded text-[10px] font-mono font-medium shrink-0 cursor-pointer transition-colors whitespace-nowrap ${
                  studio.state.synthPattern === p.id
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.name}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* 3-Band Audio Routing Meters: BASS -> Hero, MID -> Type, HIGH -> Shader */}
      <div class="grid grid-cols-3 gap-1.5 py-1.5 px-1.5 rounded bg-background/60 border border-border text-xs font-mono">
        <div class="flex flex-col gap-0.5">
          <div class="flex justify-between text-muted-foreground">
            <span>BASS</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-semibold">{Math.round((studio.audioTelemetry?.bass ?? 0) * 100)}%</span>
          </div>
          <div class="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              class="h-full bg-emerald-500 transition-all duration-75"
              style={{ width: `${Math.min(100, Math.max(5, (studio.audioTelemetry?.bass ?? 0) * 100))}%` }}
            />
          </div>
          <span class="text-[11px] text-muted-foreground truncate uppercase font-medium">HERO SCALE</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <div class="flex justify-between text-muted-foreground">
            <span>MID</span>
            <span class="text-cyan-700 dark:text-cyan-300 font-semibold">{Math.round((studio.audioTelemetry?.mid ?? 0) * 100)}%</span>
          </div>
          <div class="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              class="h-full bg-cyan-500 transition-all duration-75"
              style={{ width: `${Math.min(100, Math.max(5, (studio.audioTelemetry?.mid ?? 0) * 100))}%` }}
            />
          </div>
          <span class="text-[11px] text-muted-foreground truncate uppercase font-medium">TYPE FLOW</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <div class="flex justify-between text-muted-foreground">
            <span>HIGH</span>
            <span class="text-pink-600 dark:text-pink-400 font-semibold">{Math.round((studio.audioTelemetry?.high ?? 0) * 100)}%</span>
          </div>
          <div class="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              class="h-full bg-pink-500 transition-all duration-75"
              style={{ width: `${Math.min(100, Math.max(5, (studio.audioTelemetry?.high ?? 0) * 100))}%` }}
            />
          </div>
          <span class="text-[11px] text-muted-foreground truncate uppercase font-medium">SHADER TURB</span>
        </div>
      </div>

      {/* Bottom Row: Voice Mute Toggles (Kick / Bass / Hat / Pad) */}
      <div class="grid grid-cols-4 gap-1 pt-1 border-t border-border">
        <For each={VOICES}>
          {(v) => {
            const isMuted = () => studio.state.synthVoiceMutes[v.id];
            return (
              <button
                type="button"
                onClick={() => studio.toggleSynthVoice(v.id)}
                class={`py-1 px-1 rounded text-[11px] font-mono font-semibold transition-colors cursor-pointer text-center ${
                  !isMuted()
                    ? 'bg-muted text-foreground hover:bg-accent'
                    : 'bg-red-950/60 text-red-400 border border-red-900/40 line-through'
                }`}
                title={`Toggle ${v.label}`}
              >
                {v.label}
              </button>
            );
          }}
        </For>
      </div>
    </div>
  );
};
