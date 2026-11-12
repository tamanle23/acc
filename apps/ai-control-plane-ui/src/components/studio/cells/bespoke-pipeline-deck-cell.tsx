import { createMemo, Show, For } from 'solid-js';
import type {
  ModelCatalogEntry,
  VoicePreset,
  ModalityFamily,
  WeightTierId,
  OffloadStrategy,
  HostHardwareTelemetry,
} from '@acc/ai-control-plane-sdk';
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  X,
  HardDrive,
  Zap,
  RefreshCw,
  Flame,
  PowerOff,
  Cpu,
  Wand2,
  Play,
  Square,
  Radio,
  Workflow,
  Clock,
  Send,
} from 'lucide-solid';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import {
  BespokePipelineStudioSurface,
  type PipelineStudioStyle,
  getPipelineStudioStyle,
} from '@/components/studio/bespoke-pipeline-studios';
import { FAMILY_META, WEIGHT_TIER_OPTIONS } from '@/constants/studio-constants';
import type { ExecutionStatus, LifecycleNotice } from '@/types/studio';

export interface BespokePipelineDeckCellProps {
  spanClass: string;
  activeManifest: ModelCatalogEntry;
  catalogModels: ModelCatalogEntry[];
  activeStudioStyle: PipelineStudioStyle;
  activeParams: Record<string, any>;
  activeInputText: string;
  setActiveEngineId: (engineId: string) => void;
  setActiveInput: (val: string) => void;
  setActiveParam: (key: string, val: any) => void;
  executionError: string | null;
  lifecycleNotice: LifecycleNotice | null;
  setLifecycleNotice: (val: LifecycleNotice | null) => void;
  lifecycleBusyId: string | null;
  handlePrefetchWeights: (engineId: string) => Promise<void>;
  handleLoadOrBindModel: (engineId: string, executionTarget: string) => Promise<void>;
  handleWarmupModel: (engineId: string) => Promise<void>;
  handleUnloadEvictModel: (engineId: string) => Promise<void>;
  handleSetModelWeightTier: (
    engineId: string,
    tierId: WeightTierId,
    offload: OffloadStrategy
  ) => Promise<void>;
  selectedBinaryName: string;
  onSelectBinaryFile: (file: File | Blob | null, name: string) => void;
  isRecordingMic: boolean;
  onToggleMicCapture: () => void;
  showZeroShot: boolean;
  onToggleZeroShot: () => void;
  refAudioPath: string;
  onChangeRefAudioPath: (path: string) => void;
  resetActiveModelDefaults: () => void;
  executionStatus: ExecutionStatus;
  handleExecuteBatched: () => void;
  cancelActiveExecution: () => void;
  handleExecuteStream: (customInput?: string) => void;
  handleStreamVisualDag: () => Promise<void>;
  dagRunning: boolean;
  hardwareTelemetry?: HostHardwareTelemetry | null;
  handleExecuteAsyncJob?: (customInput?: string) => void;
  activeJob?: { jobId: string; status: string; progress: any; elapsedMs: number } | null;
  onCancelActiveJob?: () => void;
  voices?: VoicePreset[];
}

