import { createSignal, createMemo, createEffect, onCleanup, Show, For } from "solid-js";
import {
  Sparkles,
  Cpu,
  Wand2,
  Image as ImageIcon,
  Download,
  Scissors,
} from "lucide-solid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface DiffusionVisualizerProps {
  output: {
    prompt?: string;
    negative_prompt?: string;
    seed?: number;
    num_inference_steps?: number;
    guidance_scale?: number;
    aspect_ratio?: string;
    scheduler_sampler?: string;
    weight_tier?: string;
    precision?: string;
    offload_strategy?: string;
    speedup_multiplier?: number;
    quality_retention_pct?: number;
    generated_image_id?: string;
    image_data_uri?: string;
    palette_swatches?: string[];
    prompt_scene_graph?: Record<string, any>;
    latent_steps?: Array<{
      step: number;
      total_steps: number;
      progress_pct: number;
      latent_noise_sigma: number;
      preview_data_uri: string;
    }>;
  };
  livePromptText?: string;
  liveParams?: Record<string, any>;
  activeModelId?: string;
  activeEngineId?: string;
  activeWeightTier?: string;
  activePrecision?: string;
  activeSpeedup?: number;
  isStreaming?: boolean;
  onPipeToRmbg?: (generatedImageId: string, prompt: string, imageDataUri?: string) => void;
}

