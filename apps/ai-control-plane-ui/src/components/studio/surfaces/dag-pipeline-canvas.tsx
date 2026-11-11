import { createSignal, createMemo, Show, For } from "solid-js";
import type {
  ModelCatalogEntry,
  DagPresetBlueprint,
  DagNodeSpec,
  DagStageExecutionResult,
} from "@ai-monorepo/ai-control-plane-sdk";
import {
  Workflow,
  ArrowRight,
  ArrowLeft,
  Play,
  Radio,
  RefreshCw,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  Volume2,
  Image,
  Mic,
  FileText,
  Scissors,
  CheckCircle2,
  AlertCircle,
  Database,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-solid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getPipelineStudioStyle } from "@/components/studio/bespoke-pipeline-studios";

export interface DagPipelineCanvasProps {
  dagPresets: DagPresetBlueprint[];
  selectedDagPresetId: string;
  onSelectPreset: (presetId: string) => void;
  dagInitialInput: string;
  onSetInitialInput: (val: string) => void;
  dagNodes: DagNodeSpec[];
  dagEnableCache: boolean;
  onSetEnableCache: (val: boolean) => void;
  dagAddEngineId: string;
  onSetAddEngineId: (val: string) => void;
  catalogModels: ModelCatalogEntry[];
  onAddNode: () => void;
  onRemoveNode: (index: number) => void;
  onMoveNode: (index: number, direction: -1 | 1) => void;
  onUpdateNodeParam?: (index: number, paramKey: string, val: any) => void;
  dagRunning: boolean;
  activeStreamingDagNodeId: string | null;
  executedStages: DagStageExecutionResult[];
  onExecuteDag: () => Promise<void>;
  onStreamDag: () => Promise<void>;
}

