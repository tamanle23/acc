import { createSignal, Show, For, Switch, Match } from "solid-js";
import type { DagStageExecutionResult } from "@acc/ai-control-plane-sdk";
import {
  Eye,
  Copy,
  Check,
  Download,
  Volume2,
  Image as ImageIcon,
  FileText,
  Clock,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
  Play,
  Pause,
} from "lucide-solid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPipelineStudioStyle } from "@/components/studio/bespoke-pipeline-studios";

export interface DagStageInspectorProps {
  stage: DagStageExecutionResult | null;
  allStages: DagStageExecutionResult[];
  selectedIndex: number | null;
  onSelectIndex: (index: number) => void;
  onOpenInLens: (stage: DagStageExecutionResult) => void;
}

export function DagStageInspector(props: DagStageInspectorProps) {
  const [copied, setCopied] = createSignal(false);
  const [audioPlaying, setAudioPlaying] = createSignal(false);
  let audioEl: HTMLAudioElement | undefined;

  const copyToClipboard = (text: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const currentStage = () => props.stage;
  const pStyle = () =>
    currentStage() ? getPipelineStudioStyle(currentStage()!.pipeline_type) : null;

  const toggleAudio = () => {
    if (!audioEl) return;
    if (audioEl.paused) {
      audioEl.play().catch(() => {});
      setAudioPlaying(true);
    } else {
      audioEl.pause();
      setAudioPlaying(false);
    }
  };

  const getResolvedAudioSrc = () => {
    const s = currentStage();
    if (!s || !s.output) return null;
    if (typeof s.output === "string" && s.output.startsWith("data:audio")) return s.output;
    if (s.output.audio_url) return s.output.audio_url;
    if (s.output.audio_base64) return `data:audio/wav;base64,${s.output.audio_base64}`;
    if (s.output.wav_base64) return `data:audio/wav;base64,${s.output.wav_base64}`;
    return null;
  };

  const getResolvedImageSrc = () => {
    const s = currentStage();
    if (!s || !s.output) return null;
    if (typeof s.output === "string" && s.output.startsWith("data:image")) return s.output;
    if (s.output.image_url) return s.output.image_url;
    if (s.output.image_base64) return `data:image/png;base64,${s.output.image_base64}`;
    if (s.output.image_data_uri) return s.output.image_data_uri;
    if (s.output.alpha_matte_base64) return `data:image/png;base64,${s.output.alpha_matte_base64}`;
    return null;
  };

  const getResolvedTextOutput = () => {
    const s = currentStage();
    if (!s || !s.output) return "";
    if (typeof s.output === "string") return s.output;
    if (s.output.transcript) return s.output.transcript;
    if (s.output.text) return s.output.text;
    if (s.output.summary) return s.output.summary;
    if (s.output.generated_text) return s.output.generated_text;
    return JSON.stringify(s.output, null, 2);
  };

  return (
    <div class="rounded-xl border border-border bg-card/90 p-4 space-y-4 shadow-sm">
      {/* Header with Stage Tabs and Actions */}
      <div class="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div class="flex items-center gap-2">
          <Layers class="w-4 h-4 text-primary" />
          <span class="text-xs font-bold text-foreground uppercase tracking-wide">
            Stage Artifact Inspector
          </span>
          <span class="text-xs text-muted-foreground">({props.allStages.length} Executed)</span>
        </div>

        {/* Stage Selector Pills */}
        <div class="flex flex-wrap items-center gap-1">
          <For each={props.allStages}>
            {(st, idx) => {
              const isSelected = () =>
                (props.selectedIndex ?? props.allStages.length - 1) === idx();
              return (
                <button
                  type="button"
                  onClick={() => props.onSelectIndex(idx())}
                  class={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition ${
                    isSelected()
                      ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                      : "bg-surface text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  #{idx() + 1} {st.label.split(" (")[0]}
                </button>
              );
            }}
          </For>
        </div>
      </div>

      <Show
        when={currentStage()}
        fallback={
          <div class="h-32 flex items-center justify-center text-xs text-muted-foreground italic">
            Execute a DAG above to inspect individual stage artifacts.
          </div>
        }
      >
        {/* Stage Overview Banner */}
        <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-surface/80 border border-border/70 text-xs">
          <div class="flex flex-wrap items-center gap-2">
            <Badge variant="default" class="font-mono text-[10px]">
              Stage #{currentStage()!.stage_index}
            </Badge>
            <span class="font-bold text-foreground">{currentStage()!.label}</span>
            <span
              class={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                pStyle()?.accentBg || "bg-card"
              } ${pStyle()?.accentText || "text-primary"} ${
                pStyle()?.accentBorder || "border-border"
              }`}
            >
              {currentStage()!.pipeline_type}
            </span>
            <Show when={currentStage()!.cached}>
              <Badge variant="outline" class="border-cyan-500/50 text-cyan-400 text-[10px]">
                SHA-256 CACHE HIT
              </Badge>
            </Show>
          </div>

          <div class="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => props.onOpenInLens(currentStage()!)}
              class="h-7 px-2.5 text-xs font-medium"
            >
              <Eye class="w-3.5 h-3.5 text-primary mr-1" />
              <span>Open in Lens</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(JSON.stringify(currentStage()!.output, null, 2))}
              class="h-7 px-2 text-xs"
              title="Copy stage output JSON"
            >
              <Show when={copied()} fallback={<Copy class="w-3.5 h-3.5" />}>
                <Check class="w-3.5 h-3.5 text-success" />
              </Show>
            </Button>
          </div>
        </div>

        {/* Dynamic Modality Artifact Rendering */}
        <div class="p-3.5 rounded-xl border border-border/80 bg-surface/50">
          <Switch>
            {/* Audio Artifact */}
            <Match when={getResolvedAudioSrc()}>
              <div class="space-y-3">
                <audio
                  ref={audioEl}
                  src={getResolvedAudioSrc()!}
                  onEnded={() => setAudioPlaying(false)}
                  class="hidden"
                />
                <div class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-2">
                    <Button
                      size="icon"
                      onClick={toggleAudio}
                      class="h-9 w-9 rounded-full shrink-0"
                    >
                      <Show when={audioPlaying()} fallback={<Play class="w-4 h-4 fill-current ml-0.5" />}>
                        <Pause class="w-4 h-4 fill-current" />
                      </Show>
                    </Button>
                    <div>
                      <div class="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Volume2 class="w-3.5 h-3.5 text-primary" />
                        <span>Acoustic Waveform Output</span>
                      </div>
                      <div class="text-[10px] font-mono text-muted-foreground">
                        {currentStage()!.engine_id} • 48,000 Hz 16-bit PCM
                      </div>
                    </div>
                  </div>

                  <a
                    href={getResolvedAudioSrc()!}
                    download={`dag-stage-${currentStage()!.stage_index}-${currentStage()!.engine_id}.wav`}
                    class="inline-flex h-8 px-2.5 items-center justify-center gap-1 rounded-lg border border-border bg-card text-foreground hover:bg-card/80 text-xs font-medium transition"
                  >
                    <Download class="w-3.5 h-3.5" />
                    <span>WAV</span>
                  </a>
                </div>
              </div>
            </Match>

            {/* Image Artifact */}
            <Match when={getResolvedImageSrc()}>
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <ImageIcon class="w-3.5 h-3.5 text-primary" />
                    <span>Synthesized Visual Canvas</span>
                  </div>
                  <a
                    href={getResolvedImageSrc()!}
                    download={`dag-stage-${currentStage()!.stage_index}-${currentStage()!.engine_id}.png`}
                    class="inline-flex h-7 px-2.5 items-center justify-center gap-1 rounded-lg border border-border bg-card text-foreground hover:bg-card/80 text-xs font-medium transition"
                  >
                    <Download class="w-3 h-3" />
                    <span>PNG</span>
                  </a>
                </div>

                <div class="relative rounded-lg border border-border/80 bg-background/60 p-2 flex items-center justify-center overflow-hidden max-h-72">
                  <img
                    src={getResolvedImageSrc()!}
                    alt={`DAG Stage ${currentStage()!.stage_index} Output`}
                    class="max-h-64 object-contain rounded-md shadow-md"
                  />
                </div>
              </div>
            </Match>

            {/* Text / Markdown / JSON Fallback */}
            <Match when={true}>
              <div class="space-y-2">
                <div class="flex items-center justify-between text-xs text-muted-foreground">
                  <span class="flex items-center gap-1">
                    <FileText class="w-3.5 h-3.5 text-primary" />
                    <span>Stage Text / JSON Representation</span>
                  </span>
                  <span class="font-mono text-[10px]">
                    {getResolvedTextOutput().length} characters
                  </span>
                </div>
                <pre class="p-3 rounded-lg border border-border bg-background/80 font-mono text-xs text-foreground/90 overflow-x-auto max-h-56 studio-scroll whitespace-pre-wrap break-words">
                  {getResolvedTextOutput()}
                </pre>
              </div>
            </Match>
          </Switch>
        </div>

        {/* Bottom Hardware & Cryptographic Proof Strip */}
        <div class="grid grid-cols-3 gap-2 text-[10px] font-mono">
          <div class="p-2 rounded-lg bg-surface border border-border/70 flex items-center justify-between">
            <span class="text-muted-foreground flex items-center gap-1">
              <Clock class="w-3 h-3 text-primary" /> LATENCY
            </span>
            <span class="text-success font-bold">{currentStage()!.latency_ms} ms</span>
          </div>

          <div class="p-2 rounded-lg bg-surface border border-border/70 flex items-center justify-between">
            <span class="text-muted-foreground flex items-center gap-1">
              <Cpu class="w-3 h-3 text-primary" /> ENGINE ID
            </span>
            <span class="text-foreground truncate max-w-[120px]" title={currentStage()!.engine_id}>
              {currentStage()!.engine_id}
            </span>
          </div>

          <div class="p-2 rounded-lg bg-surface border border-border/70 flex items-center justify-between">
            <span class="text-muted-foreground flex items-center gap-1">
              <ShieldCheck class="w-3 h-3 text-cyan-400" /> SHA-256
            </span>
            <span
              class="text-primary font-bold truncate max-w-[100px]"
              title={currentStage()!.artifact_sha256}
            >
              {currentStage()!.artifact_sha256.slice(0, 10)}...
            </span>
          </div>
        </div>
      </Show>
    </div>
  );
}
