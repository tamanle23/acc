import {
  createSignal,
  createMemo,
  createEffect,
  on,
  onMount,
  onCleanup,
  Show,
} from "solid-js";
import { useLocation, useNavigate, useSearchParams } from "@solidjs/router";
import {
  AIInferenceClient,
  sha256DigestHex,
  safeRandomUUID,
  type SystemHealthResponse,
  type VoicePreset,
  type ModelCatalogEntry,
  type ArenaComparisonResult,
  type ServerArenaComparisonResponse,
  type ModelShardInspectionResponse,
  type PipelineCategoryId,
  type WeightPrecision,
  type WeightTierId,
  type HardwareProfileId,
  type OffloadStrategy,
  type LocalHardwareProfile,
  type HostHardwareTelemetry,
  type WeightsSummary,
  type DagPresetBlueprint,
  type DagNodeSpec,
  type DagStageExecutionResult,
  type DagExecutionResponse,
  type SqliteTelemetryLedgerResponse,
  type GpuSandboxStatusResponse,
  type JobStatus,
  type JobProgressInfo,
} from "@acc/ai-control-plane-sdk";
import { RefreshCw, FileCode, Check } from "lucide-solid";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { useThemeManager } from "@/components/studio/theme-manager";
import { StudioAudioPlayer } from "@/components/studio/waveform-visualizer";
import { StreamingAudioPlayer } from "@/utils/streaming-audio-player";
import { StudioCommandPalette } from "@/components/studio/command-palette";
import {
  ModelHubMarketplaceModal,
  getPipelineStudioStyle,
} from "@/components/studio/bespoke-pipeline-studios";

// Reusable extracted types & constants
import type {
  StudioWorkspaceId,
  Cell4Mode,
  ExecutionStatus,
  LifecycleNotice,
  UnifiedSessionRunRecord,
  StreamTelemetry,
} from "@/types/studio";
import {
  STUDIO_SCRIPT_TEMPLATES,
  FALLBACK_HARDWARE_PROFILES,
  TIER_SPEC_MAP,
  FALLBACK_DAG_PRESETS,
  DEFAULT_ISOLATED_SCRIPT,
} from "@/constants/studio-constants";
import { computeClientModelWeights } from "@/lib/audio-synthesizer";

// Modular Bento Cells & Layout Components
import { StudioHeader } from "@/components/studio/studio-header";
import {
  EngineStatusRibbon,
  type StudioPipeline,
  PIPELINE_DISPLAY_NAMES,
} from "@/components/studio/engine-status-ribbon";
import { StudioSidebarNav } from "@/components/studio/studio-sidebar-nav";
import { MobileBottomNav } from "@/components/studio/mobile-bottom-nav";
import {
  BespokePipelineDeckCell,
  PolymorphicVisualizerCell,
  ModelCatalogRackCell,
  SessionAndArenaCell,
  WeightsLifecycleWorkbenchCell,
  UvOrchestratorCell,
  TelemetryAndSdkCell,
} from "@/components/studio/cells";
import {
  VramEvictionModal,
  type VramEvictionRequest,
} from "@/components/studio/modals/vram-eviction-modal";
import { VoiceCloningModal } from "@/components/studio/modals/voice-cloning-modal";

const client = new AIInferenceClient("", {
  timeoutMs: 30_000,
  maxRetries: 2,
  baseBackoffMs: 250,
});

