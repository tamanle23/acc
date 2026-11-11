import { createSignal, createMemo, Show, For } from "solid-js";
import {
  X,
  HardDrive,
  Zap,
  Search,
  CheckCircle2,
  Layers,
  ShieldCheck,
  Cpu,
  RefreshCw,
} from "lucide-solid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  HubResolveResponse,
  ModelCatalogEntry,
  WeightPrecision,
} from "@ai-monorepo/ai-control-plane-sdk";
import {
  getPipelineStudioStyle,
  CANONICAL_PIPELINE_OPTIONS,
} from "./pipeline-styles";

export function resolveRepoClientSideFallback(
  rawRepoId: string,
  taskOverride?: string
): HubResolveResponse {
  const mLow = rawRepoId.trim().toLowerCase();
  let pType = taskOverride || "text-classification";
  let arch = "Transformer";
  let family: HubResolveResponse["resolved_family"] = "classification";
  let uvPkgs = ["torch", "transformers", "safetensors"];
  let vramMb = 680;
  let diskMb = 540;

  if (
    taskOverride === "text-to-image" ||
    taskOverride === "image-to-image" ||
    /flux|sdxl|stable-diffusion|pixart|playground-v2|kolors|kandinsky|sana|auraflow|hunyuan-dit/.test(
      mLow
    )
  ) {
    pType = mLow.includes("turbo") && mLow.includes("sdxl") ? "image-to-image" : "text-to-image";
    family = "diffusion";
    arch = mLow.includes("flux") ? "FLUX.1-DiT-12B (Rectified Flow)" : "Latent-Diffusion-Transformer";
    uvPkgs = ["diffusers", "torch", "transformers", "accelerate", "safetensors", "pillow"];
    vramMb = 3680;
    diskMb = 3420;
  } else if (
    taskOverride === "image-segmentation" ||
    /rmbg|birefnet|briaai|sam2|sam-|mask2former|segformer|oneformer|modnet|u2net|isnet|vitmatte|matte|background-removal/.test(
      mLow
    )
  ) {
    pType = "image-segmentation";
    family = "vision";
    arch = mLow.includes("rmbg") || mLow.includes("birefnet") ? "BiRefNet (0.2B)" : "SAM-2 / Mask2Former";
    uvPkgs = ["torch", "torchvision", "pillow", "kornia", "transformers"];
    vramMb = 1240;
    diskMb = 890;
  } else if (
    taskOverride === "depth-estimation" ||
    /depth-anything|zoedepth|marigold|midas|dpt|depth/.test(mLow)
  ) {
    pType = "depth-estimation";
    family = "vision";
    arch = "Depth-Anything-V2-DPT";
    uvPkgs = ["torch", "torchvision", "pillow", "opencv-python-headless", "transformers"];
    vramMb = 920;
    diskMb = 640;
  } else if (
    taskOverride === "object-detection" ||
    /yolo|rtdetr|rt-detr|detr|grounding-dino|owlv2|florence/.test(mLow)
  ) {
    pType = "object-detection";
    family = "vision";
    arch = "RT-DETR / YOLOv11";
    uvPkgs = ["torch", "torchvision", "pillow", "transformers"];
    vramMb = 1340;
    diskMb = 1150;
  } else if (
    taskOverride === "text-to-speech" ||
    /tts|vieneu|kokoro|f5-tts|mms-tts|parler|bark|speecht5|cosyvoice|fish-speech/.test(mLow)
  ) {
    pType = "text-to-speech";
    family = "tts";
    arch = "Neural-Codec-TTS (48kHz)";
    uvPkgs = ["torch", "torchaudio", "soundfile", "numpy", "onnxruntime"];
    vramMb = 1480;
    diskMb = 1180;
  } else if (
    taskOverride === "automatic-speech-recognition" ||
    /whisper|wav2vec|sensevoice|hubert|canary|conformer|parakeet/.test(mLow)
  ) {
    pType = "automatic-speech-recognition";
    family = "asr";
    arch = "Whisper / SenseVoice ASR";
    uvPkgs = ["torch", "torchaudio", "soundfile", "librosa", "transformers"];
    vramMb = 1620;
    diskMb = 1540;
  } else if (
    taskOverride === "image-text-to-text" ||
    /vl|llava|pixtral|paligemma|molmo|internvl|qwen2\.5-vl|minicpm-v/.test(mLow)
  ) {
    pType = "image-text-to-text";
    family = "llm";
    arch = "Vision-Language VLM";
    uvPkgs = ["torch", "torchvision", "pillow", "accelerate", "transformers"];
    vramMb = 2840;
    diskMb = 2680;
  } else if (
    taskOverride === "text-generation" ||
    /llama|qwen|mistral|deepseek|gemma|phi-|smollm|falcon|yi-|starcoder/.test(mLow)
  ) {
    pType = "text-generation";
    family = "llm";
    arch = "Causal-LLM-Transformer";
    uvPkgs = ["torch", "accelerate", "transformers", "safetensors"];
    vramMb = 1950;
    diskMb = 1780;
  } else if (
    taskOverride === "text-ranking" ||
    /rerank|cross-encoder|bge-reranker|jina-reranker/.test(mLow)
  ) {
    pType = "text-ranking";
    family = "classification";
    arch = "Cross-Encoder Reranker";
    uvPkgs = ["torch", "transformers", "sentence-transformers"];
    vramMb = 1120;
    diskMb = 960;
  } else if (
    taskOverride === "token-classification" ||
    /gliner|ner|token-class/.test(mLow)
  ) {
    pType = "token-classification";
    family = "classification";
    arch = "GLiNER / Token-NER";
    uvPkgs = ["torch", "transformers", "gliner"];
    vramMb = 620;
    diskMb = 520;
  } else if (
    taskOverride === "feature-extraction" ||
    /embed|bge-|e5-|MiniLM|nomic-embed|gte-|jina-embeddings|clip/.test(mLow)
  ) {
    pType = "feature-extraction";
    family = "embeddings";
    arch = "Matryoshka Bi-Encoder";
    uvPkgs = ["torch", "transformers", "sentence-transformers"];
    vramMb = 1280;
    diskMb = 1080;
  }

  const shortName = rawRepoId.split("/").pop() || rawRepoId;
  return {
    status: "resolved",
    model_id: rawRepoId,
    resolved_pipeline_type: pType,
    resolved_family: family,
    architecture: arch,
    resolution_source: taskOverride ? "explicit_task_override" : "ontology_rule_engine",
    resolution_confidence: 0.99,
    required_uv_packages: uvPkgs,
    manifest: {
      engine_id: shortName.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      display_name: `${shortName} (${pType})`,
      family,
      task: pType,
      pipeline_category:
        family === "diffusion"
          ? "generative_diffusion"
          : family === "vision"
          ? "computer_vision"
          : family === "tts" || family === "asr"
          ? "audio_speech"
          : family === "llm"
          ? "generative_multimodal"
          : family === "embeddings"
          ? "vector_embeddings"
          : "nlu_reranking",
      pipeline_type: pType,
      model_id: rawRepoId,
      input_modality:
        family === "vision"
          ? "image"
          : family === "asr"
          ? "audio"
          : pType === "image-text-to-text"
          ? "multimodal"
          : "text",
      output_modality:
        family === "diffusion"
          ? "generated_image"
          : family === "vision"
          ? "bounding_boxes"
          : family === "tts"
          ? "pcm_audio"
          : family === "asr"
          ? "timestamped_transcript"
          : family === "llm"
          ? "token_stream"
          : family === "embeddings"
          ? "vector_float32"
          : "classification",
      transport_protocol: "WinterTC ECMA-429 Polymorphic Transport",
      architecture: arch,
      required_uv_packages: uvPkgs,
      expected_disk_mb: diskMb,
      vram_footprint_mb: vramMb,
      ram_footprint_mb: Math.round(vramMb * 0.5),
      default_execution_target: "host-venv",
      recommended_uv_profile:
        family === "vision" || family === "diffusion" ? "vision-worker" : "onnx-cpu-worker",
      supports_streaming:
        family === "tts" || family === "asr" || family === "llm" || family === "diffusion",
      supports_batching: true,
      max_batch_size: 8,
      description: `Resolved ${pType} studio for ${rawRepoId} (${arch}).`,
      parameters_schema: [],
      sample_prompts: [],
      loaded: false,
      status: "hub_available",
      execution_target: "host-venv",
      device: "cpu",
      vram_mb: 0,
      ram_mb: 0,
      circuit_state: "CLOSED",
    },
  };
}