export function BespokePipelineDeckCell(props: BespokePipelineDeckCellProps) {
  const FamilyIcon = () => FAMILY_META[props.activeManifest.family]?.icon ?? Sparkles;
  const sameFamilyModels = createMemo(() => (props.catalogModels || []).filter((m) => m.family === props.activeManifest.family));
  const activeWeightTier = () => props.activeManifest.weights?.weight_tier ?? "balanced_fp16";
  const activeCompat = () => props.activeManifest.weights?.hardware_compatibility;
  const isLlmOrVlm = createMemo(() =>
    props.activeManifest.family === 'llm' ||
    props.activeManifest.pipeline_category === 'generative_multimodal' ||
    props.activeManifest.pipeline_type === 'text-generation' ||
    props.activeManifest.pipeline_type === 'image-text-to-text' ||
    props.activeManifest.engine_id.includes('qwen') ||
    props.activeManifest.engine_id.includes('deepseek')
  );

  return (
    <Card class={`${props.spanClass} flex flex-col justify-between transition-all duration-300 ${props.activeStudioStyle.cardGlow}`}>
      <div>
        <CardHeader class={`space-y-3 pb-3 bg-gradient-to-r ${props.activeStudioStyle.gradientBanner} rounded-t-2xl border-b border-border/60`}>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2.5">
              <div class={`p-2.5 rounded-xl border ${props.activeStudioStyle.accentBg} ${props.activeStudioStyle.accentBorder} ${props.activeStudioStyle.accentText}`}>
                {(() => {
                  const Icon = FamilyIcon();
                  return <Icon class="w-4 h-4" />;
                })()}
              </div>
              <div>
                <div class="flex flex-wrap items-center gap-2">
                  <span class={`text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${props.activeStudioStyle.accentBg} ${props.activeStudioStyle.accentText} ${props.activeStudioStyle.accentBorder}`}>
                    {props.activeStudioStyle.studioTitle}
                  </span>
                  <Badge variant="outline" class="text-[10px] font-mono">
                    {props.activeManifest.pipeline_type}
                  </Badge>
                  <Show when={props.activeManifest.architecture}>
                    <Badge variant="outline" class="text-[10px] font-mono">
                      {props.activeManifest.architecture}
                    </Badge>
                  </Show>
                  <Badge variant="outline" class="text-[10px] font-mono uppercase">
                    {activeCompat()?.active_tier_label ?? activeWeightTier()} ({props.activeManifest.weights?.precision ?? props.activeManifest.default_precision ?? "bf16"})
                  </Badge>
                  <Show when={activeCompat()}>
                    <Badge
                      variant={
                        activeCompat()!.status === "OPTIMAL_FIT" || activeCompat()!.status === "QUANTIZED_FIT"
                          ? "success"
                          : "warning"
                      }
                      class="text-[10px] font-mono"
                    >
                      {activeCompat()!.badge_text} • {activeCompat()!.speedup_multiplier}x
                    </Badge>
                  </Show>
                </div>
                <CardTitle class="mt-1 text-sm sm:text-base">
                  {props.activeManifest.display_name}
                </CardTitle>
                <CardDescription class="mt-0.5 text-[11px]">
                  {props.activeStudioStyle.studioSubtitle}
                </CardDescription>
              </div>
            </div>

            <div class="flex items-center gap-1.5 font-mono text-[10px] bg-card/85 px-2.5 py-1.5 rounded-xl border border-border">
              <span class="text-muted-foreground">IN:</span>
              <span class={`${props.activeStudioStyle.accentText} font-bold uppercase`}>
                {props.activeManifest.input_modality}
              </span>
              <span class="text-muted-foreground">→ OUT:</span>
              <span class="text-success font-bold uppercase">
                {props.activeManifest.output_modality}
              </span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-1.5 pt-1">
            <For each={Object.keys(FAMILY_META) as ModalityFamily[]}>
              {(fam) => {
                const meta = FAMILY_META[fam];
                const Icon = meta.icon;
                const isSelectedFamily = () => props.activeManifest.family === fam;
                const firstModelOfFamily = (props.catalogModels || []).find((m) => m.family === fam);
                const famStyle = getPipelineStudioStyle(firstModelOfFamily?.pipeline_type ?? "text-classification");
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (firstModelOfFamily) {
                        props.setActiveEngineId(firstModelOfFamily.engine_id);
                      }
                    }}
                    class={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 border ${
                      isSelectedFamily()
                        ? famStyle.pillActive
                        : "bg-card/75 text-muted-foreground border-border hover:text-foreground"
                    }`}
                  >
                    <Icon class="w-3.5 h-3.5" />
                    <span>{meta.label}</span>
                  </button>
                );
              }}
            </For>
          </div>

          <Show when={sameFamilyModels().length > 1}>
            <div class="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
              <span class="text-[10px] font-mono uppercase text-muted-foreground mr-1">
                Sub-Pipeline Studios:
              </span>
              <For each={sameFamilyModels()}>
                {(subModel) => {
                  const subStyle = getPipelineStudioStyle(subModel.pipeline_type);
                  const isActiveSub = () => subModel.engine_id === props.activeManifest.engine_id;
                  return (
                    <button
                      type="button"
                      onClick={() => props.setActiveEngineId(subModel.engine_id)}
                      class={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition flex items-center gap-1.5 ${
                        isActiveSub()
                          ? subStyle.pillActive
                          : "bg-card/70 text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      <span>[{subModel.pipeline_type}]</span>
                      <span>{subModel.display_name.split(" (")[0]}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          </Show>
        </CardHeader>

        <CardContent class="space-y-4 pt-4">
          <Show when={props.executionError}>
            <Alert variant="destructive" class="border-destructive/40 bg-destructive/10 text-destructive-foreground">
              <AlertCircle class="w-4 h-4 shrink-0 mt-0.5 text-destructive" />
              <div class="flex-1 space-y-2">
                <p class="font-semibold text-destructive dark:text-rose-200">Pipeline Execution Alert</p>
                <p class="text-foreground/90 mt-0.5 text-xs">{props.executionError}</p>
                <Show when={props.executionError?.includes("No active CUDA GPU device is available")}>
                  <div class="pt-1 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={async () => {
                        const currentTier = (props.activeManifest.weights?.weight_tier ?? "balanced_fp16") as WeightTierId;
                        await props.handleSetModelWeightTier(props.activeManifest.engine_id, currentTier, "cpu_ram_offload");
                        await props.handleLoadOrBindModel(props.activeManifest.engine_id, props.activeManifest.execution_target);
                      }}
                      class="h-7 px-3 text-[11px] font-mono bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
                    >
                      <Zap class="w-3.5 h-3.5 mr-1" />
                      <span>⚡ Switch to CPU RAM & Mount</span>
                    </Button>
                    <span class="text-[11px] text-muted-foreground font-mono">
                      (Executes on Host System RAM without VRAM requirement)
                    </span>
                  </div>
                </Show>
              </div>
            </Alert>
          </Show>

          <Show when={props.lifecycleNotice}>
            <div class={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-mono transition animate-in fade-in ${
              props.lifecycleNotice!.type === "success"
                ? "bg-success/10 border-success/30 text-success"
                : props.lifecycleNotice!.type === "warning"
                ? "bg-warning/10 border-warning/30 text-warning"
                : "bg-primary/10 border-primary/30 text-primary"
            }`}>
              <div class="flex items-center gap-2">
                <CheckCircle2 class="w-4 h-4 shrink-0" />
                <span class="font-semibold">{props.lifecycleNotice!.message}</span>
              </div>
              <button
                type="button"
                onClick={() => props.setLifecycleNotice(null)}
                class="text-muted-foreground hover:text-foreground p-0.5"
              >
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </Show>

          {/* Active Model Lifecycle Management Bar */}
          <div class="p-3 rounded-xl border border-border/80 bg-surface/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div class="flex items-center gap-2.5">
              <span class={`w-3 h-3 rounded-full shrink-0 ${
                props.activeManifest.loaded ? "bg-success animate-pulse" : (props.activeManifest.weights?.disk_size_mb ?? 0) > 0 ? "bg-primary" : "bg-muted-foreground/40"
              }`} />
              <div>
                <span class="font-semibold text-foreground">
                  Lifecycle State: <strong class="text-primary">{props.activeManifest.weights?.lifecycle_state ?? (props.activeManifest.loaded ? "ACTIVE_VRAM" : "REGISTERED")}</strong>
                </span>
                <span class="text-muted-foreground ml-2">
                  {props.activeManifest.loaded
                    ? `Loaded in ${props.activeManifest.device} (${props.activeManifest.vram_mb} MB VRAM • ${props.activeManifest.ram_mb} MB RAM) • ${props.activeManifest.warmed_up ? `Warmed Up (${props.activeManifest.last_warmup_ms ?? 0}ms)` : 'Uncalibrated'}`
                    : (props.activeManifest.weights?.disk_size_mb ?? 0) > 0
                    ? `Cached on Disk (${props.activeManifest.weights?.disk_size_mb} MB) • Ready to Mount (${props.activeManifest.weights?.offload_strategy === 'cpu_ram_offload' ? 'Host RAM' : 'VRAM'})`
                    : 'Not Loaded • Not Cached on Disk'}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Show
                when={props.activeManifest.loaded}
                fallback={
                  <Show
                    when={(props.activeManifest.weights?.disk_size_mb ?? 0) > 0}
                    fallback={
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          disabled={props.lifecycleBusyId === props.activeManifest.engine_id}
                          onClick={() => void props.handlePrefetchWeights(props.activeManifest.engine_id)}
                          class="h-7 px-2.5 text-xs font-mono border border-primary/40 text-primary bg-primary/10 hover:bg-primary/20"
                          title="Prefetch checkpoint shards to SSD cache without consuming VRAM"
                        >
                          <Show
                            when={props.lifecycleBusyId === props.activeManifest.engine_id}
                            fallback={<HardDrive class="w-3.5 h-3.5 text-primary mr-1" />}
                          >
                            <RefreshCw class="w-3.5 h-3.5 animate-spin mr-1" />
                          </Show>
                          <span>Prefetch Disk</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={true}
                          class="h-7 px-2.5 text-xs font-mono opacity-40 cursor-not-allowed"
                          title="Must prefetch checkpoint shards to disk cache before mounting in VRAM"
                        >
                          <Zap class="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                          <span>{props.activeManifest.weights?.offload_strategy === "cpu_ram_offload" ? "Mount RAM" : "Load VRAM"}</span>
                        </Button>
                      </>
                    }
                  >
                    <Show
                      when={props.activeManifest.weights?.offload_strategy !== "cpu_ram_offload"}
                      fallback={
                        <Button
                          size="sm"
                          variant="default"
                          disabled={props.lifecycleBusyId === props.activeManifest.engine_id}
                          onClick={() => void props.handleLoadOrBindModel(props.activeManifest.engine_id, props.activeManifest.execution_target)}
                          class="h-7 px-2.5 text-xs font-mono bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs"
                          title="Mount verified local disk shards into Host System RAM"
                        >
                          <Show when={props.lifecycleBusyId === props.activeManifest.engine_id} fallback={<Zap class="w-3.5 h-3.5 mr-1" />}>
                            <RefreshCw class="w-3.5 h-3.5 animate-spin mr-1" />
                          </Show>
                          <span>Mount Host RAM</span>
                        </Button>
                      }
                    >
                      <Show
                        when={props.hardwareTelemetry?.cuda_available !== false}
                        fallback={
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={props.lifecycleBusyId === props.activeManifest.engine_id}
                            onClick={async () => {
                              const currentTier = (props.activeManifest.weights?.weight_tier ?? "balanced_fp16") as WeightTierId;
                              await props.handleSetModelWeightTier(props.activeManifest.engine_id, currentTier, "cpu_ram_offload");
                              await props.handleLoadOrBindModel(props.activeManifest.engine_id, props.activeManifest.execution_target);
                            }}
                            class="h-7 px-2.5 text-xs font-mono border-warning/40 bg-warning/15 text-warning hover:bg-warning/25 font-semibold"
                            title="Current Python environment lacks CUDA. Click to switch to CPU RAM and Mount."
                          >
                            <Show when={props.lifecycleBusyId === props.activeManifest.engine_id} fallback={<AlertCircle class="w-3.5 h-3.5 mr-1 text-warning" />}>
                              <RefreshCw class="w-3.5 h-3.5 animate-spin mr-1" />
                            </Show>
                            <span>Switch to CPU RAM</span>
                          </Button>
                        }
                      >
                        <Button
                          size="sm"
                          variant="default"
                          disabled={props.lifecycleBusyId === props.activeManifest.engine_id}
                          onClick={() => void props.handleLoadOrBindModel(props.activeManifest.engine_id, `uv-sandbox:${props.activeManifest.recommended_uv_profile || "vision-worker"}`)}
                          class="h-7 px-2.5 text-xs font-mono shadow-xs"
                          title={props.activeManifest.weights?.offload_strategy === "hybrid_kv_offload" ? "Mount into GPU VRAM with Hybrid KV cache offload" : "Mount into Dedicated GPU VRAM"}
                        >
                          <Show when={props.lifecycleBusyId === props.activeManifest.engine_id} fallback={<Zap class="w-3.5 h-3.5 mr-1" />}>
                            <RefreshCw class="w-3.5 h-3.5 animate-spin mr-1" />
                          </Show>
                          <span>{props.activeManifest.weights?.offload_strategy === "hybrid_kv_offload" ? "Mount Hybrid" : "Load VRAM"}</span>
                        </Button>
                      </Show>
                    </Show>
                  </Show>
                }
              >
                <Button
                  size="sm"
                  variant={props.activeManifest.warmed_up ? "secondary" : "outline"}
                  disabled={props.lifecycleBusyId === props.activeManifest.engine_id}
                  onClick={() => void props.handleWarmupModel(props.activeManifest.engine_id)}
                  class={`h-7 px-2.5 text-xs font-mono ${
                    props.activeManifest.warmed_up ? "text-success border-success/40 bg-success/10 font-semibold" : ""
                  }`}
                  title={props.activeManifest.warmed_up ? `Warmed up in ${props.activeManifest.last_warmup_ms ?? 0}ms` : "Run synthetic warmup calibration pass"}
                >
                  <Flame class={`w-3.5 h-3.5 ${props.activeManifest.warmed_up ? "text-success" : "text-warning"}`} />
                  <span>{props.activeManifest.warmed_up ? `Warmed (${props.activeManifest.last_warmup_ms ?? 0}ms)` : "Warmup Calibration"}</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={props.lifecycleBusyId === props.activeManifest.engine_id}
                  onClick={() => void props.handleUnloadEvictModel(props.activeManifest.engine_id)}
                  class="h-7 px-2 text-xs font-mono text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                  title="Soft Evict from VRAM to Disk Cache"
                >
                  <PowerOff class="w-3.5 h-3.5" />
                  <span>Evict VRAM</span>
                </Button>
              </Show>
            </div>
          </div>

          {/* Direct Active Model Weight Tier & Offload Adaptation Bar */}
          <div class="p-3 rounded-xl border border-primary/35 bg-primary/5 space-y-2">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="text-[11px] font-mono font-bold text-primary flex items-center gap-1.5">
                <Cpu class="w-3.5 h-3.5" />
                <span>Active Model Weight Tier & Offload Adaptation:</span>
              </span>
              <div class="flex items-center gap-2 text-[10px] font-mono tabular-nums">
                <span class="text-muted-foreground">
                  VRAM: <strong class="text-foreground">{props.activeManifest.weights?.effective_vram_mb ?? props.activeManifest.vram_footprint_mb} MB</strong>
                  <Show when={(props.activeManifest.weights?.quantization_savings_pct ?? 0) > 0}>
                    <span class="text-emerald-600 dark:text-emerald-400 ml-1 font-semibold">(-{props.activeManifest.weights?.quantization_savings_pct}%)</span>
                  </Show>
                </span>
                <span class="text-muted-foreground">
                  Speed: <strong class="text-emerald-600 dark:text-emerald-400 font-semibold">{activeCompat()?.speedup_multiplier ?? 1.0}x</strong>
                </span>
                <span class="text-muted-foreground">
                  Quality: <strong class="text-sky-700 dark:text-sky-300 font-semibold">{activeCompat()?.quality_retention_pct ?? 100}%</strong>
                </span>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-1">
                <For each={WEIGHT_TIER_OPTIONS}>
                  {(opt) => {
                    const isActiveOpt = () => activeWeightTier() === opt.tier_id;
                    return (
                      <button
                        type="button"
                        onClick={() =>
                          void props.handleSetModelWeightTier(
                            props.activeManifest.engine_id,
                            opt.tier_id,
                            (props.activeManifest.weights?.offload_strategy ?? "none") as OffloadStrategy
                          )
                        }
                        class={`px-2 py-1 rounded-md text-[10px] font-mono border transition ${
                          isActiveOpt()
                            ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                            : "bg-card/85 text-muted-foreground border-border hover:text-foreground"
                        }`}
                      >
                        {opt.tier_id.replace("_", " ").toUpperCase()} ({opt.speedup})
                      </button>
                    );
                  }}
                </For>
              </div>

              <select
                value={props.activeManifest.weights?.offload_strategy ?? "none"}
                onChange={(e) =>
                  void props.handleSetModelWeightTier(
                    props.activeManifest.engine_id,
                    activeWeightTier() as WeightTierId,
                    e.currentTarget.value as OffloadStrategy
                  )
                }
                aria-label="Active Model Offload Strategy"
                class="h-7 rounded border border-border bg-card px-2 text-[10px] font-mono text-foreground"
              >
                <option value="none">GPU VRAM Only</option>
                <option value="hybrid_kv_offload">Hybrid KV Offload (-28% VRAM)</option>
                <option value="cpu_ram_offload">CPU+RAM Layer Offload (-65% VRAM)</option>
              </select>
            </div>
          </div>

          <Show when={props.activeManifest.sample_prompts && props.activeManifest.sample_prompts.length > 0}>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class={`text-[11px] font-medium flex items-center gap-1 mr-1 ${props.activeStudioStyle.accentText}`}>
                <Wand2 class="w-3.5 h-3.5" /> Studio Presets:
              </span>
              <For each={props.activeManifest.sample_prompts}>
                {(tpl) => (
                  <button
                    type="button"
                    onClick={() => props.setActiveInput(tpl.text)}
                    class={`text-[11px] px-2.5 py-1 rounded-md border border-border bg-surface/80 hover:${props.activeStudioStyle.accentBorder} text-muted-foreground hover:text-foreground transition`}
                  >
                    {tpl.label}
                  </button>
                )}
              </For>
            </div>
          </Show>

          <BespokePipelineStudioSurface
            manifest={props.activeManifest}
            inputText={props.activeInputText}
            onChangeInputText={props.setActiveInput}
            params={props.activeParams}
            onChangeParam={props.setActiveParam}
            selectedBinaryName={props.selectedBinaryName}
            onSelectBinaryFile={props.onSelectBinaryFile}
            isRecordingMic={props.isRecordingMic}
            onToggleMicCapture={props.onToggleMicCapture}
            showZeroShot={props.showZeroShot}
            onToggleZeroShot={props.onToggleZeroShot}
            refAudioPath={props.refAudioPath}
            onChangeRefAudioPath={props.onChangeRefAudioPath}
            onResetDefaults={props.resetActiveModelDefaults}
            voices={props.voices}
          />
        </CardContent>
      </div>

      <CardFooter class="border-t border-border/80 pt-4 flex flex-col sm:flex-row flex-wrap items-center gap-2.5">
        <Show
          when={props.executionStatus === 'executing' || props.executionStatus === 'streaming'}
          fallback={
            <Show
              when={isLlmOrVlm()}
              fallback={
                <Button
                  onClick={() => (props.handleExecuteAsyncJob ? props.handleExecuteAsyncJob() : props.handleExecuteBatched())}
                  class="flex-1 min-w-[180px] gap-2 bg-primary hover:bg-primary/90 shadow-md font-semibold text-primary-foreground"
                >
                  <Clock class="w-4 h-4 text-primary-foreground" />
                  <span>Submit Async Job (Pattern 2: SSE)</span>
                </Button>
              }
            >
              <Button
                onClick={() => props.handleExecuteStream()}
                class="flex-1 min-w-[180px] gap-2 bg-primary hover:bg-primary/90 shadow-md font-semibold text-primary-foreground"
              >
                <Radio class="w-4 h-4 text-primary-foreground animate-pulse" />
                <span>Stream Chat Response (/stream)</span>
              </Button>
            </Show>
          }
        >
          <Button
            variant="destructive"
            onClick={props.activeJob ? props.onCancelActiveJob : props.cancelActiveExecution}
            class="flex-1 min-w-[160px] gap-2 shadow"
          >
            <Square class="w-4 h-4 fill-current" />
            <span>{props.activeJob ? 'Cancel Async Job' : 'Stop Execution'}</span>
          </Button>
        </Show>

        <Show when={!isLlmOrVlm() && props.executionStatus === 'idle'}>
          <Button
            variant="outline"
            onClick={() => props.handleExecuteBatched()}
            class="px-3 text-xs text-muted-foreground hover:text-foreground"
            title="Execute synchronous direct HTTP request"
          >
            <Play class="w-3.5 h-3.5 mr-1" />
            Direct Sync
          </Button>
        </Show>

        <Show when={!isLlmOrVlm() && props.activeManifest.supports_streaming && props.executionStatus === 'idle'}>
          <Button
            variant="outline"
            onClick={() => props.handleExecuteStream()}
            class="px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            <Radio class="w-3.5 h-3.5 mr-1 text-success" />
            Stream Frames
          </Button>
        </Show>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void props.handleStreamVisualDag()}
          disabled={props.dagRunning}
          title="Stream 4-Stage Multi-Modal DAG Node-by-Node Live"
          class="sm:ml-auto h-10 px-3 text-xs"
        >
          <Workflow class="w-3.5 h-3.5 text-primary mr-1" />
          <span>Stream DAG</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