export function DagPipelineCanvas(props: DagPipelineCanvasProps) {
  const [expandedParamIndex, setExpandedParamIndex] = createSignal<number | null>(null);

  const getModalityIcon = (pipelineType: string) => {
    switch (pipelineType) {
      case "text-to-speech":
        return <Volume2 class="w-4 h-4 text-emerald-400" />;
      case "text-to-image":
        return <Image class="w-4 h-4 text-pink-400" />;
      case "automatic-speech-recognition":
        return <Mic class="w-4 h-4 text-amber-400" />;
      case "image-segmentation":
        return <Scissors class="w-4 h-4 text-cyan-400" />;
      case "text-generation":
        return <Sparkles class="w-4 h-4 text-purple-400" />;
      default:
        return <FileText class="w-4 h-4 text-blue-400" />;
    }
  };

  const getModalityIO = (manifest?: ModelCatalogEntry) => {
    if (!manifest) return { in: "Any", out: "Any" };
    switch (manifest.pipeline_type) {
      case "text-to-speech":
        return { in: "Text", out: "Audio (48kHz)" };
      case "text-to-image":
        return { in: "Text", out: "PNG Image" };
      case "automatic-speech-recognition":
        return { in: "Audio", out: "Transcript" };
      case "image-segmentation":
        return { in: "Image", out: "RGBA Matte" };
      case "text-generation":
        return { in: "Prompt", out: "Tokens" };
      case "feature-extraction":
        return { in: "Text", out: "Vector (768d)" };
      default:
        return { in: manifest.input_modality || "Data", out: manifest.output_modality || "Data" };
    }
  };

  return (
    <div class="rounded-2xl border border-primary/30 bg-card/70 p-4 space-y-4 shadow-sm backdrop-blur-md">
      {/* Top Controls: Preset Blueprints & Cache */}
      <div class="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/70">
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Workflow class="w-4 h-4 text-primary" />
            <span>Preset Blueprints:</span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <For each={props.dagPresets}>
              {(bp) => (
                <button
                  type="button"
                  onClick={() => props.onSelectPreset(bp.preset_id)}
                  class={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition ${
                    props.selectedDagPresetId === bp.preset_id
                      ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                      : "bg-surface text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  {bp.name.split(" (")[0]}
                </button>
              )}
            </For>
          </div>
        </div>

        <label class="flex items-center gap-2 text-xs font-mono text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={props.dagEnableCache}
            onChange={(e) => props.onSetEnableCache(e.currentTarget.checked)}
            class="rounded accent-primary w-3.5 h-3.5"
          />
          <Database class="w-3.5 h-3.5 text-primary" />
          <span>SHA-256 Multi-Stage Cache</span>
        </label>
      </div>

      {/* Horizontal Interactive Stage Canvas */}
      <div class="overflow-x-auto pb-3 pt-1 studio-scroll">
        <div class="flex items-stretch gap-2.5 min-w-max">
          <For each={props.dagNodes}>
            {(node, idx) => {
              const modelMeta = () => (props.catalogModels || []).find((m) => m.engine_id === node.engine_id);
              const pStyle = () => getPipelineStudioStyle(modelMeta()?.pipeline_type ?? "text-classification");
              const isNodeStreaming = () => props.activeStreamingDagNodeId === (node.node_id || `stage_${idx() + 1}`);
              const executedStage = () => (props.executedStages || []).find((s) => s.stage_index === idx() + 1);
              const io = () => getModalityIO(modelMeta());
              const isParamsOpen = () => expandedParamIndex() === idx();

              return (
                <div class="flex items-center gap-2.5">
                  {/* Stage Card */}
                  <div
                    class={`w-64 rounded-xl border p-3.5 space-y-2.5 transition-all flex flex-col justify-between ${
                      isNodeStreaming()
                        ? "border-primary bg-primary/10 ring-2 ring-primary/60 shadow-lg shadow-primary/20 animate-pulse"
                        : executedStage()
                        ? "border-success/50 bg-surface shadow-sm"
                        : "border-border bg-surface hover:border-border/80"
                    }`}
                  >
                    {/* Header: Stage Index, Type Icon, Actions */}
                    <div class="flex items-center justify-between gap-1.5">
                      <div class="flex items-center gap-2">
                        <span
                          class={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border ${pStyle().accentBg} ${pStyle().accentText} ${pStyle().accentBorder}`}
                        >
                          #{idx() + 1}
                        </span>
                        <div class="p-1 rounded-md bg-card border border-border">
                          {getModalityIcon(modelMeta()?.pipeline_type ?? "")}
                        </div>
                      </div>

                      {/* Move / Delete Controls */}
                      <div class="flex items-center gap-0.5 text-muted-foreground">
                        <Show when={idx() > 0}>
                          <button
                            type="button"
                            onClick={() => props.onMoveNode(idx(), -1)}
                            disabled={props.dagRunning}
                            class="p-1 rounded hover:bg-card hover:text-foreground text-xs disabled:opacity-40"
                            title="Move stage earlier"
                          >
                            <ArrowLeft class="w-3.5 h-3.5" />
                          </button>
                        </Show>
                        <Show when={idx() < props.dagNodes.length - 1}>
                          <button
                            type="button"
                            onClick={() => props.onMoveNode(idx(), 1)}
                            disabled={props.dagRunning}
                            class="p-1 rounded hover:bg-card hover:text-foreground text-xs disabled:opacity-40"
                            title="Move stage later"
                          >
                            <ArrowRight class="w-3.5 h-3.5" />
                          </button>
                        </Show>
                        <Show when={props.dagNodes.length > 1}>
                          <button
                            type="button"
                            onClick={() => props.onRemoveNode(idx())}
                            disabled={props.dagRunning}
                            class="p-1 rounded hover:bg-destructive/20 hover:text-destructive text-xs disabled:opacity-40"
                            title="Remove stage from DAG"
                          >
                            <Trash2 class="w-3.5 h-3.5" />
                          </button>
                        </Show>
                      </div>
                    </div>

                    {/* Model Details */}
                    <div>
                      <div class="font-bold text-xs text-foreground truncate" title={modelMeta()?.display_name || node.engine_id}>
                        {modelMeta()?.display_name.split(" (")[0] || node.engine_id}
                      </div>
                      <div class="text-[10px] font-mono text-muted-foreground truncate" title={node.engine_id}>
                        {node.engine_id}
                      </div>
                    </div>

                    {/* Modality I/O Flow Pill */}
                    <div class="px-2 py-1 rounded-lg bg-card border border-border/80 flex items-center justify-between text-[10px] font-mono">
                      <span class="text-muted-foreground truncate">{io().in}</span>
                      <ArrowRight class="w-3 h-3 text-primary shrink-0 mx-1" />
                      <span class="text-primary font-semibold truncate">{io().out}</span>
                    </div>

                    {/* Status Strip */}
                    <div class="pt-1 flex items-center justify-between text-[10px] font-mono">
                      <Show
                        when={isNodeStreaming()}
                        fallback={
                          <Show
                            when={executedStage()}
                            fallback={
                              <span class="text-muted-foreground flex items-center gap-1">
                                <span class="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" /> Idle
                              </span>
                            }
                          >
                            <span class="text-success font-semibold flex items-center gap-1">
                              <CheckCircle2 class="w-3.5 h-3.5 text-success" />
                              {executedStage()!.latency_ms}ms
                            </span>
                            <Show when={executedStage()!.cached}>
                              <Badge variant="outline" class="text-[9px] px-1 py-0 border-cyan-500/50 text-cyan-400">
                                CACHED
                              </Badge>
                            </Show>
                          </Show>
                        }
                      >
                        <span class="text-primary font-bold flex items-center gap-1 animate-pulse">
                          <RefreshCw class="w-3 h-3 animate-spin" /> STREAMING
                        </span>
                      </Show>

                      {/* Parameter Override Toggle */}
                      <button
                        type="button"
                        onClick={() => setExpandedParamIndex(isParamsOpen() ? null : idx())}
                        class="text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition"
                        title="Toggle per-stage parameters"
                      >
                        <Sliders class="w-3 h-3" />
                        <Show when={isParamsOpen()} fallback={<ChevronDown class="w-3 h-3" />}>
                          <ChevronUp class="w-3 h-3" />
                        </Show>
                      </button>
                    </div>

                    {/* Collapsible Parameter Drawer */}
                    <Show when={isParamsOpen()}>
                      <div class="pt-2 border-t border-border/70 space-y-1.5 text-[10px] font-mono">
                        <div class="text-muted-foreground font-semibold">STAGE PARAMETERS</div>
                        <Show
                          when={modelMeta()?.parameters_schema && modelMeta()!.parameters_schema!.length > 0}
                          fallback={<div class="text-muted-foreground italic">No configurable parameters.</div>}
                        >
                          <For each={modelMeta()?.parameters_schema?.slice(0, 3)}>
                            {(field) => (
                              <div class="flex items-center justify-between gap-1">
                                <span class="text-muted-foreground truncate">{field.key}:</span>
                                <input
                                  type="text"
                                  value={String(node.parameters?.[field.key] ?? field.default ?? "")}
                                  onInput={(e) => {
                                    if (props.onUpdateNodeParam) {
                                      props.onUpdateNodeParam(idx(), field.key, e.currentTarget.value);
                                    }
                                  }}
                                  class="h-5 w-24 px-1 rounded border border-border bg-card text-[10px] text-foreground text-right"
                                />
                              </div>
                            )}
                          </For>
                        </Show>
                      </div>
                    </Show>
                  </div>

                  {/* Flow Connector Arrow */}
                  <Show when={idx() < props.dagNodes.length - 1}>
                    <div class="flex flex-col items-center justify-center text-primary/70">
                      <ArrowRight class="w-5 h-5 animate-pulse" />
                      <span class="text-[9px] font-mono text-muted-foreground">pipe</span>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>

          {/* Add Stage Card */}
          <div class="w-56 rounded-xl border border-dashed border-border p-3.5 flex flex-col justify-center items-center gap-2 bg-surface/40 hover:bg-surface/80 transition">
            <span class="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Plus class="w-3.5 h-3.5" /> Append Stage
            </span>
            <select
              value={props.dagAddEngineId}
              onChange={(e) => props.onSetAddEngineId(e.currentTarget.value)}
              aria-label="Select Model for New Stage"
              class="w-full h-8 rounded-lg border border-border bg-card px-2 text-[11px] font-mono text-foreground"
            >
              <For each={props.catalogModels}>
                {(m) => (
                  <option value={m.engine_id}>
                    {m.display_name.split(" (")[0]} [{m.pipeline_type}]
                  </option>
                )}
              </For>
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={props.onAddNode}
              disabled={props.dagRunning}
              class="w-full h-7 text-xs font-medium"
            >
              <Plus class="w-3 h-3 mr-1" /> Add to Pipeline
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Execution Bar */}
      <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-border/70">
        <Input
          value={props.dagInitialInput}
          onInput={(e) => props.onSetInitialInput(e.currentTarget.value)}
          placeholder="Initial input prompt for Stage #1 (e.g. 'A futuristic electric hypercar in neon Tokyo rain')..."
          class="h-9 text-xs font-mono flex-1 min-w-[240px]"
        />

        <Button
          size="sm"
          variant="outline"
          onClick={() => void props.onStreamDag()}
          disabled={props.dagRunning}
          class="h-9 px-4 text-xs border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 font-semibold"
        >
          <Show
            when={props.dagRunning && props.activeStreamingDagNodeId}
            fallback={<Radio class="w-4 h-4 text-primary mr-1.5" />}
          >
            <RefreshCw class="w-4 h-4 animate-spin mr-1.5" />
          </Show>
          <span>Stream DAG Live</span>
        </Button>

        <Button
          size="sm"
          onClick={() => void props.onExecuteDag()}
          disabled={props.dagRunning}
          class="h-9 px-4 text-xs font-semibold"
        >
          <Show
            when={props.dagRunning && !props.activeStreamingDagNodeId}
            fallback={<Play class="w-4 h-4 fill-current mr-1.5" />}
          >
            <RefreshCw class="w-4 h-4 animate-spin mr-1.5" />
          </Show>
          <span>Execute All Stages</span>
        </Button>
      </div>
    </div>
  );
}
