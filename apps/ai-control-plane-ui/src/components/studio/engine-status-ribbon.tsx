import { Component, createMemo, For, Show } from "solid-js";
import { Plus, RefreshCw, Zap, Pin } from "lucide-solid";
import type {
  ModelCatalogEntry,
  LocalHardwareProfile,
  HardwareProfileId,
  GpuSandboxStatusResponse,
} from "@ai-monorepo/ai-control-plane-sdk";
import { getPipelineStudioStyle } from "@/components/studio/bespoke-pipeline-studios";

export interface StudioPipeline {
  id?: string;
  pipeline_type: string;
  label?: string;
  display_name?: string;
  name?: string;
  description?: string;
  engine_id?: string;
  models?: ModelCatalogEntry[];
  loaded?: boolean;
  lifecycle_state?: string;
}

export const PIPELINE_DISPLAY_NAMES: Record<string, string> = {
  "text-to-speech": "Text-to-Speech",
  "text-to-image": "Text-to-Image",
  "image-to-image": "Image-to-Image",
  "image-segmentation": "Image Segmentation",
  "automatic-speech-recognition": "Speech Recognition",
  "image-text-to-text": "Vision-Language",
  "text-generation": "Text Generation",
  "object-detection": "Object Detection",
  "depth-estimation": "Depth Estimation",
  "text-classification": "Text Classification",
  "token-classification": "Named Entity Recognition",
  "text-ranking": "Passage Reranking",
  "feature-extraction": "Vector Embeddings",
};

export interface EngineStatusRibbonProps {
  pipelines?: StudioPipeline[];
  catalogModels?: ModelCatalogEntry[];
  activeEngineId: string;
  onSelectEngine: (engineId: string) => void;
  onSelectPipeline?: (pipelineType: string) => void;
  onOpenHubModal: () => void;
  activeHardwareProfile: LocalHardwareProfile;
  hardwareProfiles: LocalHardwareProfile[];
  onSelectHardwareProfile: (profileId: HardwareProfileId) => void;
  totalVramMb: number;
  maxVramBudgetMb: number;
  totalRunsCount: number;
  p95Ms: number;
  onRefreshTelemetry: () => void;
  healthLoading: boolean;
  gpuSandboxStatus?: GpuSandboxStatusResponse | null;
  isProvisioningGpu?: boolean;
  onProvisionGpu?: () => void;
  pinnedEngineIds?: Set<string>;
  onTogglePin?: (engineId: string) => void;
}