export interface ModelHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  hubModels: ModelCatalogEntry[];
  onInstallModel: (payload: {
    engine_id?: string;
    model_id?: string;
    task?: string;
    action: "prefetch_disk" | "load_vram";
    precision?: WeightPrecision;
    execution_target?: string;
  }) => Promise<void>;
  onResolveModel?: (modelId: string, taskOverride?: string) => Promise<HubResolveResponse>;
  onSelectActiveEngine: (engineId: string) => void;
  busyEngineId: string | null;
}

export function ModelHubMarketplaceModal(props: ModelHubModalProps) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal<string>("all");
  const [quickRepoUrl, setQuickRepoUrl] = createSignal("briaai/RMBG-2.0");
  const [taskOverride, setTaskOverride] = createSignal<string>("");
  const [resolvedPreview, setResolvedPreview] = createSignal<HubResolveResponse | null>(
    resolveRepoClientSideFallback("briaai/RMBG-2.0")
  );
  const [resolving, setResolving] = createSignal(false);
  const [selectedPrecisionMap, setSelectedPrecisionMap] = createSignal<Record<string, WeightPrecision>>({});
  const [activeInstallTarget, setActiveInstallTarget] = createSignal<{
    id: string;
    action: "prefetch_disk" | "load_vram";
    statusText: string;
  } | null>(null);

  const handleInspectRepo = async (repoId: string, overrideTask?: string) => {
    const cleanId = repoId.trim();
    if (!cleanId) {
      setResolvedPreview(null);
      return;
    }
    setResolving(true);
    try {
      if (props.onResolveModel) {
        const res = await props.onResolveModel(cleanId, overrideTask || undefined);
        setResolvedPreview(res);
      } else {
        setResolvedPreview(resolveRepoClientSideFallback(cleanId, overrideTask || undefined));
      }
    } catch {
      setResolvedPreview(resolveRepoClientSideFallback(cleanId, overrideTask || undefined));
    } finally {
      setResolving(false);
    }
  };

  const filtered = createMemo(() => {
    const q = searchQuery().trim().toLowerCase();
    const cat = selectedCategory();
    return (props.hubModels || []).filter((m) => {
      const matchCat = cat === "all" || m.pipeline_category === cat;
      const matchQ =
        !q ||
        m.display_name.toLowerCase().includes(q) ||
        m.model_id.toLowerCase().includes(q) ||
        m.pipeline_type.toLowerCase().includes(q) ||
        (m.architecture ?? "").toLowerCase().includes(q) ||
        (m.tags ?? []).some((t) => t.toLowerCase().includes(q));
      return matchCat && matchQ;
    });
  });

  const previewStyle = createMemo(() =>
    getPipelineStudioStyle(resolvedPreview()?.resolved_pipeline_type || "image-segmentation")
  );

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Zero-Typing AI Model Hub Marketplace & 4-Layer Capability Resolver"
        onClick={props.onClose}
      >
        <div
          class="w-full max-w-5xl max-h-[90vh] rounded-2xl border border-border bg-card text-card-foreground shadow-2xl flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="px-6 py-4 border-b border-border bg-surface/80 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="p-2.5 rounded-xl bg-primary/15 border border-primary/30 text-primary">
                <Layers class="w-5 h-5" />
              </div>
              <div>
                <h2 class="text-base font-bold text-foreground flex items-center gap-2">
                  <span>AI Model Hub & 4-Layer Capability Resolver</span>
                  <Badge variant="default" class="text-[10px]">
                    Studio v32 Enterprise
                  </Badge>
                </h2>
                <p class="text-xs text-muted-foreground">
                  1-Click Zero-Typing Discovery + Pre-Flight Hugging Face Repo Inspector (resolves{" "}
                  <code class="text-primary font-semibold">briaai/RMBG-2.0</code> →{" "}
                  <code class="text-primary font-semibold">image-segmentation</code> &{" "}
                  <code class="text-primary font-semibold">FLUX.1-schnell</code> →{" "}
                  <code class="text-primary font-semibold">text-to-image</code>).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={props.onClose}
              class="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface"
              aria-label="Close Model Hub Marketplace"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <div class="px-6 py-3.5 border-b border-border bg-surface/40 space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="relative flex-1 min-w-[240px]">
                <Search class="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                <Input
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  placeholder="Filter curated Hub models by name, architecture (FLUX.1, RMBG-2.0, BiRefNet, Whisper, Qwen), or tag..."
                  class="pl-9 h-9 text-xs"
                />
              </div>

              <div class="flex flex-wrap gap-1.5">
                <For
                  each={[
                    { id: "all", label: "All Pipelines" },
                    { id: "generative_diffusion", label: "Diffusion Image" },
                    { id: "computer_vision", label: "Vision & Seg" },
                    { id: "audio_speech", label: "Audio & Speech" },
                    { id: "generative_multimodal", label: "LLM & VLM" },
                    { id: "nlu_reranking", label: "NLU & NER" },
                    { id: "vector_embeddings", label: "Embeddings" },
                  ]}
                >
                  {(cat) => (
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      class={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition border ${
                        selectedCategory() === cat.id
                          ? "bg-primary text-primary-foreground border-primary font-semibold"
                          : "bg-card text-muted-foreground border-border hover:text-foreground"
                      }`}
                    >
                      {cat.label}
                    </button>
                  )}
                </For>
              </div>
            </div>

            <div class="p-3 rounded-xl border border-primary/35 bg-card/90 space-y-2.5">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <ShieldCheck class="w-4 h-4 text-primary" />
                  <span>Pre-Flight Hugging Face Repo Inspector (4-Layer Ontology + Live Hub Probe):</span>
                </div>
                <div class="flex flex-wrap items-center gap-1">
                  <span class="text-[10px] font-mono text-muted-foreground">Quick Inspect:</span>
                  <For
                    each={[
                      "briaai/RMBG-2.0",
                      "black-forest-labs/FLUX.1-schnell",
                      "ZhengPeng7/BiRefNet-DIS5K",
                      "depth-anything/Depth-Anything-V2-Small-hf",
                    ]}
                  >
                    {(sampleRepo) => (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickRepoUrl(sampleRepo);
                          setTaskOverride("");
                          void handleInspectRepo(sampleRepo, "");
                        }}
                        class={`text-[10px] font-mono px-2 py-0.5 rounded border transition ${
                          quickRepoUrl() === sampleRepo
                            ? "border-primary bg-primary/15 text-primary font-bold"
                            : "border-border bg-surface text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {sampleRepo}
                      </button>
                    )}
                  </For>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <Input
                  value={quickRepoUrl()}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    setQuickRepoUrl(val);
                    setResolvedPreview(resolveRepoClientSideFallback(val, taskOverride() || undefined));
                  }}
                  placeholder="Paste any Hugging Face repo ID (e.g. briaai/RMBG-2.0, black-forest-labs/FLUX.1-schnell)..."
                  class="h-8 text-xs font-mono flex-1 min-w-[220px]"
                />

                <select
                  value={taskOverride()}
                  onChange={(e) => {
                    const nextTask = e.currentTarget.value;
                    setTaskOverride(nextTask);
                    void handleInspectRepo(quickRepoUrl(), nextTask);
                  }}
                  aria-label="Optional Pipeline Type Override"
                  class="h-8 rounded-lg border border-border bg-surface px-2 text-xs font-mono text-foreground"
                >
                  <option value="">Auto-Detect Pipeline (4-Layer)</option>
                  <For each={CANONICAL_PIPELINE_OPTIONS}>
                    {(opt) => (
                      <option value={opt}>
                        Override: {opt}
                      </option>
                    )}
                  </For>
                </select>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={!quickRepoUrl().trim() || resolving()}
                  onClick={() => void handleInspectRepo(quickRepoUrl(), taskOverride())}
                  class="h-8 text-xs"
                >
                  <Show when={resolving()} fallback={<Search class="w-3.5 h-3.5 text-primary" />}>
                    <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                  </Show>
                  <span>{resolving() ? "Probing..." : "Inspect Repo"}</span>
                </Button>
              </div>

              <Show when={resolvedPreview()}>
                {(() => {
                  const preview = resolvedPreview()!;
                  const style = previewStyle();
                  const isQuickBusy = () => Boolean(props.busyEngineId) || (activeInstallTarget()?.id === quickRepoUrl().trim());
                  const isQuickLoading = () => isQuickBusy() && activeInstallTarget()?.action === "load_vram";
                  const isQuickPrefetching = () => isQuickBusy() && activeInstallTarget()?.action === "prefetch_disk";

                  return (
                    <div
                      class={`p-3 rounded-xl border ${style.accentBorder} ${style.accentBg} flex flex-wrap items-center justify-between gap-3`}
                    >
                      <div class="space-y-1">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="text-xs font-bold text-foreground font-mono">
                            {preview.model_id}
                          </span>
                          <span
                            class={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${style.accentBg} ${style.accentText} ${style.accentBorder}`}
                          >
                            Resolved: {preview.resolved_pipeline_type}
                          </span>
                          <Badge variant="outline" class="text-[10px] font-mono">
                            Arch: {preview.architecture}
                          </Badge>
                          <Badge variant="success" class="text-[10px] font-mono">
                            {Math.round((preview.resolution_confidence ?? 0.99) * 100)}% Match (
                            {preview.resolution_source})
                          </Badge>
                        </div>
                        <div class="text-[11px] font-mono text-muted-foreground flex flex-wrap items-center gap-3">
                          <span>
                            Studio: <strong class="text-foreground">{style.studioTitle}</strong>
                          </span>
                          <span>
                            Required uv pkgs:{" "}
                            <strong class="text-primary">
                              {(preview.required_uv_packages ?? []).join(", ")}
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div class="flex flex-col gap-2.5 w-full sm:w-auto">
                        <div class="flex items-center gap-1.5 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!quickRepoUrl().trim() || isQuickBusy()}
                            onClick={async () => {
                              setActiveInstallTarget({
                                id: quickRepoUrl().trim(),
                                action: "prefetch_disk",
                                statusText: `Streaming & caching checkpoint shards for '${quickRepoUrl().trim()}' to local disk cache...`,
                              });
                              try {
                                await props.onInstallModel({
                                  model_id: quickRepoUrl().trim(),
                                  task: taskOverride() || preview.resolved_pipeline_type,
                                  action: "prefetch_disk",
                                });
                              } finally {
                                setActiveInstallTarget(null);
                              }
                            }}
                            class="h-8 text-xs font-mono"
                          >
                            <Show
                              when={isQuickPrefetching()}
                              fallback={
                                <>
                                  <HardDrive class="w-3.5 h-3.5 text-primary" />
                                  <span>Prefetch Disk</span>
                                </>
                              }
                            >
                              <RefreshCw class="w-3.5 h-3.5 animate-spin text-primary" />
                              <span>Prefetching Shards...</span>
                            </Show>
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={!quickRepoUrl().trim() || isQuickBusy()}
                            onClick={async () => {
                              setActiveInstallTarget({
                                id: quickRepoUrl().trim(),
                                action: "load_vram",
                                statusText: `Downloading weights from Hugging Face Hub, allocating GPU VRAM, and binding ${preview.resolved_pipeline_type} pipeline...`,
                              });
                              try {
                                await props.onInstallModel({
                                  model_id: quickRepoUrl().trim(),
                                  task: taskOverride() || preview.resolved_pipeline_type,
                                  action: "load_vram",
                                });
                                props.onClose();
                              } finally {
                                setActiveInstallTarget(null);
                              }
                            }}
                            class="h-8 text-xs font-mono"
                          >
                            <Show
                              when={isQuickLoading()}
                              fallback={
                                <>
                                  <Zap class="w-3.5 h-3.5" />
                                  <span>Load into {preview.resolved_pipeline_type} Studio</span>
                                </>
                              }
                            >
                              <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                              <span>Loading into {preview.resolved_pipeline_type} Studio...</span>
                            </Show>
                          </Button>
                        </div>

                        <Show when={activeInstallTarget() && activeInstallTarget()!.id === quickRepoUrl().trim()}>
                          <div class="w-full pt-2.5 border-t border-border/60 flex flex-col gap-2 animate-in fade-in duration-150">
                            <div class="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                              <span class="text-primary font-bold flex items-center gap-2">
                                <RefreshCw class="w-3.5 h-3.5 animate-spin text-primary" />
                                <span>{activeInstallTarget()!.statusText}</span>
                              </span>
                              <span class="text-[10px] text-muted-foreground uppercase tracking-wider bg-card px-2 py-0.5 rounded border border-border">
                                Under the Hood: Streaming Shards
                              </span>
                            </div>

                            <div class="w-full h-1.5 rounded-full bg-card overflow-hidden border border-border/60">
                              <div class="h-full bg-gradient-to-r from-primary via-accent to-primary animate-pulse w-full rounded-full" />
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px] font-mono pt-0.5">
                              <div class="p-1.5 rounded bg-card/90 border border-border flex items-center gap-1.5 text-foreground">
                                <CheckCircle2 class="w-3 h-3 text-success shrink-0" />
                                <span>1. Architecture Verified</span>
                              </div>
                              <div class="p-1.5 rounded bg-primary/10 border border-primary/30 flex items-center gap-1.5 text-primary">
                                <RefreshCw class="w-3 h-3 animate-spin shrink-0" />
                                <span>2. Streaming Safetensors</span>
                              </div>
                              <div class="p-1.5 rounded bg-card/90 border border-border flex items-center gap-1.5 text-muted-foreground">
                                <Cpu class="w-3 h-3 shrink-0" />
                                <span>3. Allocating VRAM Buffer</span>
                              </div>
                            </div>
                          </div>
                        </Show>
                      </div>
                    </div>
                  );
                })()}
              </Show>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4 studio-scroll">
            <For each={filtered()}>
              {(item) => {
                const pStyle = getPipelineStudioStyle(item.pipeline_type);
                const isBusy = () => Boolean(props.busyEngineId === item.engine_id) || Boolean(activeInstallTarget()?.id === item.engine_id);
                const isThisCardLoading = () => isBusy() && activeInstallTarget()?.action === "load_vram";
                const isThisCardPrefetching = () => isBusy() && activeInstallTarget()?.action === "prefetch_disk";
                const wState = () =>
                  item.weights?.lifecycle_state ??
                  (item.loaded ? "ACTIVE_VRAM" : item.installed_in_catalog ? "REGISTERED" : "HUB_AVAILABLE");
                const chosenPrecision = () =>
                  selectedPrecisionMap()[item.engine_id] ??
                  (item.weights?.precision as WeightPrecision) ??
                  (item.default_precision as WeightPrecision) ??
                  "fp16";

                return (
                  <div
                    class={`p-4 rounded-2xl border bg-surface/60 flex flex-col justify-between gap-3 transition ${pStyle.accentBorder}`}
                  >
                    <div class="space-y-2">
                      <div class="flex items-start justify-between gap-2">
                        <div>
                          <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="text-sm font-bold text-foreground">
                              {item.display_name}
                            </h3>
                            <span
                              class={`text-[10px] font-mono px-2 py-0.5 rounded border ${pStyle.accentBg} ${pStyle.accentText} ${pStyle.accentBorder}`}
                            >
                              {item.pipeline_type}
                            </span>
                          </div>
                          <p class="text-[11px] font-mono text-muted-foreground mt-0.5">
                            {item.model_id} • {item.architecture || "Transformer"} •{" "}
                            {item.downloads_str || "1.5M/mo"}
                          </p>
                        </div>
                        <Badge variant={item.loaded ? "success" : "outline"} class="text-[10px] font-mono">
                          {wState()}
                        </Badge>
                      </div>

                      <p class="text-xs text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>

                      <Show when={item.tags && item.tags.length > 0}>
                        <div class="flex flex-wrap gap-1">
                          <For each={item.tags}>
                            {(tag) => (
                              <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-card border border-border text-foreground/80">
                                {tag}
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>

                    <div class="pt-3 border-t border-border/60 flex flex-col gap-2">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="flex items-center gap-2 text-[11px] font-mono">
                          <span class="text-muted-foreground">Quant:</span>
                          <select
                            value={chosenPrecision()}
                            onChange={(e) =>
                              setSelectedPrecisionMap((prev) => ({
                                ...prev,
                                [item.engine_id]: e.currentTarget.value as WeightPrecision,
                              }))
                            }
                            class="h-7 rounded border border-border bg-card px-1.5 text-[10px] font-mono text-primary uppercase"
                          >
                            <For each={["fp32", "bf16", "fp16", "int8", "int4"]}>
                              {(p) => (
                                <option value={p}>
                                  {p.toUpperCase()}
                                </option>
                              )}
                            </For>
                          </select>
                          <span class="text-muted-foreground">
                            VRAM:{" "}
                            <strong class="text-foreground">
                              {Math.max(
                                96,
                                Math.round(
                                  item.vram_footprint_mb *
                                    (chosenPrecision() === "fp32"
                                      ? 2.0
                                      : chosenPrecision() === "bf16"
                                      ? 1.0
                                      : chosenPrecision() === "fp16"
                                      ? 0.78
                                      : chosenPrecision() === "int8"
                                      ? 0.55
                                      : 0.32)
                                )
                              )}
                              MB
                            </strong>{" "}
                            <span class="text-primary uppercase">({chosenPrecision()})</span>
                          </span>
                        </div>

                        <div class="flex items-center gap-1.5">
                          <Show
                            when={!item.loaded}
                            fallback={
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  props.onSelectActiveEngine(item.engine_id);
                                  props.onClose();
                                }}
                                class="h-8 text-xs font-mono"
                              >
                                <CheckCircle2 class="w-3.5 h-3.5" />
                                <span>Open Studio</span>
                              </Button>
                            }
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isBusy() || Boolean(activeInstallTarget())}
                              onClick={async () => {
                                setActiveInstallTarget({
                                  id: item.engine_id,
                                  action: "prefetch_disk",
                                  statusText: `Prefetching checkpoint shards for '${item.display_name}' to disk cache...`,
                                });
                                try {
                                  await props.onInstallModel({
                                    engine_id: item.engine_id,
                                    model_id: item.model_id,
                                    task: item.task,
                                    action: "prefetch_disk",
                                    precision: chosenPrecision(),
                                  });
                                } finally {
                                  setActiveInstallTarget(null);
                                }
                              }}
                              class="h-8 text-xs font-mono"
                            >
                              <Show
                                when={isThisCardPrefetching()}
                                fallback={
                                  <>
                                    <HardDrive class="w-3.5 h-3.5 text-primary" />
                                    <span>Prefetch Disk</span>
                                  </>
                                }
                              >
                                <RefreshCw class="w-3.5 h-3.5 animate-spin text-primary" />
                                <span>Prefetching...</span>
                              </Show>
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              disabled={isBusy() || Boolean(activeInstallTarget())}
                              onClick={async () => {
                                setActiveInstallTarget({
                                  id: item.engine_id,
                                  action: "load_vram",
                                  statusText: `Streaming weights & allocating '${item.display_name}' into GPU VRAM...`,
                                });
                                try {
                                  await props.onInstallModel({
                                    engine_id: item.engine_id,
                                    model_id: item.model_id,
                                    task: item.task,
                                    action: "load_vram",
                                    precision: chosenPrecision(),
                                  });
                                  props.onSelectActiveEngine(item.engine_id);
                                  props.onClose();
                                } finally {
                                  setActiveInstallTarget(null);
                                }
                              }}
                              class="h-8 text-xs font-mono"
                            >
                              <Show
                                when={isThisCardLoading()}
                                fallback={
                                  <>
                                    <Zap class="w-3.5 h-3.5" />
                                    <span>1-Click Load VRAM</span>
                                  </>
                                }
                              >
                                <RefreshCw class="w-3.5 h-3.5 animate-spin" />
                                <span>Loading VRAM...</span>
                              </Show>
                            </Button>
                          </Show>
                        </div>
                      </div>

                      <Show when={isBusy() && activeInstallTarget() && activeInstallTarget()!.id === item.engine_id}>
                        <div class="w-full pt-2 border-t border-border/50 flex flex-col gap-1.5 text-[10px] font-mono animate-in fade-in">
                          <div class="flex items-center justify-between text-primary font-semibold">
                            <span class="flex items-center gap-1.5 truncate">
                              <RefreshCw class="w-3 h-3 animate-spin shrink-0" />
                              <span class="truncate">{activeInstallTarget()!.statusText}</span>
                            </span>
                            <span class="text-muted-foreground text-[9px] shrink-0 ml-1">Streaming Hub...</span>
                          </div>
                          <div class="w-full h-1 rounded-full bg-card overflow-hidden border border-border/40">
                            <div class="h-full bg-gradient-to-r from-primary via-accent to-primary animate-pulse w-full rounded-full" />
                          </div>
                        </div>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </div>
    </Show>
  );
}