export function DiffusionImageLens(props: DiffusionVisualizerProps) {
  const promptText = createMemo(() =>
    (props.livePromptText && props.livePromptText.trim()) ||
    props.output?.prompt ||
    "A majestic red dragon flying over snowy alpine mountains at sunset"
  );

  const seedVal = createMemo(() => Number(props.liveParams?.seed ?? props.output?.seed ?? 42));
  const totalSteps = createMemo(() => Number(props.liveParams?.num_inference_steps ?? props.output?.num_inference_steps ?? 4));
  const guidanceScale = createMemo(() => Number(props.liveParams?.guidance_scale ?? props.output?.guidance_scale ?? 3.5));
  const aspectRatio = createMemo(() => String(props.liveParams?.aspect_ratio ?? props.output?.aspect_ratio ?? "1024x1024"));
  const schedulerSampler = createMemo(() => String(props.liveParams?.scheduler_sampler ?? props.output?.scheduler_sampler ?? "flow_match_euler"));
  const negativePrompt = createMemo(() => String(props.liveParams?.negative_prompt ?? props.output?.negative_prompt ?? "blurry, low contrast, watermark"));
  const resolvedModelId = createMemo(() => props.activeModelId || (props.output as any)?.active_model_id || "stabilityai/sd-turbo");
  const resolvedEngineId = createMemo(() => props.activeEngineId || (props.output as any)?.active_engine_id || "sd-turbo");
  const weightTier = createMemo(() => props.activeWeightTier || props.output?.weight_tier || "balanced_fp16");
  const precision = createMemo(() => props.activePrecision || props.output?.precision || "bf16");
  const speedup = createMemo(() => props.activeSpeedup ?? props.output?.speedup_multiplier ?? 1.0);

  const outObj = () => props.output as any;

  const isModifiedSinceRun = createMemo(() => {
    const out = props.output;
    const obj = outObj();
    return Boolean(
      (!out?.image_data_uri && !obj?.output?.image_data_uri) ||
        (props.livePromptText && out?.prompt && props.livePromptText.trim() !== out.prompt.trim()) ||
        (out?.seed !== undefined && seedVal() !== Number(out.seed)) ||
        (out?.num_inference_steps !== undefined && totalSteps() !== Number(out.num_inference_steps)) ||
        (out?.guidance_scale !== undefined && Math.abs(guidanceScale() - Number(out.guidance_scale)) > 0.01) ||
        (out?.aspect_ratio !== undefined && aspectRatio() !== String(out.aspect_ratio)) ||
        (out?.scheduler_sampler !== undefined && schedulerSampler() !== String(out.scheduler_sampler)) ||
        (out?.negative_prompt !== undefined && negativePrompt() !== String(out.negative_prompt)) ||
        (out?.weight_tier !== undefined && weightTier() !== String(out.weight_tier))
    );
  });

  const steps = createMemo(() => {
    const rawSteps: Array<{ step: number; total_steps?: number; latent_noise_sigma?: number; progress_pct?: number; preview_data_uri?: string }> =
      props.output?.latent_steps || outObj()?.output?.latent_steps || [];
    if (rawSteps.length > 0) {
      return rawSteps.filter((st) => Boolean(st.preview_data_uri));
    }
    return [];
  });

  const [selectedStepIdx, setSelectedStepIdx] = createSignal<number>(-1);

  createEffect(() => {
    // track changes to reset step index
    promptText();
    seedVal();
    totalSteps();
    guidanceScale();
    aspectRatio();
    schedulerSampler();
    weightTier();
    setSelectedStepIdx(-1);
  });

  const activeStepObj = createMemo(() => {
    const idx = selectedStepIdx();
    const st = steps();
    return idx >= 0 && idx < st.length ? st[idx] : null;
  });

  const displayUri = createMemo(() => {
    const out = props.output;
    const obj = outObj();
    return (
      out?.image_data_uri ||
      obj?.output?.image_data_uri ||
      (typeof obj?.output === 'string' && obj.output.startsWith('data:image/') ? obj.output : null) ||
      null
    );
  });

  const activeDisplayUri = createMemo(() => activeStepObj()?.preview_data_uri || displayUri());

  let imgEl: HTMLImageElement | undefined;
  const [imageLoading, setImageLoading] = createSignal(false);
  let prevDisplayUri: string | null = null;

  createEffect(() => {
    const uri = activeDisplayUri();
    if (!uri) {
      setImageLoading(false);
      prevDisplayUri = null;
      return;
    }

    if (uri !== prevDisplayUri) {
      prevDisplayUri = uri;
      if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
        setImageLoading(false);
      } else {
        setImageLoading(true);
      }
    }
  });

  createEffect(() => {
    if (imageLoading()) {
      if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
        setImageLoading(false);
        return;
      }
      const safetyTimer = setTimeout(() => {
        setImageLoading(false);
      }, 1000);
      onCleanup(() => clearTimeout(safetyTimer));
    }
  });

  const modelSlug = createMemo(() =>
    (resolvedModelId().split("/").pop() || "diffusion").toLowerCase().replace(/[^a-z0-9]+/g, "_")
  );
  const imageId = createMemo(() => `${modelSlug()}_${weightTier()}_seed${seedVal()}.png`);

  return (
    <div class="space-y-3.5">
      {/* Real Local Neural Inference & Hardware Tier Bar */}
      <div class="p-2.5 rounded-xl border border-border bg-surface space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
            <Cpu class="w-3.5 h-3.5 text-primary shrink-0" />
            <Badge
              variant="outline"
              class="text-[10px] font-mono border-border text-foreground"
            >
              Model: {resolvedModelId()}
            </Badge>
            <Badge variant="success" class="text-[10px] font-mono uppercase">
              Tier: {weightTier().replace("_", " ")} ({precision().toUpperCase()} • {speedup()}x)
            </Badge>
            <Show when={isModifiedSinceRun() && props.output?.image_data_uri}>
              <Badge variant="warning" class="text-[10px] font-mono text-warning font-semibold border-warning/40 bg-warning/15">
                Parameters Modified
              </Badge>
            </Show>
          </div>

          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-success/40 bg-success/15 text-success text-[10px] font-mono font-semibold">
            <Cpu class="w-3 h-3 text-success" />
            <span>Local GPU (NVIDIA RTX 4070 Ti)</span>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono pt-1 border-t border-border">
          <span class="text-muted-foreground">
            Active Engine: <strong class="text-foreground">{resolvedEngineId()}</strong>
          </span>
          <span class="text-success font-bold">
            DEVICE: CUDA:0 • LOCAL NEURAL DIFFUSION
          </span>
        </div>
      </div>

      {/* Latent Diffusion Live Parameter Telemetry Strip */}
      <div class="grid grid-cols-4 gap-2 font-mono text-[11px] tabular-nums">
        <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
          <span class="text-muted-foreground">STEPS</span>
          <span class="text-primary font-bold">
            {activeStepObj()
              ? `${activeStepObj()!.step}/${activeStepObj()!.total_steps}`
              : `${totalSteps()}`}
          </span>
        </div>
        <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
          <span class="text-muted-foreground">CFG</span>
          <span class="text-success font-bold">{guidanceScale().toFixed(1)}</span>
        </div>
        <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
          <span class="text-muted-foreground">SEED</span>
          <span class="text-foreground font-bold">#{seedVal()}</span>
        </div>
        <div class="p-2 rounded-xl border border-border bg-card flex items-center justify-between">
          <span class="text-muted-foreground">ASPECT</span>
          <span class="text-foreground font-bold">{aspectRatio()}</span>
        </div>
      </div>

      {/* Interactive Latent Denoising Trajectory Scrubber */}
      <Show when={steps().length > 0}>
        <div class="p-3 rounded-xl border border-border bg-surface/70 space-y-2">
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-semibold text-foreground flex items-center gap-1.5">
              <Wand2 class="w-3.5 h-3.5 text-primary" />
              <span>
                Latent Denoising Trajectory ({steps().length} steps • {schedulerSampler()})
              </span>
              <Show when={props.isStreaming}>
                <Badge variant="default" class="text-[9px] animate-pulse">
                  Denoising...
                </Badge>
              </Show>
            </span>
            <span class="font-mono text-primary font-bold tabular-nums">
              {activeStepObj() ? `${activeStepObj()!.progress_pct}% Denoised` : "100% Complete"}
            </span>
          </div>

          <div class="grid grid-cols-4 gap-2">
            <For each={steps().slice(0, 8)}>
              {(st, idx) => {
                const isSelected = () =>
                  (selectedStepIdx() === -1 && idx() === Math.min(7, steps().length - 1)) ||
                  selectedStepIdx() === idx();
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedStepIdx(idx())}
                    class={`p-1.5 rounded-lg font-mono text-[10px] border transition flex flex-col items-center gap-1 ${
                      isSelected()
                        ? "bg-primary/20 text-primary border-primary ring-1 ring-primary/50 font-bold"
                        : "bg-card text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    <Show when={st.preview_data_uri}>
                      <img
                        src={st.preview_data_uri}
                        alt={`Step ${st.step}`}
                        class="w-full h-10 object-cover rounded border border-border"
                      />
                    </Show>
                    <span>
                      Step {st.step} (σ={st.latent_noise_sigma})
                    </span>
                  </button>
                );
              }}
            </For>
          </div>
        </div>
      </Show>

      {/* High-Resolution Synthesized Output Image Viewport */}
      <div class="relative w-full h-72 rounded-xl border border-border overflow-hidden bg-surface select-none shadow-md">
        <Show when={(imageLoading() && activeDisplayUri()) || props.isStreaming}>
          <div class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/85 backdrop-blur-sm text-xs font-mono text-primary gap-2">
            <span class="px-3 py-1 rounded-full border border-primary/40 bg-primary/10 animate-pulse font-bold flex items-center gap-1.5 text-primary">
              <Cpu class="w-3.5 h-3.5" />
              <span>
                {props.isStreaming
                  ? `Synthesizing Neural Diffusion (${resolvedModelId()})...`
                  : `Loading Synthesized Image (${resolvedModelId()})...`}
              </span>
            </span>
          </div>
        </Show>

        <Show
          when={activeDisplayUri()}
          fallback={
            <div class="w-full h-full flex flex-col items-center justify-center text-xs text-muted-foreground font-mono gap-2 p-6 text-center">
              <Wand2 class="w-8 h-8 text-primary" />
              <span class="text-sm font-semibold text-foreground">Local Neural Diffusion Engine Ready</span>
              <span class="text-[11px] max-w-md">
                Executing on NVIDIA GeForce RTX 4070 Ti (12GB VRAM). Click &quot;Execute&quot; to synthesize real neural imagery.
              </span>
            </div>
          }
        >
          <img
            ref={imgEl}
            src={activeDisplayUri()!}
            alt={promptText()}
            data-testid="diffusion-output-image"
            onLoad={() => setImageLoading(false)}
            onError={() => setImageLoading(false)}
            class="w-full h-full object-contain"
          />
        </Show>

        <div class="absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-background/90 text-foreground px-2.5 py-1 rounded-lg border border-border backdrop-blur-sm shadow-xs">
          <ImageIcon class="w-3.5 h-3.5 text-primary" />
          <span class="font-mono text-[10px] text-foreground font-semibold uppercase">
            {weightTier().replace("_", " ")} • CFG {guidanceScale().toFixed(1)}
          </span>
        </div>

        <Show when={activeDisplayUri()}>
          <a
            href={activeDisplayUri()!}
            download={imageId()}
            target="_blank"
            rel="noopener noreferrer"
            class="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-background/90 hover:bg-primary hover:text-primary-foreground text-foreground border border-border backdrop-blur-sm font-mono text-[10px] font-semibold flex items-center gap-1 transition shadow-xs"
          >
            <Download class="w-3 h-3" />
            <span>Download PNG</span>
          </a>
        </Show>

        <div class="absolute bottom-2.5 right-2.5 px-2.5 py-0.5 rounded bg-background/90 text-muted-foreground border border-border backdrop-blur-sm font-mono text-[10px] shadow-xs">
          {imageId()} • {aspectRatio()}
        </div>
      </div>

      <Show when={props.onPipeToRmbg}>
        <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border">
          <span class="text-[11px] text-muted-foreground font-mono">
            Cross-Modal Studio Chain (Segment Prompt Subject in RMBG):
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => props.onPipeToRmbg!(imageId(), promptText(), activeDisplayUri() || undefined)}
            class="h-7 text-[11px] border-border bg-card text-foreground hover:bg-secondary"
          >
            <Scissors class="w-3.5 h-3.5 text-primary" />
            <span>Pipe Frame → BRIA RMBG Alpha Matte</span>
          </Button>
        </div>
      </Show>
    </div>
  );
}