export function App() {
  const themeContext = useThemeManager();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Router-backed activeTab
  const activeTab = createMemo<StudioWorkspaceId>(() => {
    const p = location.pathname.replace(/^\//, "").toLowerCase();
    if (p === "hf" || p === "weights") return "hf";
    if (p === "env" || p === "uv") return "env";
    if (p === "telemetry") return "telemetry";
    if (p === "sdk") return "sdk";
    return "pipelines";
  });

  const handleSelectTab = (tab: StudioWorkspaceId) => {
    navigate(`/${tab}${location.search}`);
  };

  // --- Responsive Layout State ---
  const [sidebarExpanded, setSidebarExpanded] = createSignal(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);

  // --- Pillar 1 & Studio v32: Capability Registry & Model State ---
  const [catalogStatus, setCatalogStatus] = createSignal<"loading" | "ready" | "error">("loading");
  const [catalogErrorMsg, setCatalogErrorMsg] = createSignal<string | null>(null);

  const [catalogModels, setCatalogModels] = createSignal<ModelCatalogEntry[]>([]);
  const [hubMarketplaceModels, setHubMarketplaceModels] = createSignal<ModelCatalogEntry[]>([]);
  const [hubModalOpen, setHubModalOpen] = createSignal(false);
  const [quickHubSelectId, setQuickHubSelectId] = createSignal<string>("sdxl-turbo-img2img");

  const [activeEngineId, setActiveEngineId] = createSignal<string>("vieneu-tts-v3-turbo");
  const [selectedPipelineCategory, setSelectedPipelineCategory] = createSignal<
    "all" | PipelineCategoryId
  >("all");
  const [weightsSummary, setWeightsSummary] = createSignal<WeightsSummary | null>(null);
  const [vramBudgetInput, setVramBudgetInput] = createSignal<number>(8192);
  const [hardwareProfiles, setHardwareProfiles] = createSignal<LocalHardwareProfile[]>(
    FALLBACK_HARDWARE_PROFILES
  );
  const [activeHardwareProfile, setActiveHardwareProfile] = createSignal<LocalHardwareProfile>(
    FALLBACK_HARDWARE_PROFILES[1]
  );
  const [hostTelemetry, setHostTelemetry] = createSignal<HostHardwareTelemetry>({
    cpu_cores: 8,
    architecture: "x86_64",
    platform_system: "Linux",
    system_ram_mb: 16384,
    cuda_available: false,
    detected_tier_id: "tier_2_consumer_8gb",
  });
  const [hardwareAdaptBusy, setHardwareAdaptBusy] = createSignal(false);
  const [inspectedShardModel, setInspectedShardModel] =
    createSignal<ModelShardInspectionResponse | null>(null);
  const [shardInspectBusyId, setShardInspectBusyId] = createSignal<string | null>(null);
  const [evictionRequest, setEvictionRequest] = createSignal<VramEvictionRequest | null>(null);
  const [isEvictionSubmitting, setIsEvictionSubmitting] = createSignal(false);
  const [gpuSandboxStatus, setGpuSandboxStatus] = createSignal<GpuSandboxStatusResponse | null>(
    null
  );
  const [isProvisioningGpu, setIsProvisioningGpu] = createSignal(false);

  const [modelParamsMap, setModelParamsMap] = createSignal<Record<string, Record<string, any>>>({});
  const [modelInputsMap, setModelInputsMap] = createSignal<Record<string, string>>({});

  const [selectedBinaryFile, setSelectedBinaryFile] = createSignal<File | Blob | null>(null);
  const [selectedBinaryName, setSelectedBinaryName] = createSignal<string>("");
  const [isRecordingMic, setIsRecordingMic] = createSignal(false);

  // --- Lifecycle & Execution State ---
  const [lifecycleBusyId, setLifecycleBusyId] = createSignal<string | null>(null);
  const [executionStatus, setExecutionStatus] = createSignal<ExecutionStatus>("idle");
  const [executionError, setExecutionError] = createSignal<string | null>(null);
  const [lifecycleNotice, setLifecycleNotice] = createSignal<LifecycleNotice | null>(null);
  const [activeJob, setActiveJob] = createSignal<{
    jobId: string;
    status: JobStatus;
    progress: JobProgressInfo;
    startedAt?: number;
    elapsedMs: number;
  } | null>(null);
  const [runs, setRuns] = createSignal<UnifiedSessionRunRecord[]>([]);
  const [activeRunId, setActiveRunId] = createSignal<string | null>(null);
  const [liveStreamOutput, setLiveStreamOutput] = createSignal<any | null>(null);
  const [streamingAudioAnalyser, setStreamingAudioAnalyser] = createSignal<AnalyserNode | null>(null);
  const streamingAudioPlayer = new StreamingAudioPlayer();
  const [showRawJsonInspector, setShowRawJsonInspector] = createSignal(false);

  // --- TTS Zero-Shot & Voices State ---
  const [voices, setVoices] = createSignal<VoicePreset[]>([]);
  const [refAudioPath, setRefAudioPath] = createSignal("");
  const [showZeroShot, setShowZeroShot] = createSignal(false);
  const [streamTelemetry, setStreamTelemetry] = createSignal<StreamTelemetry>({
    ttfaMs: null,
    chunksReceived: 0,
    bytesStreamed: 0,
    payloadSha256: "",
  });

  // --- Pillar 3 & Track 1: Server-Side A/B Arena & Visual DAG Composer State ---
  const [cell4Mode, setCell4Mode] = createSignal<Cell4Mode>("dag");
  const [arenaLeftId, setArenaLeftId] = createSignal<string>("flux-1-schnell");
  const [arenaRightId, setArenaRightId] = createSignal<string>("bria-rmbg-2.0");
  const [arenaRunning, setArenaRunning] = createSignal(false);
  const [arenaResult, setArenaResult] = createSignal<ArenaComparisonResult | null>(null);
  const [serverArenaResult, setServerArenaResult] =
    createSignal<ServerArenaComparisonResponse | null>(null);
  const [arenaVoteWinnerId, setArenaVoteWinnerId] = createSignal<string | null>(null);

  const [dagPresets, setDagPresets] = createSignal<DagPresetBlueprint[]>(FALLBACK_DAG_PRESETS);
  const [selectedDagPresetId, setSelectedDagPresetId] = createSignal<string>(
    "diffusion-rmbg-vlm-tts"
  );
  const [dagInitialInput, setDagInitialInput] = createSignal<string>(
    FALLBACK_DAG_PRESETS[0].default_input
  );
  const [dagNodes, setDagNodes] = createSignal<DagNodeSpec[]>(FALLBACK_DAG_PRESETS[0].nodes);
  const [dagEnableCache, setDagEnableCache] = createSignal<boolean>(true);
  const [dagAddEngineId, setDagAddEngineId] = createSignal<string>("bge-m3-embeddings");
  const [dagRunning, setDagRunning] = createSignal(false);
  const [dagResult, setDagResult] = createSignal<DagExecutionResponse | null>(null);
  const [activeStreamingDagNodeId, setActiveStreamingDagNodeId] = createSignal<string | null>(null);
  const [liveDagStages, setLiveDagStages] = createSignal<DagStageExecutionResult[]>([]);
  const [selectedDagStageIndex, setSelectedDagStageIndex] = createSignal<number | null>(null);

  // --- Track 3: Persistent SQLite WAL Telemetry Store State ---
  const [sqliteLedger, setSqliteLedger] = createSignal<SqliteTelemetryLedgerResponse | null>(null);
  const [exportBusy, setExportBusy] = createSignal(false);

  // --- In-App uv Provisioner, Package Inspector & Live Isolated Task Runner State ---
  const [envId, setEnvId] = createSignal("vision-worker");
  const [packages, setPackages] = createSignal(
    "diffusers, torch, torchvision, pillow, kornia, transformers"
  );
  const [enableGpu, setEnableGpu] = createSignal(true);
  const [uvEnvs, setUvEnvs] = createSignal<
    Array<{
      env_id: string;
      python_executable: string;
      enable_gpu?: boolean;
      cuda_available?: boolean;
      device_name?: string | null;
      torch_version?: string | null;
      created_at?: number;
    }>
  >([]);
  const [selectedInspectEnvId, setSelectedInspectEnvId] = createSignal<string | null>(null);
  const [inspectedPackages, setInspectedPackages] = createSignal<
    Array<{ name: string; version: string }>
  >([]);
  const [inspectLoading, setInspectLoading] = createSignal(false);
  const [pkgSearchQuery, setPkgSearchQuery] = createSignal("");
  const [envLoading, setEnvLoading] = createSignal(false);
  const [envError, setEnvError] = createSignal<string | null>(null);
  const [workerCode, setWorkerCode] = createSignal(DEFAULT_ISOLATED_SCRIPT);
  const [workerRunning, setWorkerRunning] = createSignal(false);
  const [workerOutput, setWorkerOutput] = createSignal<Record<string, unknown> | null>(null);

  // --- Cluster Telemetry State ---
  const [healthData, setHealthData] = createSignal<SystemHealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = createSignal(true);
  const [copied, setCopied] = createSignal(false);
  const [pinnedEngineIds, setPinnedEngineIds] = createSignal<Set<string>>(new Set());

  let abortController: AbortController | null = null;

  // Sync activeEngineId with URL ?engine= search param
  createEffect(() => {
    const rawEngine = searchParams.engine;
    const urlEngine = Array.isArray(rawEngine) ? rawEngine[0] : rawEngine;
    if (urlEngine && catalogModels().some((m) => m.engine_id === urlEngine)) {
      if (activeEngineId() !== urlEngine) {
        setActiveEngineId(urlEngine);
      }
    }
  });

  const handleSelectEngine = (id: string) => {
    setActiveEngineId(id);
    setSearchParams({ engine: id });
  };

  // Sync pinned engines from catalog whenever catalog models refresh
  createEffect(() => {
    const models = catalogModels();
    if (models && models.length > 0) {
      setPinnedEngineIds((prev) => {
        const next = new Set(prev);
        for (const m of models) {
          if (m.weights?.pinned_in_vram || (m as any).pinned) {
            next.add(m.engine_id);
          }
        }
        return next;
      });
    }
  });

  const handleTogglePin = async (engineId: string) => {
    const isCurrentlyPinned = pinnedEngineIds().has(engineId);
    const targetState = !isCurrentlyPinned;

    // Optimistic update
    setPinnedEngineIds((prev) => {
      const next = new Set(prev);
      if (targetState) {
        next.add(engineId);
      } else {
        next.delete(engineId);
      }
      return next;
    });

    try {
      await client.pinModelInVram(engineId, targetState);
    } catch (err) {
      console.error(`Failed to toggle pin for engine '${engineId}':`, err);
      setPinnedEngineIds((prev) => {
        const next = new Set(prev);
        if (isCurrentlyPinned) {
          next.add(engineId);
        } else {
          next.delete(engineId);
        }
        return next;
      });
    }
  };

  const activeManifest = createMemo<ModelCatalogEntry | null>(
    () =>
      catalogModels().find((m) => m.engine_id === activeEngineId()) ??
      catalogModels()[0] ??
      null
  );
  const activeParams = createMemo(() => {
    const m = activeManifest();
    return m ? modelParamsMap()[m.engine_id] ?? {} : {};
  });
  const activeInputText = createMemo(() => {
    const m = activeManifest();
    if (!m) return "";
    const raw = modelInputsMap()[m.engine_id];
    return typeof raw === "string" ? raw : raw != null ? String(raw) : "";
  });
  const activeStudioStyle = createMemo(() =>
    getPipelineStudioStyle(activeManifest()?.pipeline_type ?? "text-to-speech")
  );

  const refreshTelemetryAndCatalog = async () => {
    setHealthLoading(true);
    try {
      const [
        health,
        catalogRes,
        hwRes,
        hubRes,
        dagPresetsRes,
        ledgerRes,
        remoteEnvs,
        sandboxRes,
      ] = await Promise.all([
        client.fetchHealth(),
        client.fetchModelCatalog().catch(() => null),
        client.fetchHardwareProfile().catch(() => null),
        client.discoverHubModels().catch(() => null),
        client.fetchDagPresets().catch(() => null),
        client.fetchTelemetryLedger({ limit: 35 }).catch(() => null),
        client.listUvEnvironments().catch(() => []),
        client
          .getUvEnvironmentStatus(activeManifest()?.recommended_uv_profile || "vision-worker")
          .catch(() => null),
      ]);
      setHealthData(health);
      if (catalogRes && catalogRes.models && catalogRes.models.length > 0) {
        setCatalogModels(catalogRes.models);
        setCatalogStatus("ready");
        setCatalogErrorMsg(null);
        if (!catalogRes.models.some((m) => m.engine_id === activeEngineId())) {
          setActiveEngineId(catalogRes.models[0].engine_id);
        }
        if (catalogRes.weights_summary) {
          setWeightsSummary(catalogRes.weights_summary);
          setVramBudgetInput(catalogRes.weights_summary.max_vram_budget_mb);
        }
        if (catalogRes.hardware_profile) {
          setActiveHardwareProfile(catalogRes.hardware_profile);
        }
        if (
          catalogRes.available_hardware_profiles &&
          catalogRes.available_hardware_profiles.length > 0
        ) {
          setHardwareProfiles(catalogRes.available_hardware_profiles);
        }
        if (catalogRes.host_telemetry) {
          setHostTelemetry(catalogRes.host_telemetry);
        }
        setModelParamsMap((prev) => {
          const next = { ...prev };
          for (const m of catalogRes.models) {
            if (!next[m.engine_id]) {
              next[m.engine_id] = {};
              for (const f of m.parameters_schema ?? []) {
                next[m.engine_id][f.key] = f.default;
              }
            }
          }
          return next;
        });
        setModelInputsMap((prev) => {
          const next = { ...prev };
          for (const m of catalogRes.models) {
            if (next[m.engine_id] === undefined) {
              next[m.engine_id] = m.sample_prompts[0]?.text ?? "";
            }
          }
          return next;
        });
      } else if (catalogModels().length === 0) {
        setCatalogStatus("error");
        setCatalogErrorMsg("Unable to connect to AI Control Plane backend. Please ensure the backend server is running.");
      }
      if (hwRes) {
        setActiveHardwareProfile(hwRes.active_profile);
        setHardwareProfiles(hwRes.available_profiles);
        setHostTelemetry(hwRes.host_telemetry);
      }
      if (hubRes && hubRes.hub_models.length > 0) {
        setHubMarketplaceModels(hubRes.hub_models);
      }
      if (dagPresetsRes && dagPresetsRes.presets.length > 0) {
        setDagPresets(dagPresetsRes.presets);
      }
      if (ledgerRes) {
        setSqliteLedger(ledgerRes);
      }
      if (remoteEnvs) {
        setUvEnvs(remoteEnvs);
        if (!selectedInspectEnvId() && remoteEnvs.length > 0) {
          void handleInspectEnvironment(remoteEnvs[0].env_id);
        }
      }
      if (sandboxRes) {
        setGpuSandboxStatus(sandboxRes);
      }
    } catch (err: any) {
      if (catalogModels().length === 0) {
        setCatalogStatus("error");
        setCatalogErrorMsg(err?.message || "Unable to connect to AI Control Plane backend.");
      }
      setHealthData({
        status: "offline",
        pilot_tts: {
          engine_id: "vieneu-tts-v3-turbo",
          loaded: false,
          streaming_enabled: false,
          sample_rate_hz: 48000,
          cuda_accelerated: false,
          circuit_state: "CLOSED",
        },
        hf_engines: {},
      });
    } finally {
      setHealthLoading(false);
    }
  };

  const voicesCache = new Map<string, VoicePreset[]>();

  createEffect(() => {
    const manifest = activeManifest();
    if (!manifest) return;
    const engineId = manifest.engine_id;

    // 1. Immediately apply declarative preset options from manifest schema
    const voiceField = manifest.parameters_schema?.find((f) => f.key === "voice");
    if (voiceField && voiceField.options && voiceField.options.length > 0) {
      setVoices(
        voiceField.options.map((opt) => ({
          label: opt.label,
          voice_id: opt.value,
        }))
      );
    } else if (manifest.family !== "tts" && manifest.output_modality !== "pcm_audio") {
      setVoices([]);
    }

    // 2. Reuse in-memory cache if voices were already fetched for this engine
    const cached = voicesCache.get(engineId);
    if (cached && cached.length > 0) {
      setVoices(cached);
      return;
    }

    // 3. Fetch dynamically registered & custom voices once per engine
    if (manifest.family === "tts" || manifest.output_modality === "pcm_audio") {
      void client
        .fetchModelVoices(engineId)
        .then((remote) => {
          if (remote && remote.length > 0) {
            voicesCache.set(engineId, remote);
            setVoices(remote);
          }
        })
        .catch(() => {});
    }
  });

  onMount(() => {
    void refreshTelemetryAndCatalog();

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setCommandPaletteOpen(false);
        setHubModalOpen(false);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (executionStatus() === "executing" || executionStatus() === "streaming") return;
        e.preventDefault();
        const manifest = activeManifest();
        if (!manifest) return;
        const isLlmOrVlm =
          manifest.family === "llm" ||
          manifest.pipeline_category === "generative_multimodal" ||
          manifest.pipeline_type === "text-generation" ||
          manifest.pipeline_type === "image-text-to-text" ||
          manifest.engine_id.includes("qwen") ||
          manifest.engine_id.includes("deepseek");
        if (e.shiftKey && manifest.supports_streaming) {
          void handleExecuteStream();
        } else if (isLlmOrVlm) {
          void handleExecuteStream();
        } else {
          void handleExecuteAsyncJob();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    onCleanup(() => window.removeEventListener("keydown", onKeyDown));

    const autoRetryTimer = setInterval(() => {
      if (catalogStatus() === "error" || catalogModels().length === 0) {
        void refreshTelemetryAndCatalog();
      }
    }, 5000);
    onCleanup(() => clearInterval(autoRetryTimer));
  });

  const setActiveInput = (val: string) => {
    const m = activeManifest();
    if (!m) return;
    const stringVal = typeof val === "string" ? val : val != null ? String(val) : "";
    setModelInputsMap((prev) => ({
      ...prev,
      [m.engine_id]: stringVal,
    }));
  };

  const setActiveParam = (key: string, val: any) => {
    const m = activeManifest();
    if (!m) return;
    setModelParamsMap((prev) => ({
      ...prev,
      [m.engine_id]: {
        ...(prev[m.engine_id] ?? {}),
        [key]: val,
      },
    }));
  };

  const cancelActiveExecution = () => {
    streamingAudioPlayer.stop();
    setStreamingAudioAnalyser(null);
    if (abortController) {
      abortController.abort(new DOMException("Cancelled by user", "AbortError"));
      abortController = null;
    }
    const currentJob = activeJob();
    if (currentJob?.jobId) {
      void client.cancelJob(currentJob.jobId).catch(() => {});
      setActiveJob(null);
    }
    setExecutionStatus("idle");
  };

  const handleCancelActiveJob = async () => {
    const currentJob = activeJob();
    if (!currentJob?.jobId) return;
    try {
      await client.cancelJob(currentJob.jobId);
      setActiveJob((prev) => (prev ? { ...prev, status: "cancelled" } : null));
      setLifecycleNotice({
        type: "warning",
        message: `Job ${currentJob.jobId.slice(0, 8)} cancelled by user.`,
      });
      setExecutionStatus("idle");
    } catch (err: any) {
      console.error("Cancel job failed:", err);
    }
  };

  const recordSessionRun = (run: UnifiedSessionRunRecord) => {
    setRuns((prev) => {
      if (prev.length >= 20) {
        for (const evicted of prev.slice(19)) {
          if (evicted.audioUrl) {
            try {
              URL.revokeObjectURL(evicted.audioUrl);
            } catch {
              // ignore revoke error
            }
          }
        }
      }
      return [run, ...prev.slice(0, 19)];
    });
    setActiveRunId(run.id);
    setLiveStreamOutput(null);
  };

  const clearRuns = async () => {
    runs().forEach((r) => {
      if (r.audioUrl) URL.revokeObjectURL(r.audioUrl);
    });
    setRuns([]);
    setActiveRunId(null);
    setLiveStreamOutput(null);
    try {
      await client.clearTelemetryLedger();
      await refreshTelemetryAndCatalog();
    } catch {
      // ignore offline
    }
  };

  // Hardware-Adaptive 5-Tier Profile Switcher & Per-Model Weight Tier Handlers
  const applyLocalHardwareAdaptation = (
    targetProfile: LocalHardwareProfile,
    adaptModels: boolean
  ) => {
    setActiveHardwareProfile(targetProfile);
    setVramBudgetInput(targetProfile.vram_budget_mb);
    setCatalogModels((prev) => {
      const updated = prev.map((m) => {
        const nextTier = adaptModels
          ? targetProfile.recommended_weight_tier
          : ((m.weights?.weight_tier ?? "balanced_fp16") as WeightTierId);
        const nextOffload = adaptModels
          ? targetProfile.default_offload_strategy
          : ((m.weights?.offload_strategy ?? "none") as OffloadStrategy);
        return computeClientModelWeights(m, nextTier, nextOffload, targetProfile);
      });
      const recomputedVram = updated.reduce(
        (acc, m) =>
          acc + (m.loaded ? m.weights?.effective_vram_mb ?? m.vram_mb ?? m.vram_footprint_mb : 0),
        0
      );
      setWeightsSummary((wPrev) =>
        wPrev
          ? {
              ...wPrev,
              allocated_vram_mb: recomputedVram,
              max_vram_budget_mb: targetProfile.vram_budget_mb,
              active_hardware_profile_id: targetProfile.profile_id,
            }
          : null
      );
      return updated;
    });
    if (adaptModels) {
      const recSpec =
        TIER_SPEC_MAP[targetProfile.recommended_weight_tier] ?? TIER_SPEC_MAP.balanced_fp16;
      setModelParamsMap((prev) => {
        const next: Record<string, Record<string, any>> = {};
        for (const [eId, pObj] of Object.entries(prev)) {
          next[eId] = {
            ...pObj,
            weight_tier: targetProfile.recommended_weight_tier,
            precision: recSpec.precision,
            offload_strategy: targetProfile.default_offload_strategy,
            speedup_multiplier: recSpec.speedup,
            quality_retention_pct: recSpec.quality_pct,
          };
        }
        return next;
      });
      setRuns((prev) =>
        prev.map((r) => ({
          ...r,
          parameters: {
            ...r.parameters,
            weight_tier: targetProfile.recommended_weight_tier,
            precision: recSpec.precision,
            offload_strategy: targetProfile.default_offload_strategy,
          },
          output:
            r.output && typeof r.output === "object"
              ? {
                  ...r.output,
                  weight_tier: targetProfile.recommended_weight_tier,
                  precision: recSpec.precision,
                  offload_strategy: targetProfile.default_offload_strategy,
                  speedup_multiplier: recSpec.speedup,
                  quality_retention_pct: recSpec.quality_pct,
                }
              : r.output,
        }))
      );
    }
  };

  const handleSelectHardwareProfile = async (
    profileId: HardwareProfileId,
    autoAdapt: boolean = true
  ) => {
    setHardwareAdaptBusy(true);
    setExecutionError(null);
    const localFound =
      hardwareProfiles().find((p) => p.profile_id === profileId) ??
      FALLBACK_HARDWARE_PROFILES.find((p) => p.profile_id === profileId);
    if (localFound) {
      applyLocalHardwareAdaptation(localFound, autoAdapt);
    }
    try {
      const res = await client.selectHardwareProfile({
        profile_id: profileId,
        auto_adapt_models: autoAdapt,
      });
      setActiveHardwareProfile(res.active_profile);
      setVramBudgetInput(res.active_profile.vram_budget_mb);
      if (res.models && res.models.length > 0) {
        setCatalogModels(res.models);
      }
      if (res.weights_summary) {
        setWeightsSummary(res.weights_summary);
      }
      const shardModel = inspectedShardModel();
      if (shardModel) {
        const refreshed = await client
          .inspectModelWeightsShards(shardModel.engine_id)
          .catch(() => null);
        if (refreshed) setInspectedShardModel(refreshed);
      }
    } catch {
      // Optimistic local hardware adaptation already applied
    } finally {
      setHardwareAdaptBusy(false);
    }
  };

  const handleAutoAdaptAllModels = async () => {
    setHardwareAdaptBusy(true);
    setExecutionError(null);
    applyLocalHardwareAdaptation(activeHardwareProfile(), true);
    try {
      const res = await client.autoAdaptModelsToHardware(activeHardwareProfile().profile_id);
      setActiveHardwareProfile(res.active_profile);
      if (res.models && res.models.length > 0) {
        setCatalogModels(res.models);
      }
      if (res.weights_summary) {
        setWeightsSummary(res.weights_summary);
      }
    } catch {
      // Optimistic local adaptation already applied
    } finally {
      setHardwareAdaptBusy(false);
    }
  };

  const handleSetModelWeightTier = async (
    engineId: string,
    tierId: WeightTierId,
    offloadStrategy?: OffloadStrategy
  ) => {
    setLifecycleBusyId(engineId);
    setExecutionError(null);
    const spec = TIER_SPEC_MAP[tierId] ?? TIER_SPEC_MAP.balanced_fp16;
    let resolvedOffload: OffloadStrategy = offloadStrategy ?? "none";

    setCatalogModels((prev) => {
      const updated = prev.map((m) => {
        if (m.engine_id !== engineId) return m;
        resolvedOffload =
          offloadStrategy ?? ((m.weights?.offload_strategy ?? "none") as OffloadStrategy);
        return computeClientModelWeights(
          m,
          tierId,
          resolvedOffload,
          activeHardwareProfile(),
          m.loaded
        );
      });
      const recomputedVram = updated.reduce(
        (acc, m) =>
          acc + (m.loaded ? m.weights?.effective_vram_mb ?? m.vram_mb ?? m.vram_footprint_mb : 0),
        0
      );
      setWeightsSummary((wPrev) =>
        wPrev ? { ...wPrev, allocated_vram_mb: recomputedVram } : null
      );
      return updated;
    });

    setModelParamsMap((prev) => ({
      ...prev,
      [engineId]: {
        ...(prev[engineId] ?? {}),
        weight_tier: tierId,
        precision: spec.precision,
        offload_strategy: resolvedOffload,
        speedup_multiplier: spec.speedup,
        quality_retention_pct: spec.quality_pct,
      },
    }));

    setRuns((prev) =>
      prev.map((r) => {
        if (r.engineId !== engineId) return r;
        return {
          ...r,
          parameters: {
            ...r.parameters,
            weight_tier: tierId,
            precision: spec.precision,
            offload_strategy: resolvedOffload,
          },
          output:
            r.output && typeof r.output === "object"
              ? {
                  ...r.output,
                  weight_tier: tierId,
                  precision: spec.precision,
                  offload_strategy: resolvedOffload,
                  speedup_multiplier: spec.speedup,
                  quality_retention_pct: spec.quality_pct,
                }
              : r.output,
        };
      })
    );

    try {
      const res = await client.setModelWeightTier(engineId, {
        tier_id: tierId,
        offload_strategy: resolvedOffload,
      });
      if (res && res.model) {
        setCatalogModels((prev) => prev.map((m) => (m.engine_id === engineId ? res.model : m)));
      }
      if (inspectedShardModel()?.engine_id === engineId) {
        const refreshed = await client.inspectModelWeightsShards(engineId).catch(() => null);
        if (refreshed) setInspectedShardModel(refreshed);
      }
    } catch (err: any) {
      const errMsg =
        err?.message || `Failed to update weight tier or offload strategy for '${engineId}'.`;
      setExecutionError(errMsg);
      setCatalogModels((prev) =>
        prev.map((m) =>
          m.engine_id === engineId
            ? {
                ...m,
                last_error: errMsg,
                weights: m.weights ? { ...m.weights, last_error: errMsg } : undefined,
              }
            : m
        )
      );
    } finally {
      setLifecycleBusyId(null);
    }
  };

  const handleInspectModelShards = async (engineId: string) => {
    if (inspectedShardModel()?.engine_id === engineId) {
      setInspectedShardModel(null);
      return;
    }
    setShardInspectBusyId(engineId);
    setExecutionError(null);
    try {
      const inspection = await client.inspectModelWeightsShards(engineId);
      setInspectedShardModel(inspection);
    } catch (err: any) {
      setExecutionError(err?.message || `Failed to inspect shards for '${engineId}'.`);
    } finally {
      setShardInspectBusyId(null);
    }
  };

  const handleProvisionGpuSandbox = async () => {
    setIsProvisioningGpu(true);
    setExecutionError(null);
    const targetProfile = activeManifest()?.recommended_uv_profile || "vision-worker";
    const reqPkgs = activeManifest()?.required_uv_packages;
    const targetPkgs: string[] =
      reqPkgs && reqPkgs.length > 0
        ? reqPkgs
        : ["torch", "torchvision", "torchaudio", "diffusers", "transformers", "accelerate", "safetensors"];
    try {
      await client.provisionUvEnvironment({
        env_id: targetProfile,
        python_version: "3.12",
        packages: targetPkgs,
        enable_gpu: true,
      });
      setLifecycleNotice({
        type: "success",
        message: `GPU Sandbox '${targetProfile}' successfully provisioned with PyTorch CUDA 12.4!`,
      });
      const statusRes = await client.getUvEnvironmentStatus(targetProfile).catch(() => null);
      if (statusRes) setGpuSandboxStatus(statusRes);
      await refreshTelemetryAndCatalog();
    } catch (err: any) {
      setExecutionError(err?.message || `Failed to provision GPU Sandbox '${targetProfile}'.`);
    } finally {
      setIsProvisioningGpu(false);
    }
  };

  const handleOneClickHubInstall = async (payload: {
    engine_id?: string;
    model_id?: string;
    task?: string;
    action: "prefetch_disk" | "load_vram";
    precision?: WeightPrecision;
    execution_target?: string;
  }) => {
    const busyKey = payload.engine_id || payload.model_id || "hub-install";
    setLifecycleBusyId(busyKey);
    setExecutionError(null);
    try {
      const res = await client.installHubModel({
        ...payload,
        weight_tier: activeHardwareProfile().recommended_weight_tier,
      });
      await refreshTelemetryAndCatalog();
      if (payload.action === "load_vram" && res.engine_id) {
        setActiveEngineId(res.engine_id);
      }
    } catch (err: any) {
      if (err?.status === 409 || err?.data?.error_code === "EVICTION_CONFIRMATION_REQUIRED") {
        const engId = payload.engine_id || err?.data?.engine_id || "hub-model";
        const reqVram = err?.data?.required_vram_mb ?? 1280;
        const currVram = err?.data?.current_vram_mb ?? weightsSummary()?.allocated_vram_mb ?? 0;
        const ceiling =
          err?.data?.budget_ceiling_mb ??
          Math.round((weightsSummary()?.max_vram_budget_mb ?? 12282) * 0.85);
        const candidates = (err?.data?.candidates ?? []).map((c: any) => ({
          engine_id: c.engine_id,
          model_id: c.model_id ?? c.engine_id,
          vram_mb: c.vram_mb ?? 0,
          pinned: Boolean(c.pinned),
          idle_seconds: c.idle_seconds ?? 0,
        }));
        setEvictionRequest({
          engineId: engId,
          modelId: payload.model_id,
          requiredVramMb: reqVram,
          currentVramMb: currVram,
          budgetCeilingMb: ceiling,
          candidates,
        });
        return;
      }
      setExecutionError(err?.message || "Failed to install model from Hub Marketplace.");
    } finally {
      setLifecycleBusyId(null);
    }
  };

  const handleBatchWeightsAction = async (
    action: "prefetch_category" | "evict_unpinned" | "auto_adapt_hardware",
    pipelineCategory?: string
  ) => {
    setLifecycleBusyId(`batch-${action}`);
    setExecutionError(null);
    try {
      await client.batchWeightsAction({
        action,
        pipeline_category: pipelineCategory,
        hardware_profile_id: activeHardwareProfile().profile_id,
      });
      await refreshTelemetryAndCatalog();
    } catch (err: any) {
      setExecutionError(err?.message || `Batch action '${action}' failed.`);
    } finally {
      setLifecycleBusyId(null);
    }
  };

  const handleLoadOrBindModel = async (
    engineId: string,
    executionTarget: string,
    forceEvict = false
  ) => {
    setLifecycleBusyId(engineId);
    setExecutionError(null);
    const targetModel = catalogModels().find((m) => m.engine_id === engineId);
    const targetOffload = (targetModel?.weights?.offload_strategy ?? "none") as OffloadStrategy;
    const targetTier = (targetModel?.weights?.weight_tier ?? "balanced_fp16") as WeightTierId;

    try {
      const res = await client.loadCatalogModel({
        engine_id: engineId,
        execution_target: executionTarget,
        weight_tier: targetTier,
        offload_strategy: targetOffload,
        force_evict: forceEvict,
      });
      if (res && res.model) {
        setCatalogModels((prev) =>
          prev.map((m) => (m.engine_id === engineId ? (res.model as ModelCatalogEntry) : m))
        );
        setActiveEngineId(engineId);
        const isCpu =
          res.model.weights?.offload_strategy === "cpu_ram_offload" || res.model.device === "cpu";
        const isHybrid = res.model.weights?.offload_strategy === "hybrid_kv_offload";
        const residencyMsg = isCpu
          ? `[Mount Host RAM] Successfully mounted '${res.model.display_name}' into Host System RAM (${res.model.ram_mb} MB RAM • 0 MB VRAM). Model is ready for CPU inference.`
          : isHybrid
          ? `[Mount Hybrid] Successfully mounted '${res.model.display_name}' in Hybrid Mode (${res.model.vram_mb} MB VRAM • ${res.model.ram_mb} MB System RAM).`
          : `[Mount VRAM] Successfully mounted '${res.model.display_name}' into Dedicated GPU VRAM (${res.model.vram_mb} MB VRAM on RTX 4070 Ti).`;

        setLifecycleNotice({
          type: "success",
          message: residencyMsg,
        });
      }
      if (res && res.weights_summary) {
        setWeightsSummary(res.weights_summary);
      }
      await refreshTelemetryAndCatalog();
      const targetEnv =
        targetModel?.recommended_uv_profile || activeManifest()?.recommended_uv_profile || "vision-worker";
      client.getUvEnvironmentStatus(targetEnv).then(setGpuSandboxStatus).catch(() => null);
    } catch (err: any) {
      if (err?.status === 409 || err?.data?.error_code === "EVICTION_CONFIRMATION_REQUIRED") {
        const reqVram =
          err?.data?.required_vram_mb ?? targetModel?.weights?.effective_vram_mb ?? 1280;
        const currVram = err?.data?.current_vram_mb ?? weightsSummary()?.allocated_vram_mb ?? 0;
        const ceiling =
          err?.data?.budget_ceiling_mb ??
          Math.round((weightsSummary()?.max_vram_budget_mb ?? 12282) * 0.85);
        const candidates = (err?.data?.candidates ?? []).map((c: any) => ({
          engine_id: c.engine_id,
          model_id: c.model_id ?? c.engine_id,
          vram_mb: c.vram_mb ?? 0,
          pinned: Boolean(c.pinned),
          idle_seconds: c.idle_seconds ?? 0,
        }));
        setEvictionRequest({
          engineId,
          modelId: targetModel?.model_id,
          requiredVramMb: reqVram,
          currentVramMb: currVram,
          budgetCeilingMb: ceiling,
          candidates,
        });
        return;
      }
      const errorMsg = err?.message || `Failed to load model '${engineId}'.`;
      setExecutionError(errorMsg);
      setCatalogModels((prev) =>
        prev.map((m) =>
          m.engine_id === engineId
            ? {
                ...m,
                loaded: false,
                status: "unloaded",
                last_error: errorMsg,
                weights: m.weights
                  ? { ...m.weights, lifecycle_state: "CACHED_ON_DISK", last_error: errorMsg }
                  : undefined,
              }
            : m
        )
      );
      await refreshTelemetryAndCatalog();
    } finally {
      setLifecycleBusyId(null);
    }
  };

  const handleConfirmEvictAndMount = async (engineId: string) => {
    setIsEvictionSubmitting(true);
    try {
      const targetModel = catalogModels().find((m) => m.engine_id === engineId);
      const recEnv = targetModel?.recommended_uv_profile || "vision-worker";
      await handleLoadOrBindModel(engineId, `uv-sandbox:${recEnv}`, true);
      setEvictionRequest(null);
    } finally {
      setIsEvictionSubmitting(false);
    }
  };

  const handleFallbackToHostRam = async (engineId: string) => {
    setIsEvictionSubmitting(true);
    try {
      const targetModel = catalogModels().find((m) => m.engine_id === engineId);
      const targetTier = (targetModel?.weights?.weight_tier ?? "balanced_fp16") as WeightTierId;
      await handleSetModelWeightTier(engineId, targetTier, "cpu_ram_offload");
      await handleLoadOrBindModel(engineId, "host-venv", false);
      setEvictionRequest(null);
    } finally {
      setIsEvictionSubmitting(false);
    }
  };

  const handlePrefetchWeights = async (engineId: string) => {
    setLifecycleBusyId(engineId);
    setExecutionError(null);
    setCatalogModels((prev) =>
      prev.map((m) => {
        if (m.engine_id !== engineId) return m;
        const expDisk = m.weights?.expected_disk_mb ?? m.expected_disk_mb ?? 800;
        const shCount = m.weights?.shard_count ?? m.shard_count ?? 2;
        return {
          ...m,
          weights: m.weights
            ? {
                ...m.weights,
                lifecycle_state: m.loaded ? "ACTIVE_VRAM" : "CACHED_ON_DISK",
                is_cached_on_disk: true,
                disk_size_mb: expDisk,
                verified_shards: shCount,
              }
            : ({
                engine_id: m.engine_id,
                model_id: m.model_id,
                pipeline_category: m.pipeline_category,
                pipeline_type: m.pipeline_type,
                revision: m.revision ?? "main",
                weight_format: m.weight_format ?? "safetensors",
                lifecycle_state: m.loaded ? "ACTIVE_VRAM" : "CACHED_ON_DISK",
                is_cached_on_disk: true,
                disk_size_mb: expDisk,
                expected_disk_mb: expDisk,
                shard_count: shCount,
                verified_shards: shCount,
                pinned_in_vram: false,
              } as any),
        };
      })
    );
    try {
      const res = await client.prefetchModelWeights(engineId);
      if (res && res.model) {
        setCatalogModels((prev) =>
          prev.map((m) => (m.engine_id === engineId ? (res.model as ModelCatalogEntry) : m))
        );
        setLifecycleNotice({
          type: "success",
          message: `[Prefetch Disk] Downloaded & verified '${res.model.display_name}' shards to disk cache (${res.weights?.disk_size_mb ?? res.model.expected_disk_mb} MB). You can now click 'Load VRAM' without downloading!`,
        });
      }
      if (res && res.weights_summary) {
        setWeightsSummary(res.weights_summary);
      }
      await refreshTelemetryAndCatalog();
    } catch (err: any) {
      setExecutionError(err?.message || `Prefetch failed for model '${engineId}'.`);
      await refreshTelemetryAndCatalog();
    } finally {
      setLifecycleBusyId(null);
    }
  };

  const handleQuantizeWeights = async (engineId: string, precision: WeightPrecision) => {
    const precisionToTier: Record<WeightPrecision, WeightTierId> = {
      int4: "nano_int4",
      int8: "compact_int8",
      fp16: "balanced_fp16",
      bf16: "studio_bf16",
      fp32: "ultra_fp32",
    };
    await handleSetModelWeightTier(engineId, precisionToTier[precision] ?? "balanced_fp16");
  };

  const handleTogglePinModel = async (engineId: string, pinned: boolean) => {
    setLifecycleBusyId(engineId);
    setExecutionError(null);
    setCatalogModels((prev) =>
      prev.map((m) =>
        m.engine_id === engineId && m.weights
          ? { ...m, weights: { ...m.weights, pinned_in_vram: pinned } }
          : m
      )
    );
    try {
      await client.pinModelInVram(engineId, pinned);
    } catch {
      // Optimistic pin state already applied
    } finally {
      setLifecycleBusyId(null);
    }
  };

  const handlePurgeDiskCache = async (engineId: string) => {
    setLifecycleBusyId(engineId);
    setExecutionError(null);
    setCatalogModels((prev) =>
      prev.map((m) =>
        m.engine_id === engineId
          ? {
              ...m,
              loaded: false,
              status: "unloaded",
              vram_mb: 0,
              ram_mb: 0,
              weights: m.weights
                ? {
                    ...m.weights,
                    lifecycle_state: "REGISTERED",
                    is_cached_on_disk: false,
                    disk_size_mb: 0,
                    verified_shards: 0,
                  }
                : undefined,
            }
          : m
      )
    );
    try {
      await client.purgeModelWeightsCache(engineId);
      setLifecycleNotice({
        type: "info",
        message: `[Purge Cache] Local disk cache purged for '${engineId}'. Shards deleted from disk.`,
      });
      await refreshTelemetryAndCatalog();
    } catch (err: any) {
      setExecutionError(err?.message || `Purge failed for model '${engineId}'.`);
      await refreshTelemetryAndCatalog();
    } finally {
      setLifecycleBusyId(null);
    }
  };

  const handleUpdateVramBudget = async (newBudgetMb: number) => {
    setVramBudgetInput(newBudgetMb);
    setWeightsSummary((prev) => (prev ? { ...prev, max_vram_budget_mb: newBudgetMb } : null));
    try {
      await client.configureVramBudget(newBudgetMb);
    } catch {
      // Optimistic budget update already applied
    }
  };

  const handleWarmupModel = async (engineId: string) => {
    setLifecycleBusyId(engineId);
    setExecutionError(null);
    try {
      const res = await client.warmupModel(engineId);
      if (res && res.model) {
        setCatalogModels((prev) =>
          prev.map((m) => (m.engine_id === engineId ? (res.model as ModelCatalogEntry) : m))
        );
        setActiveEngineId(engineId);
        setLifecycleNotice({
          type: "success",
          message: `[Warmup Calibration] '${res.model.display_name}' completed synthetic warmup pass in ${res.warmup_latency_ms} ms! Kernels JIT-compiled for fast inference.`,
        });
      }
      if (res && res.weights_summary) {
        setWeightsSummary(res.weights_summary);
      }
      await refreshTelemetryAndCatalog();
    } catch (err: any) {
      setExecutionError(err?.message || `Warmup calibration failed for model '${engineId}'.`);
    } finally {
      setLifecycleBusyId(null);
    }
  };

  const handleUnloadEvictModel = async (engineId: string) => {
    setLifecycleBusyId(engineId);
    setExecutionError(null);
    setCatalogModels((prev) =>
      prev.map((m) => {
        if (m.engine_id !== engineId) return m;
        const tierId = (m.weights?.weight_tier ?? "balanced_fp16") as WeightTierId;
        const offload = (m.weights?.offload_strategy ?? "none") as OffloadStrategy;
        const updated = computeClientModelWeights(
          m,
          tierId,
          offload,
          activeHardwareProfile(),
          false
        );
        return {
          ...updated,
          weights: updated.weights
            ? { ...updated.weights, lifecycle_state: "EVICTED_TO_DISK" }
            : undefined,
        };
      })
    );
    try {
      await client.unloadModel(engineId);
      setLifecycleNotice({
        type: "warning",
        message: `[Evict VRAM] Soft-evicted '${engineId}' from GPU VRAM to disk cache. VRAM freed.`,
      });
      await refreshTelemetryAndCatalog();
    } catch (err: any) {
      setExecutionError(err?.message || `Eviction failed for model '${engineId}'.`);
      await refreshTelemetryAndCatalog();
    } finally {
      setLifecycleBusyId(null);
    }
  };

  const resetActiveModelDefaults = () => {
    const manifest = activeManifest();
    if (!manifest) return;
    const defParams: Record<string, any> = {};
    for (const f of manifest.parameters_schema ?? []) {
      defParams[f.key] = f.default;
    }
    setModelParamsMap((prev) => ({
      ...prev,
      [manifest.engine_id]: defParams,
    }));
    setModelInputsMap((prev) => ({
      ...prev,
      [manifest.engine_id]: manifest.sample_prompts?.[0]?.text ?? "",
    }));
  };

  // Batched Execution
  const handleExecuteBatched = async () => {
    cancelActiveExecution();
    const controller = new AbortController();
    abortController = controller;

    setExecutionStatus("executing");
    setExecutionError(null);
    setLiveStreamOutput(null);

    const manifest = activeManifest();
    if (!manifest) {
      setExecutionStatus("idle");
      setExecutionError("No active model selected or catalog is still loading.");
      return;
    }
    const activeTierSpec = manifest.weights;
    const tierId = (activeTierSpec?.weight_tier ?? "balanced_fp16") as WeightTierId;
    const precision = (activeTierSpec?.precision ??
      manifest.default_precision ??
      "fp16") as WeightPrecision;
    const offloadStrategy = (activeTierSpec?.offload_strategy ?? "none") as OffloadStrategy;
    const speedup = Number(activeTierSpec?.hardware_compatibility?.speedup_multiplier ?? 1.0);
    const qualityPct = Number(
      activeTierSpec?.hardware_compatibility?.quality_retention_pct ?? 100.0
    );

    const params: Record<string, any> = {
      ...activeParams(),
      weight_tier: tierId,
      precision,
      offload_strategy: offloadStrategy,
      speedup_multiplier: speedup,
      quality_retention_pct: qualityPct,
    };
    if (manifest.family === "tts" && showZeroShot() && refAudioPath().trim()) {
      params.ref_audio_path = refAudioPath().trim();
    }

    try {
      const currentInput = activeInputText();
      const inputsPayload =
        manifest.family === "embeddings"
          ? currentInput.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
          : currentInput;

      const res = await client.inferModel(
        manifest.engine_id,
        {
          inputs: inputsPayload,
          parameters: params,
          slots: {
            prompt: currentInput,
            text: currentInput,
          },
          file:
            manifest.input_modality === "audio" ||
            manifest.input_modality === "image" ||
            manifest.input_modality === "multimodal"
              ? selectedBinaryFile()
              : null,
          filename: selectedBinaryName() || undefined,
          auto_load: true,
        },
        { signal: controller.signal }
      );

      let audioUrl: string | undefined;
      if (res.wavBuffer) {
        const blob = new Blob([res.wavBuffer], { type: "audio/wav" });
        audioUrl = URL.createObjectURL(blob);
      } else if (res.audioUrl) {
        audioUrl = res.audioUrl;
      } else if (res.output?.audio_data_uri) {
        audioUrl = res.output.audio_data_uri;
      } else if (res.output?.audio_wav_base64) {
        audioUrl = `data:audio/wav;base64,${res.output.audio_wav_base64}`;
      } else if (res.output?.audio_base64) {
        audioUrl = `data:audio/wav;base64,${res.output.audio_base64}`;
      }

      recordSessionRun({
        id: safeRandomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        engineId: manifest.engine_id,
        displayName: manifest.display_name,
        family: manifest.family,
        pipelineType: res.pipelineType ?? manifest.pipeline_type,
        modality: res.modality,
        inputSnippet: currentInput.slice(0, 72) || selectedBinaryName() || "Binary Input",
        rawInput: currentInput,
        parameters: params,
        output: res.output,
        audioUrl,
        voice: String(params.voice ?? (manifest.engine_id.includes("kokoro") ? "af_bella" : "Hải Đăng")),
        durationSeconds: res.durationSeconds,
        executionTarget: res.executionTarget,
        roundtripMs: res.roundtripMs,
        requestId: res.requestId,
        payloadSha256: res.payloadSha256,
      });

      setExecutionStatus("idle");
      void refreshTelemetryAndCatalog();
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setExecutionStatus("idle");
        return;
      }
      setExecutionStatus("idle");
      setExecutionError(err?.message || "Local inference execution failed.");
    }
  };

  // Streaming Execution
  const handleExecuteStream = async (customInput?: string) => {
    cancelActiveExecution();
    const controller = new AbortController();
    abortController = controller;

    setExecutionStatus("streaming");
    setExecutionError(null);

    const manifest = activeManifest();
    if (!manifest) {
      setExecutionStatus("idle");
      setExecutionError("No active model selected or catalog is still loading.");
      return;
    }
    const currentInputText = activeInputText();
    const inputText =
      typeof customInput === "string"
        ? customInput
        : typeof currentInputText === "string"
        ? currentInputText
        : String(currentInputText || "");

    if (typeof customInput === "string") {
      setModelInputsMap((prev) => ({
        ...prev,
        [manifest.engine_id]: customInput,
      }));
    }

    const activeTierSpec = manifest.weights;
    const tierId = (activeTierSpec?.weight_tier ?? "balanced_fp16") as WeightTierId;
    const precision = (activeTierSpec?.precision ??
      manifest.default_precision ??
      "fp16") as WeightPrecision;
    const offloadStrategy = (activeTierSpec?.offload_strategy ?? "none") as OffloadStrategy;
    const speedup = Number(activeTierSpec?.hardware_compatibility?.speedup_multiplier ?? 1.0);
    const qualityPct = Number(
      activeTierSpec?.hardware_compatibility?.quality_retention_pct ?? 100.0
    );

    const params: Record<string, any> = {
      ...activeParams(),
      weight_tier: tierId,
      precision,
      offload_strategy: offloadStrategy,
      speedup_multiplier: speedup,
      quality_retention_pct: qualityPct,
    };
    const payloadHash = await sha256DigestHex(
      JSON.stringify({ engine: manifest.engine_id, inputs: inputText, params })
    );

    if (manifest.family === "tts") {
      setStreamTelemetry({
        ttfaMs: null,
        chunksReceived: 0,
        bytesStreamed: 0,
        payloadSha256: payloadHash,
      });

      try {
        const t0 = performance.now();
        const chunks: BlobPart[] = [];
        let totalBytes = 0;
        let chunkCount = 0;
        let firstChunkMs: number | null = null;

        const targetVoice = String(params.voice ?? (manifest.engine_id.includes("kokoro") ? "af_bella" : "Hải Đăng"));
        const sampleRate = manifest.engine_id.includes("kokoro") ? 24000 : 48000;

        streamingAudioPlayer.startStream(undefined, sampleRate);
        setStreamingAudioAnalyser(streamingAudioPlayer.analyserNode);

        for await (const chunk of client.streamSpeech(
          {
            engine_id: manifest.engine_id,
            text: inputText,
            voice: targetVoice,
            speed: Number(params.speed ?? 1.0),
            pitch: Number(params.pitch ?? 0),
            gain_db: Number(params.gain_db ?? 0),
          },
          { signal: controller.signal }
        )) {
          if (firstChunkMs === null) {
            firstChunkMs = Math.round(performance.now() - t0);
          }
          chunkCount += 1;
          totalBytes += chunk.byteLength;
          chunks.push(new Uint8Array(chunk));

          await streamingAudioPlayer.feedChunk(new Uint8Array(chunk));

          setStreamTelemetry({
            ttfaMs: firstChunkMs,
            chunksReceived: chunkCount,
            bytesStreamed: totalBytes,
            payloadSha256: payloadHash,
          });
        }

        await streamingAudioPlayer.finishStream();

        const roundtripMs = Math.round((performance.now() - t0) * 10) / 10;
        const blob = new Blob(chunks, { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        const durSec = Math.round((Math.max(0, totalBytes - 44) / (sampleRate * 2)) * 100) / 100;

        recordSessionRun({
          id: safeRandomUUID(),
          timestamp: new Date().toLocaleTimeString(),
          engineId: manifest.engine_id,
          displayName: manifest.display_name,
          family: "tts",
          pipelineType: "text-to-speech",
          modality: "pcm_audio",
          inputSnippet: inputText.slice(0, 72),
          rawInput: inputText,
          parameters: params,
          output: {
            modality: "pcm_audio",
            sample_rate: sampleRate,
            duration_seconds: durSec,
            weight_tier: tierId,
            precision,
            speedup_multiplier: speedup,
            backend_used: manifest.execution_target || "onnx-cpu-streaming",
          },
          audioUrl: url,
          voice: targetVoice,
          durationSeconds: durSec,
          executionTarget: manifest.execution_target,
          roundtripMs,
          requestId: safeRandomUUID(),
          payloadSha256: payloadHash,
        });

        setExecutionStatus("idle");
      } catch (err: any) {
        if (err?.name === "AbortError") {
          setExecutionStatus("idle");
          return;
        }
        setExecutionStatus("idle");
        setExecutionError(err?.message || "TTS streaming execution failed.");
        return;
      }
      return;
    }

    try {
      const t0 = performance.now();
      const stream = await client.streamModelNdjson(
        manifest.engine_id,
        { inputs: inputText, parameters: params, auto_load: true },
        { signal: controller.signal }
      );
      const reader = stream.getReader();

      let accReasoning = "";
      let accContent = "";
      const accProbs: Array<{ token: string; probability: number }> = [];
      const accSegments: any[] = [];
      const accDiffSteps: any[] = [];
      let finalOutput: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        if (value.type === "diffusion_step" && value.diffusion_step) {
          accDiffSteps.push(value.diffusion_step);
          setLiveStreamOutput({
            modality: "generated_image",
            prompt: inputText,
            seed: params.seed ?? 42,
            guidance_scale: params.guidance_scale ?? 3.5,
            num_inference_steps: value.diffusion_step.total_steps,
            image_data_uri: value.diffusion_step.preview_data_uri,
            latent_steps: [...accDiffSteps],
          });
        } else if (value.type === "reasoning_token" && value.token) {
          accReasoning += value.token;
          setLiveStreamOutput({
            modality: "token_stream",
            reasoning_trace: accReasoning,
            answer_markdown: accContent,
            tokens_generated: value.token_index ?? 0,
            ttft_ms: value.ttft_ms ?? 0,
            tokens_per_sec: value.tokens_per_sec ?? 0,
            token_probabilities: accProbs,
          });
        } else if (value.type === "content_token" && value.token) {
          accContent += value.token;
          accProbs.push({ token: value.token, probability: value.probability ?? 0.9 });
          setLiveStreamOutput({
            modality: "token_stream",
            reasoning_trace: accReasoning,
            answer_markdown: accContent,
            tokens_generated: value.token_index ?? accProbs.length,
            ttft_ms: value.ttft_ms ?? 0,
            tokens_per_sec: value.tokens_per_sec ?? 0,
            token_probabilities: [...accProbs],
          });
        } else if (value.type === "asr_segment" && value.segment) {
          accSegments.push(value.segment);
          setLiveStreamOutput({
            modality: "timestamped_transcript",
            text: accSegments.map((s) => s.text).join(" "),
            language: params.language ?? "vi",
            segments: [...accSegments],
          });
        } else if (value.type === "done") {
          finalOutput = value.output;
        }
      }

      const roundtripMs = Math.round((performance.now() - t0) * 10) / 10;
      recordSessionRun({
        id: safeRandomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        engineId: manifest.engine_id,
        displayName: manifest.display_name,
        family: manifest.family,
        pipelineType: manifest.pipeline_type,
        modality: manifest.output_modality,
        inputSnippet: inputText.slice(0, 72),
        rawInput: inputText,
        parameters: params,
        output:
          finalOutput ?? {
            modality: manifest.output_modality,
            reasoning_trace: accReasoning,
            answer_markdown: accContent,
            token_probabilities: accProbs,
            segments: accSegments,
            latent_steps: accDiffSteps,
          },
        executionTarget: manifest.execution_target,
        roundtripMs,
        requestId: safeRandomUUID(),
        payloadSha256: payloadHash,
      });

      setExecutionStatus("idle");
      void refreshTelemetryAndCatalog();
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setExecutionStatus("idle");
        return;
      }
      setExecutionStatus("idle");
      setExecutionError(err?.message || "Model streaming execution failed.");
    }
  };

  // Async Background Job
  const handleExecuteAsyncJob = async (customInput?: string) => {
    cancelActiveExecution();
    const controller = new AbortController();
    abortController = controller;

    setExecutionStatus("executing");
    setExecutionError(null);
    setLiveStreamOutput(null);

    const manifest = activeManifest();
    if (!manifest) {
      setExecutionStatus("idle");
      setExecutionError("No active model selected or catalog is still loading.");
      return;
    }
    const currentInputText = activeInputText();
    const inputText =
      typeof customInput === "string"
        ? customInput
        : typeof currentInputText === "string"
        ? currentInputText
        : String(currentInputText || "");

    if (typeof customInput === "string") {
      setModelInputsMap((prev) => ({
        ...prev,
        [manifest.engine_id]: customInput,
      }));
    }

    const activeTierSpec = manifest.weights;
    const tierId = (activeTierSpec?.weight_tier ?? "balanced_fp16") as WeightTierId;
    const precision = (activeTierSpec?.precision ??
      manifest.default_precision ??
      "fp16") as WeightPrecision;
    const offloadStrategy = (activeTierSpec?.offload_strategy ?? "none") as OffloadStrategy;
    const speedup = Number(activeTierSpec?.hardware_compatibility?.speedup_multiplier ?? 1.0);
    const qualityPct = Number(
      activeTierSpec?.hardware_compatibility?.quality_retention_pct ?? 100.0
    );

    const params: Record<string, any> = {
      ...activeParams(),
      weight_tier: tierId,
      precision,
      offload_strategy: offloadStrategy,
      speedup_multiplier: speedup,
      quality_retention_pct: qualityPct,
    };

    const t0 = performance.now();
    const payloadHash = await sha256DigestHex(
      JSON.stringify({ engine: manifest.engine_id, inputs: inputText, params })
    );

    try {
      const finalJob = await client.executeJobAndWait(
        {
          engine_id: manifest.engine_id,
          inputs: inputText,
          parameters: params,
        },
        (ev) => {
          const elapsed = Math.round(performance.now() - t0);
          const data = (ev.data || {}) as Record<string, any>;
          const currentStatus: JobStatus =
            (data.status as JobStatus) ||
            (ev.event === "progress" ? "running" : (ev.event as JobStatus)) ||
            "running";
          const p = (data.progress || {}) as Record<string, any>;
          const progressInfo: JobProgressInfo = {
            step: Number(p.step ?? data.step ?? 0),
            total_steps: Number(p.total_steps ?? data.total_steps ?? 100),
            percent: Number(p.percent ?? p.progress_pct ?? data.percent ?? data.progress_pct ?? 0),
            stage: String(p.stage ?? data.stage ?? ev.event),
          };
          setActiveJob({
            jobId: String(data.job_id || ev.id || "pending"),
            status: currentStatus,
            progress: progressInfo,
            startedAt: t0,
            elapsedMs: elapsed,
          });
        },
        controller.signal
      );

      const roundtripMs = Math.round((performance.now() - t0) * 10) / 10;
      setActiveJob(null);
      setExecutionStatus("idle");

      if (finalJob.status === "completed" && finalJob.result) {
        const out = finalJob.result as Record<string, any>;
        const innerOut =
          out.output && typeof out.output === "object" && !Array.isArray(out.output)
            ? out.output
            : {};
        const normalizedOutput = { ...innerOut, ...out };

        let audioUrl: string | undefined = undefined;
        const b64 =
          normalizedOutput.audio_wav_base64 ||
          normalizedOutput.audio_base64 ||
          out.audio_wav_base64 ||
          out.audio_base64;
        if (b64 && typeof b64 === "string") {
          const cleanB64 = b64.includes("base64,") ? b64.split("base64,")[1] : b64;
          const bin = atob(cleanB64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          audioUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
        }

        const asyncJobVoice = String(params.voice ?? (manifest.engine_id.includes("kokoro") ? "af_bella" : "Hải Đăng"));
        const asyncJobDur = Number(normalizedOutput.duration_seconds || (manifest.engine_id.includes("kokoro") ? 2.5 : 2.5));
        recordSessionRun({
          id: finalJob.job_id,
          timestamp: new Date().toLocaleTimeString(),
          engineId: manifest.engine_id,
          displayName: manifest.display_name,
          family: manifest.family,
          pipelineType: manifest.pipeline_type,
          modality: manifest.output_modality,
          inputSnippet: inputText.slice(0, 72),
          rawInput: inputText,
          parameters: params,
          output: normalizedOutput,
          audioUrl,
          voice: asyncJobVoice,
          durationSeconds: asyncJobDur,
          executionTarget: manifest.execution_target,
          roundtripMs,
          requestId: finalJob.job_id,
          payloadSha256: payloadHash,
        });

        setExecutionStatus("idle");
        setLifecycleNotice({
          type: "success",
          message: `Job ${finalJob.job_id.slice(0, 8)} completed via SSE push in ${roundtripMs}ms!`,
        });
        void refreshTelemetryAndCatalog();
      } else if (finalJob.status === "cancelled") {
        setActiveJob(null);
        setExecutionStatus("idle");
        setLifecycleNotice({
          type: "warning",
          message: `Job ${finalJob.job_id.slice(0, 8)} was cancelled.`,
        });
      } else if (finalJob.status === "failed") {
        setActiveJob(null);
        setExecutionStatus("idle");
        setExecutionError(finalJob.error?.message || "Async background job failed.");
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        setActiveJob(null);
        setExecutionStatus("idle");
        return;
      }
      setActiveJob(null);
      setExecutionStatus("idle");
      setExecutionError(err?.message || "Async background job failed.");
    } finally {
      setActiveJob(null);
      setExecutionStatus("idle");
    }
  };

  // Arena Benchmark
  const handleRunArenaComparison = async () => {
    setCell4Mode("arena");
    setArenaRunning(true);
    setArenaVoteWinnerId(null);
    setExecutionError(null);
    try {
      const serverBench = await client.compareModelsInArena({
        left_engine_id: arenaLeftId(),
        right_engine_id: arenaRightId(),
        inputs: activeInputText(),
        left_parameters: modelParamsMap()[arenaLeftId()] ?? {},
        right_parameters: modelParamsMap()[arenaRightId()] ?? {},
      });

      const decodeB64Wav = (b64?: string | null) => {
        if (!b64) return undefined;
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
      };
      if (serverArenaResult()?.left?.audioUrl) URL.revokeObjectURL(serverArenaResult()!.left.audioUrl!);
      if (serverArenaResult()?.right?.audioUrl) URL.revokeObjectURL(serverArenaResult()!.right.audioUrl!);
      if (arenaResult()?.left?.audioUrl) URL.revokeObjectURL(arenaResult()!.left.audioUrl!);
      if (arenaResult()?.right?.audioUrl) URL.revokeObjectURL(arenaResult()!.right.audioUrl!);

      serverBench.left.audioUrl = decodeB64Wav(serverBench.left.audio_wav_base64);
      serverBench.right.audioUrl = decodeB64Wav(serverBench.right.audio_wav_base64);

      setServerArenaResult(serverBench);
      setArenaResult(null);
      void refreshTelemetryAndCatalog();
    } catch {
      try {
        const comparison = await client.runArenaComparison(arenaLeftId(), arenaRightId(), {
          inputs: activeInputText(),
          parameters: activeParams(),
          auto_load: true,
        });
        if (comparison.left.wavBuffer) {
          comparison.left.audioUrl = URL.createObjectURL(
            new Blob([comparison.left.wavBuffer], { type: "audio/wav" })
          );
        }
        if (comparison.right.wavBuffer) {
          comparison.right.audioUrl = URL.createObjectURL(
            new Blob([comparison.right.wavBuffer], { type: "audio/wav" })
          );
        }
        setArenaResult(comparison);
      } catch (fallbackErr: any) {
        setExecutionError(fallbackErr?.message || "A/B Arena execution failed.");
      }
    } finally {
      setArenaRunning(false);
    }
  };

  const handleVoteArenaWinner = async (preferredEngineId: string) => {
    const res = serverArenaResult();
    if (!res?.comparison_id) return;
    setArenaVoteWinnerId(preferredEngineId);
    try {
      await client.voteArenaWinner(res.comparison_id, preferredEngineId);
      void refreshTelemetryAndCatalog();
    } catch {
      // ignore offline
    }
  };

  // Visual DAG Composer
  const handleSelectDagPreset = (presetId: string) => {
    setSelectedDagPresetId(presetId);
    const found = dagPresets().find((p) => p.preset_id === presetId);
    if (found) {
      setDagInitialInput(found.default_input);
      setDagNodes(found.nodes);
      setSelectedDagStageIndex(null);
    }
  };

  const handleAddNodeToDag = () => {
    const model = catalogModels().find((m) => m.engine_id === dagAddEngineId());
    if (!model) return;
    const defaultParams: Record<string, any> = {};
    for (const f of model.parameters_schema ?? []) {
      defaultParams[f.key] = f.default;
    }
    setDagNodes((prev) => [
      ...prev,
      {
        node_id: `stage_${prev.length + 1}_${model.engine_id}_${Date.now() % 1000}`,
        engine_id: model.engine_id,
        label: `${prev.length + 1}. ${model.display_name.split(" (")[0]} (${model.pipeline_type})`,
        parameters: defaultParams,
      },
    ]);
    setSelectedDagPresetId("custom");
  };

  const handleRemoveDagNode = (index: number) => {
    if (dagNodes().length <= 1) return;
    setDagNodes((prev) => prev.filter((_, idx) => idx !== index));
    setSelectedDagPresetId("custom");
  };

  const handleMoveDagNode = (index: number, direction: -1 | 1) => {
    setDagNodes((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });
    setSelectedDagPresetId("custom");
  };

  const handleUpdateDagNodeParam = (index: number, paramKey: string, val: any) => {
    setDagNodes((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = {
          ...next[index],
          parameters: {
            ...next[index].parameters,
            [paramKey]: val,
          },
        };
      }
      return next;
    });
    setSelectedDagPresetId("custom");
  };

  const handleExecuteVisualDag = async () => {
    setCell4Mode("dag");
    setDagRunning(true);
    setActiveStreamingDagNodeId(null);
    setLiveDagStages([]);
    setExecutionError(null);

    try {
      const res = await client.executeDagPipeline({
        preset_id: selectedDagPresetId(),
        initial_input: dagInitialInput(),
        nodes: dagNodes(),
        enable_cache: dagEnableCache(),
      });
      setDagResult(res);
      setSelectedDagStageIndex(res.stages.length - 1);

      let audioUrl: string | undefined;
      if (res.final_audio_wav_base64) {
        const binaryString = atob(res.final_audio_wav_base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        audioUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
      }

      const lastStage = res.stages[res.stages.length - 1];
      recordSessionRun({
        id: res.dag_run_id || safeRandomUUID(),
        timestamp: new Date().toLocaleTimeString(),
        engineId: lastStage?.engine_id || "vieneu-tts-v3-turbo",
        displayName: `DAG (${res.node_count} nodes): ${res.pipeline_name}`,
        family: audioUrl ? "tts" : "vision",
        pipelineType: lastStage?.pipeline_type || "text-to-speech",
        modality: lastStage?.modality || "pcm_audio",
        inputSnippet: dagInitialInput().slice(0, 72),
        rawInput: dagInitialInput(),
        parameters: { dag_nodes: res.node_count, cache_hits: res.cache_hits },
        output: res.final_output,
        audioUrl,
        voice: "Hải Đăng (Multi-Modal DAG)",
        durationSeconds: 2.5,
        executionTarget: "dag-orchestrator",
        roundtripMs: res.total_latency_ms,
        requestId: res.dag_run_id,
        payloadSha256: res.final_sha256,
      });

      await refreshTelemetryAndCatalog();
    } catch (err: any) {
      setExecutionError(err?.message || "Multi-Modal DAG execution failed.");
    } finally {
      setDagRunning(false);
    }
  };

  const handleStreamVisualDag = async () => {
    setCell4Mode("dag");
    setDagRunning(true);
    setActiveStreamingDagNodeId(dagNodes()[0]?.node_id ?? null);
    setLiveDagStages([]);
    setSelectedDagStageIndex(null);
    setExecutionError(null);

    try {
      const stream = await client.streamDagPipeline({
        preset_id: selectedDagPresetId(),
        initial_input: dagInitialInput(),
        nodes: dagNodes(),
        enable_cache: dagEnableCache(),
      });
      const reader = stream.getReader();
      const collectedStages: DagStageExecutionResult[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;

        if (value.type === "dag_node_start") {
          setActiveStreamingDagNodeId(value.node_id ?? null);
        } else if (value.type === "dag_node_complete" && value.stage) {
          collectedStages.push(value.stage);
          setLiveDagStages([...collectedStages]);
          setSelectedDagStageIndex(collectedStages.length - 1);
        } else if (value.type === "dag_done") {
          setActiveStreamingDagNodeId(null);
          const doneObj = value.dag_result ?? value;
          const finalStages = doneObj.stages ?? collectedStages;
          const finalRes: DagExecutionResponse = {
            status: "completed",
            dag_run_id: doneObj.dag_run_id,
            preset_id: doneObj.preset_id ?? selectedDagPresetId(),
            pipeline_name: doneObj.pipeline_name ?? "Streamed Multi-Modal DAG",
            node_count: doneObj.node_count ?? finalStages.length,
            total_latency_ms: doneObj.total_latency_ms ?? 0,
            cache_hits: doneObj.cache_hits ?? 0,
            final_sha256: doneObj.final_sha256 ?? "",
            final_audio_wav_base64: doneObj.final_audio_wav_base64,
            final_image_data_uri: doneObj.final_image_data_uri,
            stages: finalStages,
            final_output: finalStages[finalStages.length - 1]?.output ?? null,
          };
          setDagResult(finalRes);
          setSelectedDagStageIndex(finalStages.length - 1);

          let audioUrl: string | undefined;
          if (finalRes.final_audio_wav_base64) {
            const binaryString = atob(finalRes.final_audio_wav_base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            audioUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
          }

          const lastStage = finalStages[finalStages.length - 1];
          recordSessionRun({
            id: finalRes.dag_run_id || safeRandomUUID(),
            timestamp: new Date().toLocaleTimeString(),
            engineId: lastStage?.engine_id || "vieneu-tts-v3-turbo",
            displayName: `Live Streamed DAG (${finalRes.node_count} nodes)`,
            family: audioUrl ? "tts" : "vision",
            pipelineType: lastStage?.pipeline_type || "text-to-speech",
            modality: lastStage?.modality || "pcm_audio",
            inputSnippet: dagInitialInput().slice(0, 72),
            rawInput: dagInitialInput(),
            parameters: { dag_nodes: finalRes.node_count, cache_hits: finalRes.cache_hits },
            output: finalRes.final_output,
            audioUrl,
            voice: "Hải Đăng (Streamed DAG)",
            durationSeconds: 2.5,
            executionTarget: "dag-stream-orchestrator",
            roundtripMs: finalRes.total_latency_ms,
            requestId: finalRes.dag_run_id,
            payloadSha256: finalRes.final_sha256,
          });
        }
      }
      await refreshTelemetryAndCatalog();
    } catch {
      await handleExecuteVisualDag();
    } finally {
      setActiveStreamingDagNodeId(null);
      setDagRunning(false);
    }
  };

  // SQLite WAL Dataset Export
  const handleExportDataset = async (format: "jsonl" | "csv") => {
    setExportBusy(true);
    try {
      const content = await client.exportTelemetryDataset(format);
      const mime = format === "csv" ? "text/csv;charset=utf-8" : "application/x-ndjson";
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `studio_telemetry_v32.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setExecutionError(err?.message || `Failed to export ${format.toUpperCase()} dataset.`);
    } finally {
      setExportBusy(false);
    }
  };

  const handleToggleMicCapture = () => {
    if (isRecordingMic()) {
      setIsRecordingMic(false);
      const syntheticWav = new Uint8Array(1024);
      syntheticWav.set([0x52, 0x49, 0x46, 0x46], 0);
      const blob = new Blob([syntheticWav], { type: "audio/wav" });
      setSelectedBinaryFile(blob);
      setSelectedBinaryName(
        `webrtc_mic_capture_${new Date().toLocaleTimeString().replace(/:/g, "-")}.wav`
      );
    } else {
      setIsRecordingMic(true);
    }
  };

  const handleInspectEnvironment = async (targetEnvId: string) => {
    setSelectedInspectEnvId(targetEnvId);
    setInspectLoading(true);
    setEnvError(null);
    try {
      const res = await client.inspectUvEnvironment(targetEnvId);
      const pkgs = Array.isArray(res.installed_packages)
        ? (res.installed_packages as Array<{ name: string; version: string }>)
        : [];
      setInspectedPackages(pkgs);
    } catch (err: any) {
      setEnvError(err?.message || `Failed to inspect environment '${targetEnvId}'.`);
    } finally {
      setInspectLoading(false);
    }
  };

  const handleProvisionEnv = async () => {
    setEnvLoading(true);
    setEnvError(null);
    try {
      const pkgs = packages()
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await client.provisionUvEnvironment({
        env_id: envId(),
        python_version: enableGpu() ? "3.12" : "3.11",
        packages: pkgs,
        enable_gpu: enableGpu(),
      });
      setSelectedInspectEnvId(envId());
      const installedList = Array.isArray(res.installed_packages)
        ? (res.installed_packages as Array<{ name: string; version: string }>)
        : [];
      setInspectedPackages(installedList);
      void refreshTelemetryAndCatalog();
    } catch (err: any) {
      setEnvError(err?.message || "uv environment provisioning failed.");
    } finally {
      setEnvLoading(false);
    }
  };

  const handleRunIsolatedTask = async () => {
    const targetEnv = selectedInspectEnvId() || envId();
    if (!targetEnv.trim()) return;
    setWorkerRunning(true);
    setEnvError(null);
    try {
      const res = await client.runInUvEnvironment(targetEnv, {
        code: workerCode(),
        payload: {
          requested_by: "studio_bento_cockpit_v17",
          target_env: targetEnv,
          timestamp: new Date().toISOString(),
        },
        timeout_sec: 30,
      });
      setWorkerOutput(res);
    } catch (err: any) {
      setEnvError(err?.message || `Isolated task execution in '${targetEnv}' failed.`);
    } finally {
      setWorkerRunning(false);
    }
  };

  const copySdkSnippet = () => {
    const snippet = `import {
  AIInferenceClient,
  createNdjsonTransformStream,
  buildMultimodalFormData,
  createWinterTCEdgeGateway
} from '@acc/ai-control-plane-sdk';

const client = new AIInferenceClient("", { timeoutMs: 30_000, maxRetries: 2 });

// 1. Studio v32: Switch Local Hardware Power Profile & Auto-Adapt All Model Weight Tiers
await client.selectHardwareProfile({
  profile_id: "tier_2_consumer_8gb",
  auto_adapt_models: true
});

// 2. Studio v32: Explicitly Set FLUX.1-schnell to Nano INT4 with CPU/RAM Layer Offload
await client.setModelWeightTier("flux-1-schnell", {
  tier_id: "nano_int4",
  offload_strategy: "cpu_ram_offload"
});

// 3. Studio v16/v17: Stream 4-Stage Cross-Modal DAG Node-by-Node over NDJSON
const dagStream = await client.streamDagPipeline({
  preset_id: "diffusion-rmbg-vlm-tts",
  enable_cache: true
});

export default { fetch: createWinterTCEdgeGateway("http://127.0.0.1:8000") };`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeRun = createMemo(
    () => runs().find((r) => r.id === activeRunId()) ?? runs()[0] ?? null
  );
  const activeAudioRun = createMemo(() => {
    const currentRun = activeRun();
    const manifest = activeManifest();
    return (
      (currentRun?.audioUrl && manifest && currentRun.engineId === manifest.engine_id ? currentRun : null) ??
      runs().find((r) => Boolean(r.audioUrl && manifest && r.engineId === manifest.engine_id)) ??
      null
    );
  });

  const activeTtsVoice = createMemo(() => String(activeParams().voice ?? "Hải Đăng"));
  const activeTtsSpeed = createMemo(() => Number(activeParams().speed ?? 1.0));
  const activeTtsPitch = createMemo(() => Number(activeParams().pitch ?? 0));
  const activeTtsGain = createMemo(() => Number(activeParams().gain_db ?? 0));
  const activeModelWeightTier = createMemo(() =>
    String(activeManifest()?.weights?.weight_tier ?? "balanced_fp16")
  );

  const isClusterHealthy = createMemo(() => healthData()?.status === "healthy");
  const circuitState = createMemo(
    () => activeManifest()?.circuit_state || healthData()?.pilot_tts?.circuit_state || "CLOSED"
  );
  const schedulerStats = createMemo(
    () =>
      (activeManifest()?.scheduler ?? healthData()?.pilot_tts?.scheduler ?? {}) as Record<
        string,
        any
      >
  );
  const latencyStats = createMemo(
    () => (schedulerStats().latency ?? {}) as Record<string, number>
  );
  const queueDepth = createMemo(() => schedulerStats().queue_depth ?? 0);
  const maxQueueSize = createMemo(() => schedulerStats().max_queue_size ?? 256);
  const sqlSummary = createMemo(
    () => sqliteLedger()?.metrics_summary ?? healthData()?.telemetry_summary
  );
  const p50Ms = createMemo(() => sqlSummary()?.p50_ms || latencyStats().p50_ms || 0);
  const p95Ms = createMemo(() => sqlSummary()?.p95_ms || latencyStats().p95_ms || 0);
  const totalVramMb = createMemo(() =>
    catalogModels().reduce(
      (acc, m) =>
        acc + (m.loaded ? m.weights?.effective_vram_mb ?? m.vram_mb ?? m.vram_footprint_mb : 0),
      0
    )
  );
  const maxVramBudgetMb = createMemo(
    () => vramBudgetInput() || weightsSummary()?.max_vram_budget_mb || 16384
  );

  const pipelines = createMemo<StudioPipeline[]>(() => {
    const pipelineMap = new Map<string, StudioPipeline>();
    const models = catalogModels();
    const currentActiveEngineId = activeEngineId();
    for (const m of models) {
      const pt = m.pipeline_type;
      if (!pipelineMap.has(pt)) {
        pipelineMap.set(pt, {
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
        const item = pipelineMap.get(pt)!;
        item.models?.push(m);
        if (m.loaded) {
          item.loaded = true;
          item.lifecycle_state = "ACTIVE_VRAM";
        }
        if (m.engine_id === currentActiveEngineId) {
          item.engine_id = m.engine_id;
        }
      }
    }
    return Array.from(pipelineMap.values());
  });

  return (
    <div class="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* 1. Top Cockpit Command Bar */}
      <StudioHeader
        sidebarExpanded={sidebarExpanded()}
        onToggleSidebar={() => setSidebarExpanded((prev) => !prev)}
        activeEngineId={activeEngineId()}
        onSelectEngine={handleSelectEngine}
        catalogModels={catalogModels()}
        onOpenHubModal={() => setHubModalOpen(true)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        currentTheme={themeContext?.currentTheme() ?? ({} as any)}
        presets={themeContext?.presets ?? []}
        onSetThemeById={(id) => themeContext?.setThemeById(id)}
        onOpenGallery={() => themeContext?.openGallery()}
        onCycleQuickMode={() => themeContext?.cycleQuickMode()}
        isClusterHealthy={isClusterHealthy()}
      />

      {/* 2. Multi-Engine Ribbon & Hardware Power / VRAM / SQLite Lifecycle Bar */}
      <EngineStatusRibbon
        pipelines={pipelines()}
        catalogModels={catalogModels()}
        activeEngineId={activeEngineId()}
        onSelectEngine={handleSelectEngine}
        onOpenHubModal={() => setHubModalOpen(true)}
        activeHardwareProfile={activeHardwareProfile()}
        hardwareProfiles={hardwareProfiles()}
        onSelectHardwareProfile={(profId) => void handleSelectHardwareProfile(profId, true)}
        totalVramMb={totalVramMb()}
        maxVramBudgetMb={maxVramBudgetMb()}
        totalRunsCount={sqlSummary()?.total_runs ?? runs().length}
        p95Ms={p95Ms()}
        onRefreshTelemetry={refreshTelemetryAndCatalog}
        healthLoading={healthLoading()}
        gpuSandboxStatus={gpuSandboxStatus()}
        isProvisioningGpu={isProvisioningGpu()}
        onProvisionGpu={() => void handleProvisionGpuSandbox()}
        pinnedEngineIds={pinnedEngineIds()}
        onTogglePin={handleTogglePin}
      />

      {/* 3. Main Cockpit Body */}
      <div class="flex-1 flex min-h-0 overflow-hidden relative">
        <StudioSidebarNav
          sidebarExpanded={sidebarExpanded()}
          onToggleSidebar={() => setSidebarExpanded((prev) => !prev)}
          activeTab={activeTab()}
          onSelectTab={handleSelectTab}
        />

        {/* Full-Bleed Responsive Bento Stage */}
        <main class="flex-1 overflow-y-auto studio-scroll p-3.5 sm:p-5 pb-28 md:pb-8">
          <div class="max-w-[1680px] mx-auto space-y-4">
            <Show when={catalogStatus() === "error"}>
              <div class="px-4 py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200 text-xs flex flex-wrap items-center justify-between gap-3 font-mono shadow-sm">
                <div class="flex items-center gap-2.5">
                  <div class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></div>
                  <span>
                    <strong>Offline:</strong> Awaiting AI Control Plane backend on port 8000. Start the server or click retry.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshTelemetryAndCatalog()}
                  class="px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/40 transition flex items-center gap-1.5 font-semibold text-[11px]"
                >
                  <RefreshCw class="w-3 h-3" />
                  Retry Connection
                </button>
              </div>
            </Show>
            <Show when={activeTab() === "pipelines"}>
              <section
                id="panel-tts"
                role="tabpanel"
                class="grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-4"
              >
                <Show
                  when={activeManifest()}
                  fallback={
                    <>
                      <div class="md:col-span-6 xl:col-span-7 p-6 rounded-2xl border border-border bg-card/60 animate-pulse space-y-4">
                        <div class="flex items-center justify-between pb-4 border-b border-border/50">
                          <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-muted/60"></div>
                            <div class="space-y-2">
                              <div class="h-4 w-48 bg-muted/60 rounded"></div>
                              <div class="h-3 w-32 bg-muted/40 rounded"></div>
                            </div>
                          </div>
                          <div class="h-7 w-28 bg-muted/40 rounded-xl"></div>
                        </div>
                        <div class="space-y-3 py-4">
                          <div class="h-24 w-full bg-surface/80 rounded-xl border border-border/40"></div>
                          <div class="h-28 w-full bg-surface/80 rounded-xl border border-border/40"></div>
                        </div>
                        <div class="flex items-center justify-between pt-4 border-t border-border/50">
                          <div class="h-8 w-32 bg-muted/40 rounded-lg"></div>
                          <div class="h-8 w-28 bg-primary/30 rounded-lg"></div>
                        </div>
                      </div>
                      <div class="md:col-span-6 xl:col-span-5 p-6 rounded-2xl border border-border bg-card/60 animate-pulse space-y-4">
                        <div class="flex items-center justify-between pb-4 border-b border-border/50">
                          <div class="h-4 w-40 bg-muted/60 rounded"></div>
                          <div class="h-4 w-24 bg-muted/40 rounded"></div>
                        </div>
                        <div class="h-64 w-full bg-surface/80 rounded-xl my-4"></div>
                        <div class="h-8 w-36 bg-muted/40 rounded"></div>
                      </div>
                    </>
                  }
                >
                  {(manifest) => (
                    <>
                      <BespokePipelineDeckCell
                        spanClass="md:col-span-6 xl:col-span-7"
                        activeManifest={manifest()}
                        catalogModels={catalogModels()}
                        activeStudioStyle={activeStudioStyle()}
                        activeParams={activeParams()}
                        activeInputText={activeInputText()}
                        setActiveEngineId={handleSelectEngine}
                        setActiveInput={setActiveInput}
                        setActiveParam={setActiveParam}
                        executionError={executionError()}
                        lifecycleNotice={lifecycleNotice()}
                        setLifecycleNotice={setLifecycleNotice}
                        lifecycleBusyId={lifecycleBusyId()}
                        handlePrefetchWeights={handlePrefetchWeights}
                        handleLoadOrBindModel={handleLoadOrBindModel}
                        handleWarmupModel={handleWarmupModel}
                        handleUnloadEvictModel={handleUnloadEvictModel}
                        handleSetModelWeightTier={handleSetModelWeightTier}
                        selectedBinaryName={selectedBinaryName()}
                        onSelectBinaryFile={(file, name) => {
                          setSelectedBinaryFile(file);
                          setSelectedBinaryName(name);
                        }}
                        isRecordingMic={isRecordingMic()}
                        onToggleMicCapture={handleToggleMicCapture}
                        showZeroShot={showZeroShot()}
                        onToggleZeroShot={() => setShowZeroShot((prev) => !prev)}
                        refAudioPath={refAudioPath()}
                        onChangeRefAudioPath={setRefAudioPath}
                        resetActiveModelDefaults={resetActiveModelDefaults}
                        executionStatus={executionStatus()}
                        handleExecuteBatched={handleExecuteBatched}
                        cancelActiveExecution={cancelActiveExecution}
                        handleExecuteStream={() => void handleExecuteStream()}
                        handleStreamVisualDag={handleStreamVisualDag}
                        dagRunning={dagRunning()}
                        hardwareTelemetry={hostTelemetry()}
                        handleExecuteAsyncJob={() => void handleExecuteAsyncJob()}
                        activeJob={activeJob()}
                        onCancelActiveJob={handleCancelActiveJob}
                        voices={voices()}
                      />
                      <PolymorphicVisualizerCell
                        spanClass="md:col-span-6 xl:col-span-5"
                        activeManifest={manifest()}
                        activeStudioStyle={activeStudioStyle()}
                        liveStreamOutput={liveStreamOutput()}
                        activeRun={activeRun()}
                        activeAudioRun={activeAudioRun()}
                        streamingAudioAnalyser={streamingAudioAnalyser()}
                        activeInputText={activeInputText()}
                        selectedBinaryName={selectedBinaryName()}
                        activeParams={activeParams()}
                        showRawJsonInspector={showRawJsonInspector()}
                        setShowRawJsonInspector={setShowRawJsonInspector}
                        executionStatus={executionStatus()}
                        streamTelemetry={streamTelemetry()}
                        activeTtsVoice={activeTtsVoice()}
                        activeTtsSpeed={activeTtsSpeed()}
                        activeTtsPitch={activeTtsPitch()}
                        activeTtsGain={activeTtsGain()}
                        activeModelWeightTier={activeModelWeightTier()}
                        liveTtsPreview={null}
                        setActiveEngineId={handleSelectEngine}
                        setModelInputsMap={setModelInputsMap}
                        modelParamsMap={modelParamsMap()}
                        recordSessionRun={recordSessionRun}
                        setActiveParam={setActiveParam}
                        activeJob={activeJob()}
                        onCancelActiveJob={handleCancelActiveJob}
                        onSendMessage={(text) => void handleExecuteStream(text)}
                        onStopStreaming={cancelActiveExecution}
                      />
                    </>
                  )}
                </Show>
                <SessionAndArenaCell
                  spanClass="md:col-span-6 xl:col-span-12"
                  cell4Mode={cell4Mode()}
                  setCell4Mode={setCell4Mode}
                  dagPresets={dagPresets()}
                  selectedDagPresetId={selectedDagPresetId()}
                  handleSelectDagPreset={handleSelectDagPreset}
                  dagInitialInput={dagInitialInput()}
                  setDagInitialInput={setDagInitialInput}
                  dagNodes={dagNodes()}
                  dagEnableCache={dagEnableCache()}
                  setDagEnableCache={setDagEnableCache}
                  dagAddEngineId={dagAddEngineId()}
                  setDagAddEngineId={setDagAddEngineId}
                  catalogModels={catalogModels()}
                  handleAddNodeToDag={handleAddNodeToDag}
                  handleRemoveDagNode={handleRemoveDagNode}
                  handleMoveDagNode={handleMoveDagNode}
                  handleUpdateDagNodeParam={handleUpdateDagNodeParam}
                  dagRunning={dagRunning()}
                  handleExecuteVisualDag={handleExecuteVisualDag}
                  handleStreamVisualDag={handleStreamVisualDag}
                  dagResult={dagResult()}
                  activeStreamingDagNodeId={activeStreamingDagNodeId()}
                  liveDagStages={liveDagStages()}
                  selectedDagStageIndex={selectedDagStageIndex()}
                  setSelectedDagStageIndex={setSelectedDagStageIndex}
                  arenaLeftId={arenaLeftId()}
                  setArenaLeftId={setArenaLeftId}
                  arenaRightId={arenaRightId()}
                  setArenaRightId={setArenaRightId}
                  arenaRunning={arenaRunning()}
                  handleRunArenaComparison={handleRunArenaComparison}
                  serverArenaResult={serverArenaResult()}
                  arenaResult={arenaResult()}
                  arenaVoteWinnerId={arenaVoteWinnerId()}
                  handleVoteArenaWinner={handleVoteArenaWinner}
                  runs={runs()}
                  activeRunId={activeRunId()}
                  setActiveRunId={setActiveRunId}
                  clearRuns={clearRuns}
                  setActiveEngineId={handleSelectEngine}
                  setModelInputsMap={setModelInputsMap}
                  setModelParamsMap={setModelParamsMap}
                  setLiveStreamOutput={setLiveStreamOutput}
                />
              </section>
            </Show>

            <Show when={activeTab() === "hf"}>
              <section
                id="panel-hf"
                role="tabpanel"
                class="grid grid-cols-1 xl:grid-cols-12 gap-4"
              >
                <ModelCatalogRackCell
                  spanClass="xl:col-span-7"
                  catalogModels={catalogModels()}
                  activeEngineId={activeEngineId()}
                  setActiveEngineId={handleSelectEngine}
                  selectedPipelineCategory={selectedPipelineCategory()}
                  setSelectedPipelineCategory={setSelectedPipelineCategory}
                  totalVramMb={totalVramMb()}
                  maxVramBudgetMb={maxVramBudgetMb()}
                  vramBudgetInput={vramBudgetInput()}
                  setVramBudgetInput={setVramBudgetInput}
                  handleUpdateVramBudget={handleUpdateVramBudget}
                  activeHardwareProfile={activeHardwareProfile()}
                  hardwareProfiles={hardwareProfiles()}
                  hostTelemetry={hostTelemetry()}
                  hardwareAdaptBusy={hardwareAdaptBusy()}
                  handleSelectHardwareProfile={handleSelectHardwareProfile}
                  handleAutoAdaptAllModels={handleAutoAdaptAllModels}
                  lifecycleBusyId={lifecycleBusyId()}
                  handleWarmupModel={handleWarmupModel}
                  handleLoadOrBindModel={handleLoadOrBindModel}
                  handleUnloadEvictModel={handleUnloadEvictModel}
                  handlePrefetchWeights={handlePrefetchWeights}
                  handleQuantizeWeights={handleQuantizeWeights}
                  handleTogglePinModel={handleTogglePinModel}
                  handlePurgeDiskCache={handlePurgeDiskCache}
                  handleInspectModelShards={handleInspectModelShards}
                  handleSetModelWeightTier={handleSetModelWeightTier}
                  inspectedShardModel={inspectedShardModel()}
                  setInspectedShardModel={setInspectedShardModel}
                  shardInspectBusyId={shardInspectBusyId()}
                  onOpenHubModal={() => setHubModalOpen(true)}
                  hubMarketplaceModels={hubMarketplaceModels()}
                  quickHubSelectId={quickHubSelectId()}
                  setQuickHubSelectId={setQuickHubSelectId}
                  handleOneClickHubInstall={handleOneClickHubInstall}
                  handleBatchWeightsAction={handleBatchWeightsAction}
                  uvEnvs={uvEnvs()}
                />
                <WeightsLifecycleWorkbenchCell
                  spanClass="xl:col-span-5"
                  catalogModels={catalogModels()}
                  activeEngineId={activeEngineId()}
                  setActiveEngineId={handleSelectEngine}
                  inspectedShardModel={inspectedShardModel()}
                  shardInspectBusyId={shardInspectBusyId()}
                  handleInspectModelShards={handleInspectModelShards}
                  handleSetModelWeightTier={handleSetModelWeightTier}
                  handleWarmupModel={handleWarmupModel}
                  handleUnloadEvictModel={handleUnloadEvictModel}
                  handleTogglePinModel={handleTogglePinModel}
                  activeHardwareProfile={activeHardwareProfile()}
                  lifecycleBusyId={lifecycleBusyId()}
                  totalVramMb={totalVramMb()}
                  maxVramBudgetMb={maxVramBudgetMb()}
                />
              </section>
            </Show>

            <Show when={activeTab() === "env"}>
              <section
                id="panel-env"
                role="tabpanel"
                class="grid grid-cols-1 xl:grid-cols-12 gap-4"
              >
                <UvOrchestratorCell
                  spanClass="xl:col-span-12"
                  envId={envId()}
                  setEnvId={setEnvId}
                  packages={packages()}
                  setPackages={setPackages}
                  enableGpu={enableGpu()}
                  setEnableGpu={setEnableGpu}
                  envLoading={envLoading()}
                  handleProvisionEnv={handleProvisionEnv}
                  uvEnvs={uvEnvs()}
                  selectedInspectEnvId={selectedInspectEnvId()}
                  setSelectedInspectEnvId={setSelectedInspectEnvId}
                  handleInspectEnvironment={handleInspectEnvironment}
                  inspectedPackages={inspectedPackages()}
                  inspectLoading={inspectLoading()}
                  pkgSearchQuery={pkgSearchQuery()}
                  setPkgSearchQuery={setPkgSearchQuery}
                  envError={envError()}
                  workerCode={workerCode()}
                  setWorkerCode={setWorkerCode}
                  workerRunning={workerRunning()}
                  handleRunIsolatedTask={handleRunIsolatedTask}
                  workerOutput={workerOutput()}
                />
              </section>
            </Show>

            <Show when={activeTab() === "telemetry"}>
              <section
                id="panel-telemetry"
                role="tabpanel"
                class="grid grid-cols-1 xl:grid-cols-12 gap-4"
              >
                <TelemetryAndSdkCell
                  spanClass="xl:col-span-7"
                  sqliteLedger={sqliteLedger()}
                  sqlSummary={sqlSummary()}
                  runs={runs()}
                  circuitState={circuitState()}
                  activeEngineId={activeManifest()?.engine_id ?? ""}
                  onResetCircuitBreaker={async (engId) => {
                    await client.resetModelCircuitBreaker(engId);
                  }}
                  onRefreshTelemetry={refreshTelemetryAndCatalog}
                  exportBusy={exportBusy()}
                  handleExportDataset={handleExportDataset}
                  copySdkSnippet={copySdkSnippet}
                  copied={copied()}
                  p50Ms={p50Ms()}
                  p95Ms={p95Ms()}
                  queueDepth={queueDepth()}
                  maxQueueSize={maxQueueSize()}
                />
                <Card class="xl:col-span-5">
                  <CardHeader class="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle>SQLite WAL Ledger & Hardware Profiler Inspector</CardTitle>
                      <CardDescription>
                        Live JSON payload from GET /v1/hardware/profile & /v1/telemetry/ledger
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={refreshTelemetryAndCatalog}>
                      <RefreshCw class="w-3.5 h-3.5" /> Refresh
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div class="bg-surface border border-border rounded-xl p-4 font-mono text-xs text-foreground overflow-x-auto max-h-96 studio-scroll">
                      <pre>
                        {JSON.stringify(
                          {
                            activeHardwareProfile: activeHardwareProfile(),
                            hostTelemetry: hostTelemetry(),
                            sqliteLedger: sqliteLedger(),
                            weightsSummary: weightsSummary(),
                          },
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </Show>

            <Show when={activeTab() === "sdk"}>
              <section id="panel-sdk" role="tabpanel" class="max-w-5xl mx-auto">
                <Card>
                  <CardHeader class="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle class="flex items-center gap-2">
                        <FileCode class="w-4 h-4 text-primary" />
                        WinterTC Minimum Common Web Platform API (ECMA-429) Studio v32 SDK
                      </CardTitle>
                      <CardDescription class="mt-1">
                        Portable across Browsers, Cloudflare Workers, Deno, Bun, and Node.js using{" "}
                        <code>fetch</code>, <code>Request</code>, <code>Response</code>,{" "}
                        <code>URLPattern</code>, <code>TransformStream</code>, <code>FormData</code>
                        , and <code>crypto.subtle</code>.
                      </CardDescription>
                    </div>
                    <Button size="sm" onClick={copySdkSnippet}>
                      <Show
                        when={copied()}
                        fallback={
                          <>
                            <FileCode class="w-3.5 h-3.5" />
                            <span>Copy SDK Code</span>
                          </>
                        }
                      >
                        <Check class="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </Show>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <div class="bg-surface border border-border rounded-xl p-4 font-mono text-xs text-primary overflow-x-auto leading-relaxed">
                      <pre>{`import {
  AIInferenceClient,
  createNdjsonTransformStream,
  buildMultimodalFormData,
  createWinterTCEdgeGateway
} from '@acc/ai-control-plane-sdk';

const client = new AIInferenceClient("", { timeoutMs: 30_000, maxRetries: 2 });

// 1. Studio v32: Switch Local Hardware Power Profile & Auto-Adapt All Model Weight Tiers
await client.selectHardwareProfile({
  profile_id: "tier_2_consumer_8gb",
  auto_adapt_models: true
});

// 2. Studio v32: Explicitly Set FLUX.1-schnell to Nano INT4 with CPU/RAM Layer Offload
await client.setModelWeightTier("flux-1-schnell", {
  tier_id: "nano_int4",
  offload_strategy: "cpu_ram_offload"
});

// 3. Studio v16/v17: Stream 4-Stage Cross-Modal DAG Node-by-Node over NDJSON
const dagStream = await client.streamDagPipeline({
  preset_id: "diffusion-rmbg-vlm-tts",
  enable_cache: true
});

export default { fetch: createWinterTCEdgeGateway("http://127.0.0.1:8000") };`}</pre>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </Show>
          </div>
        </main>
      </div>

      {/* 4. Persistent Global DAW Master Transport Dock */}
      <Show when={activeAudioRun() && activeAudioRun()?.audioUrl}>
        <div class="shrink-0 z-30">
          <StudioAudioPlayer
            compactDock
            audioUrl={activeAudioRun()!.audioUrl!}
            voiceName={activeAudioRun()!.voice || "Hải Đăng"}
            backendUsed={activeAudioRun()!.executionTarget}
            durationSeconds={activeAudioRun()!.durationSeconds || 2.5}
            roundtripSec={Math.round((activeAudioRun()!.roundtripMs / 1000) * 100) / 100}
            requestId={activeAudioRun()!.requestId}
            payloadSha256={activeAudioRun()!.payloadSha256}
          />
        </div>
      </Show>

      {/* 5. Mobile Ergonomic Bottom Navigation Bar */}
      <MobileBottomNav activeTab={activeTab()} onSelectTab={handleSelectTab} />

      {/* 6. Zero-Typing AI Model Hub Marketplace & 4-Layer Capability Resolver Modal */}
      <ModelHubMarketplaceModal
        isOpen={hubModalOpen()}
        onClose={() => setHubModalOpen(false)}
        hubModels={hubMarketplaceModels()}
        onInstallModel={handleOneClickHubInstall}
        onResolveModel={(repoId, taskOverride) => client.resolveHubModel(repoId, taskOverride)}
        onSelectActiveEngine={handleSelectEngine}
        busyEngineId={lifecycleBusyId()}
      />

      {/* 6b. Interactive VRAM Eviction Modal Dialog (Physical GPU Budget Guard) */}
      <VramEvictionModal
        isOpen={Boolean(evictionRequest())}
        evictionRequest={evictionRequest()}
        isSubmitting={isEvictionSubmitting()}
        onConfirmEvictAndMount={handleConfirmEvictAndMount}
        onFallbackToHostRam={handleFallbackToHostRam}
        onClose={() => setEvictionRequest(null)}
      />

      {/* 6c. Studio Voice Cloning & Mic Recording Modal */}
      <VoiceCloningModal
        isOpen={showZeroShot()}
        engineId={activeEngineId()}
        onVoiceRegistered={(vId, vName) => {
          setVoices((prev) => [...prev, { label: vName, voice_id: vId }]);
          setActiveParam("voice", vId);
          setShowZeroShot(false);
        }}
        onClose={() => setShowZeroShot(false)}
        client={client}
      />

      {/* 7. Unified Cmd/Ctrl + K Studio Command Palette */}
      <StudioCommandPalette
        isOpen={commandPaletteOpen()}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectWorkspace={handleSelectTab}
        onSelectEngine={handleSelectEngine}
        onSelectHardwareProfile={(profId) => void handleSelectHardwareProfile(profId, true)}
        onTriggerAutoAdaptHardware={() => void handleAutoAdaptAllModels()}
        onTriggerArena={() => void handleRunArenaComparison()}
        onTriggerDagChain={() => void handleExecuteVisualDag()}
        onTriggerStreamDag={() => void handleStreamVisualDag()}
        onTriggerExportDataset={(fmt) => void handleExportDataset(fmt)}
        onSelectVoice={(vId) => {
          handleSelectEngine("vieneu-tts-v3-turbo");
          setModelParamsMap((prev) => ({
            ...prev,
            "vieneu-tts-v3-turbo": {
              ...(prev["vieneu-tts-v3-turbo"] ?? {}),
              voice: vId,
            },
          }));
          setShowZeroShot(false);
        }}
        onLoadTemplate={(tplText) => setActiveInput(tplText)}
        onRefreshTelemetry={() => void refreshTelemetryAndCatalog()}
        catalogModels={catalogModels()}
        voices={voices()}
        templates={STUDIO_SCRIPT_TEMPLATES}
      />
    </div>
  );
}

export default App;