export const EngineStatusRibbon: Component<EngineStatusRibbonProps> = (props) => {
  // Resolve pipelines list either from explicit pipelines prop or grouped from catalogModels
  const resolvedPipelines = createMemo(() => {
    if (props.pipelines && props.pipelines.length > 0) {
      return props.pipelines;
    }
    const map = new Map<string, StudioPipeline>();
    for (const m of props.catalogModels || []) {
      const pt = m.pipeline_type;
      if (!map.has(pt)) {
        map.set(pt, {
          id: pt,
          pipeline_type: pt,
          label:
            PIPELINE_DISPLAY_NAMES[pt] ??
            pt.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          engine_id: m.engine_id,
          models: [m],
          loaded: Boolean(m.loaded),
          lifecycle_state:
            m.weights?.lifecycle_state ?? (m.loaded ? "ACTIVE_VRAM" : "REGISTERED"),
        });
      } else {
        const item = map.get(pt)!;
        item.models?.push(m);
        if (m.loaded) {
          item.loaded = true;
          item.lifecycle_state = "ACTIVE_VRAM";
        }
        if (m.engine_id === props.activeEngineId) {
          item.engine_id = m.engine_id;
        }
      }
    }
    return Array.from(map.values());
  });

  return (
    <div class="shrink-0 border-b border-border/75 bg-surface/65 backdrop-blur-md px-4 lg:px-6 py-2 flex items-center justify-between gap-4 overflow-x-auto studio-scroll text-[11px] font-mono tabular-nums">
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-muted-foreground font-semibold mr-1">PIPELINES:</span>
        <Show
          when={resolvedPipelines().length > 0}
          fallback={
            <div class="flex items-center gap-1.5 animate-pulse">
              <div class="h-6 w-24 bg-muted/50 rounded-md"></div>
              <div class="h-6 w-20 bg-muted/50 rounded-md"></div>
              <div class="h-6 w-28 bg-muted/50 rounded-md"></div>
            </div>
          }
        >
          <For each={resolvedPipelines()}>
          {(pipe) => {
            const isSelected = () =>
              pipe.engine_id === props.activeEngineId ||
              pipe.models?.some((m) => m.engine_id === props.activeEngineId);

            const wState = () =>
              pipe.lifecycle_state ??
              (pipe.loaded
                ? "ACTIVE_VRAM"
                : pipe.models?.some((m) => m.loaded)
                ? "ACTIVE_VRAM"
                : pipe.models?.some((m) => m.weights?.lifecycle_state === "CACHED_ON_DISK")
                ? "CACHED_ON_DISK"
                : "REGISTERED");

            const pStyle = getPipelineStudioStyle(pipe.pipeline_type);

            const targetEngineId = () =>
              pipe.models?.find((m) => m.engine_id === props.activeEngineId)?.engine_id ??
              pipe.engine_id ??
              pipe.models?.[0]?.engine_id ??
              "";

            const isPinned = () =>
              targetEngineId() ? Boolean(props.pinnedEngineIds?.has(targetEngineId())) : false;

            return (
              <button
                type="button"
                onClick={() => {
                  const target = targetEngineId();
                  if (target) {
                    props.onSelectEngine(target);
                  }
                  props.onSelectPipeline?.(pipe.pipeline_type);
                }}
                class={`px-2.5 py-1 rounded-md border transition flex items-center gap-1.5 ${
                  isSelected()
                    ? `${pStyle.accentBorder} ${pStyle.accentBg} text-foreground font-semibold shadow-sm`
                    : isPinned()
                    ? "border-warning/40 bg-card/85 text-foreground"
                    : "border-border bg-card/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  class={`w-2 h-2 rounded-full ${
                    wState() === "ACTIVE_VRAM"
                      ? "bg-success"
                      : wState() === "CACHED_ON_DISK"
                      ? "bg-primary"
                      : wState() === "EVICTED_TO_DISK"
                      ? "bg-warning"
                      : "bg-muted-foreground/40"
                  }`}
                />
                <span>{pipe.label || pipe.name || pipe.display_name || pipe.pipeline_type}</span>
                <span class={`text-[9px] opacity-80 ${pStyle.accentText}`}>
                  [{pipe.pipeline_type}]
                </span>
                <Show when={props.onTogglePin && targetEngineId()}>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onTogglePin?.(targetEngineId());
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        props.onTogglePin?.(targetEngineId());
                      }
                    }}
                    title={
                      isPinned()
                        ? `Unpin ${targetEngineId()} from GPU VRAM`
                        : `Pin ${targetEngineId()} in GPU VRAM (protects from eviction)`
                    }
                    class={`p-0.5 rounded transition ${
                      isPinned()
                        ? "text-warning hover:text-warning/80 bg-warning/15 ring-1 ring-warning/50 shadow-[0_0_8px_rgba(var(--warning),0.35)]"
                        : "text-muted-foreground/50 hover:text-foreground hover:bg-card"
                    }`}
                  >
                    <Pin class={`w-2.5 h-2.5 ${isPinned() ? "fill-current" : ""}`} />
                  </span>
                </Show>
              </button>
            );
          }}
        </For>
        </Show>
        <button
          type="button"
          onClick={props.onOpenHubModal}
          class="px-2.5 py-1 rounded-md border border-dashed border-primary/50 bg-primary/10 text-primary hover:bg-primary/20 transition flex items-center gap-1 font-semibold"
        >
          <Plus class="w-3 h-3" />
          <span>Add Model</span>
        </button>
      </div>

      <div class="flex items-center gap-3 shrink-0">
        {/* GPU Sandbox Indicator / 1-Click Provisioning */}
        <Show
          when={props.gpuSandboxStatus?.status === "ready"}
          fallback={
            <button
              type="button"
              disabled={props.isProvisioningGpu}
              onClick={props.onProvisionGpu}
              class="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded border border-warning/40 bg-warning/15 text-[10px] font-mono text-warning font-semibold hover:bg-warning/25 transition disabled:opacity-50"
              title="Click to provision Python 3.12 + PyTorch CUDA 12.4 Sandbox"
            >
              <Show
                when={props.isProvisioningGpu}
                fallback={<Zap class="w-3 h-3 text-warning" />}
              >
                <RefreshCw class="w-3 h-3 animate-spin text-warning" />
              </Show>
              <span>{props.isProvisioningGpu ? "Provisioning GPU..." : "🚀 Provision GPU Sandbox"}</span>
            </button>
          }
        >
          <div
            class="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded border border-success/40 bg-success/10 text-[10px] font-mono text-success font-semibold"
            title={`Python 3.12 GPU Worker active on ${props.gpuSandboxStatus?.device_name || 'cuda:0'} (${props.gpuSandboxStatus?.vram_allocated_mb ?? 0} MB VRAM currently allocated)`}
          >
            <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span class="font-semibold">{props.gpuSandboxStatus?.device_name ? "RTX 4070 Ti" : "GPU Worker"}</span>
            <span class="text-[9px] text-success/80">({props.gpuSandboxStatus?.vram_allocated_mb ?? 0}MB VRAM)</span>
          </div>
        </Show>

        <div class="hidden xl:flex items-center gap-1.5">
          <span class="text-muted-foreground">HW Tier:</span>
          <select
            value={props.activeHardwareProfile.profile_id}
            onChange={(e) => props.onSelectHardwareProfile(e.currentTarget.value as HardwareProfileId)}
            aria-label="Quick Hardware Tier Switcher"
            class="h-6 rounded border border-border bg-card px-1.5 text-[10px] font-mono text-primary font-semibold"
          >
            <For each={props.hardwareProfiles}>
              {(hp) => (
                <option value={hp.profile_id}>
                  {hp.short_name} ({hp.recommended_weight_tier})
                </option>
              )}
            </For>
          </select>
        </div>
        <div class="hidden md:flex items-center gap-2">
          <span class="text-muted-foreground">VRAM:</span>
          <span class="text-primary font-semibold">
            {props.totalVramMb}/{props.maxVramBudgetMb} MB
          </span>
        </div>
        <div class="hidden lg:flex items-center gap-2">
          <span class="text-muted-foreground">SQLite WAL:</span>
          <span class="text-success font-semibold">{props.totalRunsCount} runs</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-muted-foreground">SLA p95:</span>
          <span class="text-success font-semibold">{props.p95Ms}ms</span>
        </div>
        <button
          type="button"
          onClick={props.onRefreshTelemetry}
          disabled={props.healthLoading}
          class="px-2 py-0.5 rounded border border-border bg-card hover:border-primary/50 text-muted-foreground hover:text-foreground transition flex items-center gap-1"
        >
          <RefreshCw class={`w-3 h-3 ${props.healthLoading ? "animate-spin" : ""}`} />
          <span>Sync HUD</span>
        </button>
      </div>
    </div>
  );
};
