/**
 * WinterTC (ECMA-429) WHATWG URLPattern Type Definitions
 * Ensures strict compilation across TypeScript DOM & Node/@types/node targets
 * that do not yet bundle global URLPattern declarations by default.
 */
export interface URLPatternInit {
  protocol?: string;
  username?: string;
  password?: string;
  hostname?: string;
  port?: string;
  pathname?: string;
  search?: string;
  hash?: string;
  baseURL?: string;
}

export interface URLPatternComponentResult {
  input: string;
  groups: Record<string, string | undefined>;
}

export interface URLPatternResult {
  inputs: (string | URLPatternInit)[];
  protocol: URLPatternComponentResult;
  username: URLPatternComponentResult;
  password: URLPatternComponentResult;
  hostname: URLPatternComponentResult;
  port: URLPatternComponentResult;
  pathname: URLPatternComponentResult;
  search: URLPatternComponentResult;
  hash: URLPatternComponentResult;
}


export type ModalityFamily =
  | "tts"
  | "asr"
  | "llm"
  | "diffusion"
  | "vision"
  | "classification"
  | "embeddings";

export type PipelineCategoryId =
  | "audio_speech"
  | "generative_multimodal"
  | "generative_diffusion"
  | "computer_vision"
  | "nlu_reranking"
  | "vector_embeddings";

export type WeightsLifecycleState =
  | "HUB_AVAILABLE"
  | "REGISTERED"
  | "DOWNLOADING"
  | "CACHED_ON_DISK"
  | "WARMING_UP"
  | "ACTIVE_VRAM"
  | "EVICTED_TO_DISK";

export type WeightPrecision = "fp32" | "bf16" | "fp16" | "int8" | "int4";

// --- Studio v17: Hardware-Adaptive Model & Weight Tiering Types ---
export type WeightTierId =
  | "nano_int4"
  | "compact_int8"
  | "balanced_fp16"
  | "studio_bf16"
  | "ultra_fp32";

export type HardwareProfileId =
  | "tier_1_edge_cpu"
  | "tier_2_consumer_8gb"
  | "tier_3_prosumer_16gb"
  | "tier_4_workstation_24gb"
  | "tier_5_datacenter_48gb";

export type OffloadStrategy = "none" | "hybrid_kv_offload" | "cpu_ram_offload";

export type HardwareFitStatus =
  | "OPTIMAL_FIT"
  | "QUANTIZED_FIT"
  | "OFFLOAD_HYBRID"
  | "EXCEEDS_HARDWARE";

export interface ModelWeightTierVariant {
  tier_id: WeightTierId;
  short_label: string;
  label: string;
  precision: WeightPrecision;
  quantization_method: string;
  vram_mb: number;
  ram_mb: number;
  disk_mb: number;
  speedup_multiplier: number;
  quality_retention_pct: number;
  recommended_batch_size: number;
  default_offload_strategy: OffloadStrategy;
  supported: boolean;
  active: boolean;
  recommended_for_hardware: boolean;
  fit_status: HardwareFitStatus;
  fit_label: string;
  description: string;
}

export interface ModelHardwareCompatibility {
  status: HardwareFitStatus;
  badge_text: string;
  active_weight_tier: WeightTierId;
  active_tier_label: string;
  quantization_method: string;
  speedup_multiplier: number;
  quality_retention_pct: number;
  offload_strategy: OffloadStrategy;
  recommended_tier_for_hardware: WeightTierId;
  vram_share_of_budget_pct: number;
}

export interface LocalHardwareProfile {
  profile_id: HardwareProfileId;
  tier_number: number;
  name: string;
  short_name: string;
  representative_hardware: string;
  vram_budget_mb: number;
  system_ram_budget_mb: number;
  single_model_vram_ceiling_mb: number;
  recommended_weight_tier: WeightTierId;
  recommended_precision: WeightPrecision;
  default_offload_strategy: OffloadStrategy;
  recommended_execution_target: string;
  recommended_max_batch_size: number;
  compute_backend: string;
  accent_color: string;
}

export interface HostHardwareTelemetry {
  cpu_cores: number;
  architecture: string;
  platform_system: string;
  system_ram_mb: number;
  cuda_available: boolean;
  physical_gpu_name?: string;
  physical_gpu_vram_mb?: number;
  cuda_status_message?: string;
  recommended_offload_strategy?: OffloadStrategy;
  detected_tier_id: HardwareProfileId;
}

export interface HardwareProfileSnapshotResponse {
  host_telemetry: HostHardwareTelemetry;
  active_profile_id: HardwareProfileId;
  active_profile: LocalHardwareProfile;
  available_profiles: LocalHardwareProfile[];
  weight_tier_catalog: Array<Record<string, any>>;
  model_compatibility: Array<{
    engine_id: string;
    model_id: string;
    pipeline_type: string;
    active_weight_tier: WeightTierId;
    active_precision: WeightPrecision;
    offload_strategy: OffloadStrategy;
    effective_vram_mb: number;
    effective_ram_mb: number;
    fit_status: HardwareFitStatus;
    badge_text: string;
    recommended_weight_tier: WeightTierId;
    speedup_multiplier: number;
    quality_retention_pct: number;
  }>;
  weights_summary: WeightsSummary;
}

export type InputModality = "text" | "audio" | "image" | "multimodal";

export type OutputModality =
  | "pcm_audio"
  | "timestamped_transcript"
  | "token_stream"
  | "generated_image"
  | "bounding_boxes"
  | "classification"
  | "vector_float32";

export interface ParameterSchemaField {
  key: string;
  label: string;
  type: "slider" | "select" | "toggle" | "chips" | "text";
  default: unknown;
  min?: number | null;
  max?: number | null;
  step?: number | null;
  options?: Array<{ label: string; value: string }>;
  unit?: string;
  description?: string;
}

export interface SamplePromptPreset {
  label: string;
  text: string;
}

export interface PipelineUiTheme {
  studio_name: string;
  accent_color: string;
  accent_token?: string;
  layout_mode: string;
  badge_class?: string;
  border_glow?: string;
}

export interface ModelWeightsDescriptor {
  engine_id: string;
  model_id: string;
  pipeline_category: PipelineCategoryId;
  pipeline_type: string;
  revision: string;
  weight_format: string;
  precision: WeightPrecision;
  weight_tier?: WeightTierId;
  offload_strategy?: OffloadStrategy;
  recommended_batch_size?: number;
  supported_precisions: WeightPrecision[];
  lifecycle_state: WeightsLifecycleState;
  base_vram_mb: number;
  base_ram_mb: number;
  effective_vram_mb: number;
  effective_ram_mb: number;
  effective_disk_mb?: number;
  quantization_savings_pct?: number;
  speedup_multiplier?: number;
  quality_retention_pct?: number;
  disk_size_mb: number;
  expected_disk_mb: number;
  shard_count?: number;
  verified_shards?: number;
  is_cached_on_disk: boolean;
  sha256_manifest: string;
  pinned_in_vram: boolean;
  last_used_at: number;
  load_count: number;
  cache_hits: number;
  local_cache_path: string;
  last_error?: string | null;
  hardware_compatibility?: ModelHardwareCompatibility;
  weight_tiers?: ModelWeightTierVariant[];
}

export interface WeightsSummary {
  active_hardware_profile_id?: HardwareProfileId;
  active_hardware_profile_name?: string;
  active_hardware_tier_number?: number;
  recommended_weight_tier?: WeightTierId;
  max_vram_budget_mb: number;
  allocated_vram_mb: number;
  unquantized_vram_mb?: number;
  quantization_saved_vram_mb?: number;
  vram_utilization_pct: number;
  allocated_ram_mb: number;
  cached_disk_mb: number;
  cached_models_count: number;
  active_vram_models_count: number;
  pinned_models_count: number;
  state_counts: Record<string, number>;
  tier_counts?: Record<string, number>;
  recent_evictions: Array<{
    engine_id: string;
    reason: string;
    reclaimed_vram_mb: number;
    timestamp: number;
  }>;
}

export interface PipelineCategoryMeta {
  category_id: PipelineCategoryId;
  display_name: string;
  description: string;
  pipeline_types: string[];
  ui_theme?: PipelineUiTheme;
}

export interface InputSlotDescriptor {
  slot_id: string;
  label: string;
  role: "prompt" | "source_media" | "reference_media" | "target_labels" | string;
  data_type: "text" | "audio" | "image" | "text_list" | string;
  required: boolean;
  accepted_mime_types?: string[];
  max_length?: number;
  max_size_bytes?: number;
  placeholder?: string;
  description?: string;
}

export interface ModelCatalogEntry {
  engine_id: string;
  display_name: string;
  family: ModalityFamily;
  task: string;
  pipeline_category: PipelineCategoryId;
  pipeline_type: string;
  model_id: string;
  input_modality: InputModality;
  output_modality: OutputModality;
  transport_protocol: string;
  weight_format?: string;
  default_precision?: WeightPrecision;
  supported_precisions?: WeightPrecision[];
  expected_disk_mb?: number;
  shard_count?: number;
  revision?: string;
  architecture?: string;
  license?: string;
  downloads_str?: string;
  tags?: string[];
  runtime_backend?: string;
  preferred_execution_provider?: string;
  remote_endpoint_url?: string;
  required_uv_packages?: string[];
  resolution_source?: string;
  resolution_confidence?: number;
  ui_theme?: PipelineUiTheme;
  installed_in_catalog?: boolean;
  default_execution_target: string;
  recommended_uv_profile: string;
  vram_footprint_mb: number;
  ram_footprint_mb: number;
  supports_streaming: boolean;
  supports_batching: boolean;
  max_batch_size: number;
  description: string;
  parameters_schema: ParameterSchemaField[];
  input_slots?: InputSlotDescriptor[];
  sample_prompts: SamplePromptPreset[];
  loaded: boolean;
  status: "loaded" | "unloaded" | "warming_up" | "evicted" | "hub_available";
  execution_target: string;
  device: string;
  vram_mb: number;
  ram_mb: number;
  weights?: ModelWeightsDescriptor;
  circuit_state: string;
  scheduler?: Record<string, any>;
  warmed_up?: boolean;
  last_warmup_ms?: number;
  warmup_count?: number;
  last_error?: string | null;
}

export interface HubDiscoveryResponse {
  hub_models: ModelCatalogEntry[];
  total_count: number;
  installed_count: number;
  pipeline_taxonomy: Record<PipelineCategoryId, PipelineCategoryMeta>;
}

export interface HubResolveResponse {
  status: string;
  model_id: string;
  resolved_pipeline_type: string;
  resolved_family: ModalityFamily;
  architecture: string;
  resolution_source: string;
  resolution_confidence: number;
  required_uv_packages: string[];
  manifest: ModelCatalogEntry;
  resolved?: ModelCatalogEntry;
}

export interface HubInstallRequest {
  engine_id?: string;
  model_id?: string;
  task?: string;
  action?: "register_only" | "prefetch_disk" | "load_vram";
  precision?: WeightPrecision;
  weight_tier?: WeightTierId;
  offload_strategy?: OffloadStrategy;
  execution_target?: string;
  force_evict?: boolean;
}

export interface EvictionCandidate {
  engine_id: string;
  model_id: string;
  vram_mb: number;
  pinned: boolean;
  idle_seconds: number;
}

export interface EvictionConfirmationRequiredResponse {
  error_code: "EVICTION_CONFIRMATION_REQUIRED";
  message: string;
  required_vram_mb: number;
  current_vram_mb: number;
  budget_ceiling_mb: number;
  candidates: EvictionCandidate[];
}

export interface GpuSandboxStatusResponse {
  status: "ready" | "offline" | "not_provisioned" | "worker_error";
  sandbox_env: string;
  python_executable: string;
  provisioned: boolean;
  cuda_available: boolean;
  device?: string;
  device_name?: string;
  vram_total_mb?: number;
  vram_allocated_mb?: number;
  vram_reserved_mb?: number;
  vram_free_mb?: number;
  loaded_engines?: string[];
  error?: string;
}

export interface ModelCatalogSummary {
  total_catalog_models: number;
  loaded_engines_count: number;
  total_vram_allocated_mb: number;
  max_vram_budget_mb?: number;
  vram_utilization_pct?: number;
  total_ram_allocated_mb: number;
  cached_disk_mb?: number;
  cuda_available: boolean;
  isolated_uv_envs: number;
  active_hardware_profile_id?: HardwareProfileId;
}

export interface ModelCatalogResponse {
  models: ModelCatalogEntry[];
  pipeline_taxonomy?: Record<PipelineCategoryId, PipelineCategoryMeta>;
  weights_summary?: WeightsSummary;
  hardware_profile?: LocalHardwareProfile;
  available_hardware_profiles?: LocalHardwareProfile[];
  host_telemetry?: HostHardwareTelemetry;
  summary: ModelCatalogSummary;
}

export interface PipelineTaxonomyTreeResponse {
  categories: Array<
    PipelineCategoryMeta & {
      model_count: number;
      active_vram_count: number;
      models_by_pipeline_type: Record<string, ModelCatalogEntry[]>;
      models: ModelCatalogEntry[];
    }
  >;
  weights_summary: WeightsSummary;
}

export interface CatalogLoadRequest {
  engine_id: string;
  task?: string;
  model_id?: string;
  execution_target?: string;
  max_batch_size?: number;
  auto_provision_uv?: boolean;
  precision?: WeightPrecision;
  weight_tier?: WeightTierId;
  offload_strategy?: OffloadStrategy;
  force_evict?: boolean;
}

export interface PolymorphicInferRequest {
  inputs?: unknown;
  parameters?: Record<string, unknown>;
  slots?: Record<string, unknown>;
  file?: Blob | File | null;
  filename?: string;
  auto_load?: boolean;
}

export interface PolymorphicInferenceResult {
  engineId: string;
  modelId: string;
  family: ModalityFamily;
  pipelineCategory?: PipelineCategoryId;
  pipelineType?: string;
  task: string;
  modality: OutputModality;
  device: string;
  executionTarget: string;
  requestId: string;
  payloadSha256: string;
  roundtripMs: number;
  output: any;
  wavBuffer?: ArrayBuffer;
  audioUrl?: string;
  sampleRate?: number;
  durationSeconds?: number;
}

export interface DiffusionLatentStep {
  step: number;
  total_steps: number;
  progress_pct: number;
  latent_noise_sigma: number;
  preview_data_uri: string;
}

export interface NdjsonStreamEvent {
  type: "reasoning_token" | "content_token" | "asr_segment" | "diffusion_step" | "done";
  engine_id: string;
  model_id: string;
  token?: string;
  token_index?: number;
  probability?: number;
  ttft_ms?: number;
  tokens_per_sec?: number;
  elapsed_ms?: number;
  segment?: {
    id: number;
    start: number;
    end: number;
    text: string;
    confidence: number;
    words?: Array<{ word: string; start: number; end: number; probability: number }>;
  };
  diffusion_step?: DiffusionLatentStep;
  output?: any;
}

export interface ArenaComparisonResult {
  left: PolymorphicInferenceResult;
  right: PolymorphicInferenceResult;
  wallClockMs: number;
}

// --- Studio v16/v17: Server-Side A/B Arena Benchmark Scorecard Types ---
export interface ArenaBenchmarkScorecard {
  latency_winner: "left" | "right";
  latency_winner_engine_id?: string;
  latency_delta_ms: number;
  speedup_pct: number;
  vram_winner: "left" | "right";
  vram_winner_engine_id?: string;
  vram_delta_mb: number;
  determinism_verified: boolean;
}

export interface ServerArenaSideResult {
  engine_id: string;
  model_id: string;
  display_name: string;
  pipeline_type: string;
  modality: OutputModality;
  precision: WeightPrecision;
  execution_target: string;
  latency_ms: number;
  vram_mb: number;
  payload_sha256: string;
  summary: string;
  output: any;
  audio_wav_base64?: string | null;
  audioUrl?: string;
}

export interface ServerArenaComparisonResponse {
  status: string;
  comparison_id: string;
  prompt: string;
  wall_clock_ms: number;
  scorecard: ArenaBenchmarkScorecard;
  left: ServerArenaSideResult;
  right: ServerArenaSideResult;
  preferred_engine_id?: string | null;
}

// --- Studio v16/v17: Per-Shard `.safetensors`/`.onnx` Tensor & Layer Inspector Types ---
export interface ModelShardDescriptor {
  shard_index: number;
  filename: string;
  format: string;
  size_mb: number;
  tensor_count: number;
  sha256: string;
  verified_on_disk: boolean;
  dtype: string;
}

export interface ModelLayerAllocationGroup {
  group: string;
  tensors: number;
  vram_mb: number;
  share_pct: number;
}

export interface ModelShardInspectionResponse {
  engine_id: string;
  model_id: string;
  pipeline_type: string;
  revision: string;
  weight_format: string;
  precision: WeightPrecision;
  weight_tier?: WeightTierId;
  weight_tier_label?: string;
  offload_strategy?: OffloadStrategy;
  lifecycle_state: WeightsLifecycleState;
  total_shards: number;
  verified_shards: number;
  total_tensors: number;
  effective_vram_mb: number;
  disk_size_mb: number;
  sha256_manifest: string;
  local_cache_path: string;
  shards: ModelShardDescriptor[];
  layer_groups: ModelLayerAllocationGroup[];
}

// --- Track 1 (v15–v17): Visual Multi-Modal DAG Composer & Live NDJSON Stream Types ---
export interface DagNodeSpec {
  node_id?: string;
  engine_id: string;
  label?: string;
  parameters?: Record<string, any>;
}

export interface DagPresetBlueprint {
  preset_id: string;
  name: string;
  description: string;
  default_input: string;
  nodes: DagNodeSpec[];
}

export interface DagStageExecutionResult {
  stage_index: number;
  node_id: string;
  label: string;
  engine_id: string;
  model_id: string;
  pipeline_type: string;
  modality: OutputModality;
  latency_ms: number;
  cached: boolean;
  artifact_sha256: string;
  input_preview: string;
  summary: string;
  output: any;
}

export interface DagExecutionResponse {
  status: string;
  dag_run_id: string;
  preset_id: string;
  pipeline_name: string;
  node_count: number;
  total_latency_ms: number;
  cache_hits: number;
  final_sha256: string;
  final_audio_wav_base64?: string | null;
  final_image_data_uri?: string | null;
  stages: DagStageExecutionResult[];
  final_output: any;
}

export interface DagStreamEvent {
  type: "dag_node_start" | "dag_node_complete" | "dag_done";
  dag_run_id: string;
  stage_index?: number;
  total_stages?: number;
  node_id?: string;
  engine_id?: string;
  label?: string;
  pipeline_type?: string;
  input_preview?: string;
  stage?: DagStageExecutionResult;
  preset_id?: string;
  pipeline_name?: string;
  node_count?: number;
  total_latency_ms?: number;
  cache_hits?: number;
  final_sha256?: string;
  final_audio_wav_base64?: string | null;
  final_image_data_uri?: string | null;
  stages?: DagStageExecutionResult[];
  dag_result?: DagExecutionResponse;
}

// --- Track 3 (v15–v17): Persistent SQLite WAL Telemetry & Dataset Exporter Types ---
export interface SqliteTelemetryMetricsSummary {
  total_runs: number;
  total_dag_runs: number;
  total_arena_runs?: number;
  avg_latency_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  total_estimated_cost_usd: number;
  total_compute_units: number;
  cached_dag_artifacts: number;
  by_pipeline_type: Array<{
    pipeline_type: string;
    runs_count: number;
    total_latency_ms: number;
    avg_latency_ms: number;
    total_cost_usd: number;
  }>;
  latency_timeseries: Array<{
    index: number;
    timestamp_iso: string;
    pipeline_type: string;
    latency_ms: number;
  }>;
}

export interface SqliteTelemetryLedgerResponse {
  storage_engine: string;
  db_path: string;
  runs: Array<Record<string, any>>;
  dag_runs: Array<Record<string, any>>;
  arena_runs?: Array<Record<string, any>>;
  arena_comparisons?: Array<Record<string, any>>;
  metrics_summary: SqliteTelemetryMetricsSummary;
}

// --- Pattern 2: Asynchronous Background Jobs & W3C Server-Sent Events (SSE) Types ---
export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface JobProgressInfo {
  step: number;
  total_steps: number;
  percent: number;
  stage: string;
  [key: string]: unknown;
}

export interface JobRecord {
  job_id: string;
  engine_id: string;
  pipeline_type: string;
  status: JobStatus;
  priority: number;
  created_at: number;
  started_at?: number | null;
  completed_at?: number | null;
  latency_ms?: number;
  inputs: unknown;
  parameters: Record<string, unknown>;
  progress: JobProgressInfo;
  result?: unknown;
  error?: { code?: string; message?: string } | null;
  tags?: string[];
  events_url: string;
  status_url: string;
}

export interface SubmitJobRequest {
  engine_id: string;
  pipeline_type?: string;
  inputs: unknown;
  parameters?: Record<string, unknown>;
  priority?: number;
  tags?: string[];
}

export interface JobServerEvent<T = any> {
  id?: number | string;
  event: "queued" | "started" | "progress" | "completed" | "failed" | "cancelled" | "state" | "token" | string;
  data: T;
  timestamp?: number;
}

export interface VieneuSynthesizeRequest {
  engine_id?: string;
  text: string;
  voice?: string;
  ref_audio_path?: string | null;
  denoise_ref?: boolean;
  speed?: number;
  pitch?: number;
  gain_db?: number;
}

export interface VoicePreset {
  label: string;
  voice_id: string;
}

export interface UvProvisionRequest {
  env_id: string;
  python_version?: string;
  packages: string[];
  enable_gpu?: boolean;
  extra_index_url?: string | null;
}

export interface UvEnvironmentSummary {
  env_id: string;
  python_executable: string;
  enable_gpu?: boolean;
  cuda_available?: boolean;
  device_name?: string | null;
  torch_version?: string | null;
  created_at?: number;
}

export interface HFLoadModelRequest {
  engine_id: string;
  task: string;
  model_id: string;
  max_batch_size?: number;
  execution_target?: string;
  precision?: WeightPrecision;
}

export interface HFInferRequest {
  inputs: string | string[];
  parameters?: Record<string, unknown>;
}

export interface SystemHealthResponse {
  status: "healthy" | "degraded" | "offline";
  uptime_seconds?: number;
  isolated_uv_envs?: number;
  weights_summary?: WeightsSummary;
  hardware_profile?: LocalHardwareProfile;
  host_telemetry?: HostHardwareTelemetry;
  telemetry_summary?: SqliteTelemetryMetricsSummary;
  pilot_tts: {
    engine_id: string;
    loaded: boolean;
    streaming_enabled: boolean;
    sample_rate_hz: number;
    cuda_accelerated: boolean;
    circuit_state: string;
    scheduler?: Record<string, unknown>;
  };
  hf_engines: Record<string, Record<string, unknown>>;
}

export type RequestOptions = ClientResilienceOptions;

export interface ClientResilienceOptions {
  timeoutMs?: number;
  maxRetries?: number;
  baseBackoffMs?: number;
  signal?: AbortSignal;
}

export interface SynthesizeResult {
  wavBuffer: ArrayBuffer;
  sampleRate: number;
  durationSeconds: number;
  backendUsed: string;
  requestId: string;
  payloadSha256: string;
}

export function createW3CTraceparent(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const traceId = hex.slice(0, 32);
  const spanId = hex.slice(32, 48);
  return `00-${traceId}-${spanId}-01`;
}

export function parseServerTimingHeader(
  serverTimingHeader: string | null | undefined
): Record<string, number> {
  const result: Record<string, number> = {};
  if (!serverTimingHeader || !serverTimingHeader.trim()) {
    return result;
  }
  for (const metric of serverTimingHeader.split(",")) {
    const parts = metric.split(";").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    const name = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const [k, v] = parts[i].split("=");
      if (k && k.trim().toLowerCase() === "dur" && v !== undefined) {
        const dur = Number(v.trim());
        if (!Number.isNaN(dur)) {
          result[name] = dur;
        }
      }
    }
  }
  return result;
}

export function parseRetryAfterMs(
  retryAfterHeader: string | null | undefined,
  fallbackMs: number,
  maxWaitMs: number = 15_000
): number {
  if (!retryAfterHeader || !retryAfterHeader.trim()) {
    return Math.max(10, Math.min(maxWaitMs, fallbackMs));
  }
  const trimmed = retryAfterHeader.trim();
  const seconds = Number(trimmed);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return Math.max(10, Math.min(maxWaitMs, Math.round(seconds * 1000)));
  }
  const parsedDate = Date.parse(trimmed);
  if (!Number.isNaN(parsedDate)) {
    const deltaMs = parsedDate - Date.now();
    return Math.max(10, Math.min(maxWaitMs, deltaMs));
  }
  return Math.max(10, Math.min(maxWaitMs, fallbackMs));
}

export function pureSha256Hex(bytes: Uint8Array): string {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  const l = bytes.length;
  const bitLen = l * 8;
  const padLen = (l + 9 + 63) & ~63;
  const padded = new Uint8Array(padLen);
  padded.set(bytes);
  padded[l] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, bitLen >>> 0, false);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Int32Array(64);
  const ror = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < padLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = view.getInt32(i + t * 4, false);
    }
    for (let t = 16; t < 64; t++) {
      const s0 = ror(w[t - 15], 7) ^ ror(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = ror(w[t - 2], 17) ^ ror(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t++) {
      const s1 = ror(e, 6) ^ ror(e, 11) ^ ror(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[t] + w[t]) | 0;
      const s0 = ror(a, 2) ^ ror(a, 13) ^ ror(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) | 0;

      h = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }

    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  const out = [h0, h1, h2, h3, h4, h5, h6, h7];
  return out.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

export async function sha256DigestHex(
  input: string | ArrayBuffer | Uint8Array
): Promise<string> {
  let bytes: Uint8Array;
  if (typeof input === "string") {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof Uint8Array) {
    bytes = input;
  } else {
    bytes = new Uint8Array(input);
  }

  // Use hardware-accelerated WebCrypto if in a secure context with crypto.subtle available
  if (
    typeof crypto !== "undefined" &&
    crypto?.subtle &&
    typeof crypto.subtle.digest === "function"
  ) {
    try {
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        bytes as unknown as BufferSource
      );
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch {
      // Fall through to pure JS implementation if digest fails
    }
  }

  // Resilient, pure-JS SHA-256 fallback (works on HTTP IP origins, workers, and non-crypto runtimes)
  return pureSha256Hex(bytes);
}

/**
 * Universal, RFC 4122 v4 compliant random UUID generator.
 * Works reliably across Secure Contexts (HTTPS), non-secure HTTP LAN IP origins
 * (where crypto.randomUUID and crypto.subtle are undefined), Web Workers, and Node/Bun.
 */
export function safeRandomUUID(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto) {
    if (typeof globalThis.crypto.randomUUID === "function") {
      try {
        return (globalThis.crypto as any).randomUUID();
      } catch {
        // Fall through to getRandomValues or Math.random fallback
      }
    }
    if (typeof globalThis.crypto.getRandomValues === "function") {
      try {
        const bytes = new Uint8Array(16);
        globalThis.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC 4122 version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      } catch {
        // Fall through
      }
    }
  }
  // Math.random fallback (valid RFC 4122 v4 string format)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Global polyfill for environments where crypto.randomUUID is not defined (e.g. non-secure LAN HTTP origins)
if (typeof globalThis !== "undefined") {
  try {
    if (!globalThis.crypto) {
      (globalThis as any).crypto = { randomUUID: safeRandomUUID };
    } else if (typeof globalThis.crypto.randomUUID !== "function") {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        value: safeRandomUUID,
        writable: true,
        configurable: true,
      });
    }
  } catch {
    // Ignore polyfill assignment errors in strictly frozen environments
  }
}


export function createNdjsonTransformStream<T = NdjsonStreamEvent>(): TransformStream<
  Uint8Array,
  T
> {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  const parseAndEnqueueLine = (
    rawLine: string,
    controller: TransformStreamDefaultController<T>
  ) => {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith(":")) return;
    const jsonPayload = trimmed.startsWith("data:")
      ? trimmed.slice(5).trim()
      : trimmed;
    if (!jsonPayload || jsonPayload === "[DONE]") return;
    try {
      const parsed = JSON.parse(jsonPayload) as T;
      controller.enqueue(parsed);
    } catch {
      // Skip malformed partial frame
    }
  };

  return new TransformStream<Uint8Array, T>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        parseAndEnqueueLine(line, controller);
      }
    },
    flush(controller) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        for (const line of buffer.split(/\r?\n/)) {
          parseAndEnqueueLine(line, controller);
        }
      }
      buffer = "";
    },
  });
}

/**
 * WinterTC (ECMA-429) & WHATWG Compliant W3C Server-Sent Events TransformStream.
 * Parses raw Uint8Array byte chunks into typed `JobServerEvent` envelopes.
 */
export function createSseTransformStream<T = JobServerEvent>(): TransformStream<
  Uint8Array,
  T
> {
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let currentEvent: { id?: string; event?: string; dataLines: string[] } = {
    dataLines: [],
  };

  const dispatchEvent = (controller: TransformStreamDefaultController<T>) => {
    if (currentEvent.dataLines.length === 0 && !currentEvent.event && !currentEvent.id) {
      return;
    }
    const rawData = currentEvent.dataLines.join("\n");
    let parsedData: unknown = rawData;
    try {
      parsedData = JSON.parse(rawData);
    } catch {
      // Retain raw string payload
    }
    const eventObj = {
      id: currentEvent.id,
      event: currentEvent.event ?? "message",
      data: parsedData,
    };
    controller.enqueue(eventObj as T);
    currentEvent = { dataLines: [] };
  };

  return new TransformStream<Uint8Array, T>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.trim() === "") {
          dispatchEvent(controller);
          continue;
        }
        if (line.startsWith(":")) {
          // SSE comment or keepalive heartbeat
          continue;
        }
        if (line.startsWith("id:")) {
          currentEvent.id = line.slice(3).trim();
        } else if (line.startsWith("event:")) {
          currentEvent.event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          currentEvent.dataLines.push(line.slice(5).trim());
        }
      }
    },
    flush(controller) {
      buffer += decoder.decode();
      if (buffer.trim()) {
        for (const line of buffer.split(/\r?\n/)) {
          if (line.trim() === "") {
            dispatchEvent(controller);
          } else if (line.startsWith("id:")) {
            currentEvent.id = line.slice(3).trim();
          } else if (line.startsWith("event:")) {
            currentEvent.event = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            currentEvent.dataLines.push(line.slice(5).trim());
          }
        }
      }
      dispatchEvent(controller);
      buffer = "";
    },
  });
}

export async function buildMultimodalFormData(payload: PolymorphicInferRequest): Promise<{
  formData: FormData;
  contentSha256: string;
  metaHeader: string;
}> {
  const formData = new FormData();
  const inputsStr =
    typeof payload.inputs === "string"
      ? payload.inputs
      : JSON.stringify(payload.inputs ?? "");
  const paramsStr = JSON.stringify(payload.parameters ?? {});

  formData.append("inputs", inputsStr);
  formData.append("parameters", paramsStr);
  if (payload.slots) {
    formData.append("slots", JSON.stringify(payload.slots));
  }

  let contentSha256: string;
  let filename = payload.filename ?? "cockpit_blob.bin";
  let mimeType = "application/octet-stream";

  if (payload.file) {
    if ("name" in payload.file && typeof payload.file.name === "string" && payload.file.name) {
      filename = payload.file.name;
    }
    if (payload.file.type) {
      mimeType = payload.file.type;
    }
    formData.append("file", payload.file, filename);
    const fileBuf = await payload.file.arrayBuffer();
    const metaBytes = new TextEncoder().encode(`${inputsStr}|${paramsStr}|`);
    const combined = new Uint8Array(metaBytes.byteLength + fileBuf.byteLength);
    combined.set(metaBytes, 0);
    combined.set(new Uint8Array(fileBuf), metaBytes.byteLength);
    contentSha256 = await sha256DigestHex(combined);
  } else {
    contentSha256 = await sha256DigestHex(`${inputsStr}|${paramsStr}`);
  }

  const metaHeader = encodeURIComponent(
    JSON.stringify({
      inputs: payload.inputs ?? "",
      parameters: payload.parameters ?? {},
      slots: payload.slots ?? {},
      filename,
      mime_type: mimeType,
    })
  );

  return { formData, contentSha256, metaHeader };
}

export function createPcmFrameTransformStream(): TransformStream<Uint8Array, Float32Array> {
  let headerChecked = false;
  let headerStaging = new Uint8Array(0);
  let leftoverByte: number | null = null;

  const enqueuePcmBytes = (
    rawData: Uint8Array,
    controller: TransformStreamDefaultController<Float32Array>
  ) => {
    let data = rawData;
    if (leftoverByte !== null) {
      const merged = new Uint8Array(1 + data.byteLength);
      merged[0] = leftoverByte;
      merged.set(data, 1);
      data = merged;
      leftoverByte = null;
    }

    const evenLength = data.byteLength - (data.byteLength % 2);
    if (data.byteLength % 2 === 1) {
      leftoverByte = data[data.byteLength - 1];
    }

    if (evenLength > 0) {
      const view = new DataView(data.buffer, data.byteOffset, evenLength);
      const sampleCount = evenLength / 2;
      const float32 = new Float32Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        const int16 = view.getInt16(i * 2, true);
        float32[i] = int16 / 32768.0;
      }
      controller.enqueue(float32);
    }
  };

  return new TransformStream<Uint8Array, Float32Array>({
    transform(chunk, controller) {
      if (!chunk || chunk.byteLength === 0) return;

      if (!headerChecked) {
        const combined = new Uint8Array(headerStaging.byteLength + chunk.byteLength);
        combined.set(headerStaging, 0);
        combined.set(chunk, headerStaging.byteLength);

        if (combined.byteLength < 44) {
          headerStaging = combined;
          return;
        }

        headerChecked = true;
        headerStaging = new Uint8Array(0);
        const isRiffWav =
          combined[0] === 0x52 &&
          combined[1] === 0x49 &&
          combined[2] === 0x46 &&
          combined[3] === 0x46 &&
          combined[8] === 0x57 &&
          combined[9] === 0x41 &&
          combined[10] === 0x56 &&
          combined[11] === 0x45;

        const payload = isRiffWav ? combined.subarray(44) : combined;
        if (payload.byteLength > 0) {
          enqueuePcmBytes(payload, controller);
        }
        return;
      }

      enqueuePcmBytes(chunk, controller);
    },
    flush(controller) {
      if (!headerChecked && headerStaging.byteLength > 0) {
        headerChecked = true;
        enqueuePcmBytes(headerStaging, controller);
        headerStaging = new Uint8Array(0);
      }
      leftoverByte = null;
    },
  });
}

export function sanitizeHeadersInit(headersInit?: HeadersInit): Headers {
  const headers = new Headers();
  if (!headersInit) return headers;

  const sanitizeVal = (val: string): string => {
    for (let i = 0; i < val.length; i++) {
      if (val.charCodeAt(i) > 255) {
        return encodeURIComponent(val);
      }
    }
    return val;
  };

  if (headersInit instanceof Headers) {
    headersInit.forEach((value, key) => {
      headers.set(key, sanitizeVal(value));
    });
  } else if (Array.isArray(headersInit)) {
    for (const [key, value] of headersInit) {
      if (value !== undefined && value !== null) {
        headers.set(key, sanitizeVal(String(value)));
      }
    }
  } else if (typeof headersInit === "object") {
    for (const [key, value] of Object.entries(headersInit as Record<string, unknown>)) {
      if (value !== undefined && value !== null) {
        headers.set(key, sanitizeVal(String(value)));
      }
    }
  }
  return headers;
}

export class AIInferenceClient {
  private readonly baseUrl: string;
  private readonly fallbackBaseUrls: string[];
  private readonly defaultTimeoutMs: number;
  private readonly defaultMaxRetries: number;
  private readonly defaultBaseBackoffMs: number;

  constructor(
    baseUrlOrOptions:
      | string
      | {
          baseUrl?: string;
          baseUrls?: string[];
          timeoutMs?: number;
          maxRetries?: number;
          baseBackoffMs?: number;
          fallbackBaseUrls?: string[];
        } = "",
    options?: {
      timeoutMs?: number;
      maxRetries?: number;
      baseBackoffMs?: number;
      fallbackBaseUrls?: string[];
    }
  ) {
    let resolvedBaseUrl = "";
    let mergedOptions = options;

    if (typeof baseUrlOrOptions === "string") {
      resolvedBaseUrl = baseUrlOrOptions;
    } else if (baseUrlOrOptions && typeof baseUrlOrOptions === "object") {
      resolvedBaseUrl =
        baseUrlOrOptions.baseUrl ??
        baseUrlOrOptions.baseUrls?.[0] ??
        "";
      mergedOptions = {
        ...baseUrlOrOptions,
        ...options,
        fallbackBaseUrls:
          baseUrlOrOptions.fallbackBaseUrls ??
          (baseUrlOrOptions.baseUrls && baseUrlOrOptions.baseUrls.length > 1
            ? baseUrlOrOptions.baseUrls.slice(1)
            : options?.fallbackBaseUrls),
      };
    }

    this.baseUrl = (resolvedBaseUrl || "").replace(/\/+$/, "");
    this.fallbackBaseUrls = mergedOptions?.fallbackBaseUrls ?? [
      "",
      "http://127.0.0.1:50051",
      "http://localhost:50051",
      "http://127.0.0.1:8000",
      "http://localhost:8000",
    ];
    this.defaultTimeoutMs = mergedOptions?.timeoutMs ?? 30_000;
    this.defaultMaxRetries = mergedOptions?.maxRetries ?? 2;
    this.defaultBaseBackoffMs = mergedOptions?.baseBackoffMs ?? 250;
  }

  private getCandidateUrls(path: string): string[] {
    const candidates = [
      this.baseUrl,
      ...this.fallbackBaseUrls.map((u) => u.replace(/\/+$/, "")),
    ];
    const uniqueBases = Array.from(new Set(candidates));
    return uniqueBases.map((base) => `${base}${path}`);
  }

  private async fetchWithResilience(
    path: string,
    init: RequestInit,
    options?: ClientResilienceOptions
  ): Promise<Response> {
    const maxRetries = options?.maxRetries ?? this.defaultMaxRetries;
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    const baseBackoffMs = options?.baseBackoffMs ?? this.defaultBaseBackoffMs;
    const requestId = safeRandomUUID();
    const candidateUrls = this.getCandidateUrls(path);

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      for (const targetUrl of candidateUrls) {
        const timeoutController = new AbortController();
        const timer = setTimeout(
          () => timeoutController.abort(new DOMException("Request timed out", "TimeoutError")),
          timeoutMs
        );

        const onExternalAbort = () => timeoutController.abort(options?.signal?.reason);
        if (options?.signal) {
          if (options.signal.aborted) {
            clearTimeout(timer);
            throw options.signal.reason ?? new DOMException("Aborted", "AbortError");
          }
          options.signal.addEventListener("abort", onExternalAbort, { once: true });
        }

        try {
          const headers = sanitizeHeadersInit(init.headers);
          if (!headers.has("X-Request-ID")) {
            headers.set("X-Request-ID", requestId);
          }
          if (!headers.has("traceparent")) {
            headers.set("traceparent", createW3CTraceparent());
          }

          const response = await fetch(targetUrl, {
            ...init,
            headers,
            signal: timeoutController.signal,
          });

          if ((response.status === 502 || response.status === 504) && targetUrl.startsWith("/")) {
            continue;
          }

          if ([429, 502, 503, 504].includes(response.status) && attempt < maxRetries) {
            const jitter = Math.random() * 100;
            const computedBackoff = baseBackoffMs * Math.pow(2, attempt) + jitter;
            const delay = parseRetryAfterMs(
              response.headers.get("Retry-After"),
              computedBackoff
            );
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }

          return response;
        } catch (err: any) {
          lastError = err;
          if (options?.signal?.aborted) {
            throw err;
          }
          continue;
        } finally {
          clearTimeout(timer);
          options?.signal?.removeEventListener("abort", onExternalAbort);
        }
      }

      if (attempt < maxRetries) {
        const jitter = Math.random() * 100;
        const delay = baseBackoffMs * Math.pow(2, attempt) + jitter;
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    const detail =
      lastError instanceof Error ? lastError.message : String(lastError ?? "Unknown network error");
    throw new Error(
      `Network connection to FastAPI backend failed (${detail}). Ensure the backend is running on port 8000 (\`pnpm dev\` or \`pnpm moon run ai-control-plane:dev\`).`
    );
  }

  private static async extractErrorDetail(response: Response): Promise<string> {
    const { detail } = await AIInferenceClient.parseError(response);
    return detail;
  }

  private static async parseError(response: Response): Promise<{ detail: string; data?: any }> {
    const text = await response.text();
    let data: any = undefined;
    let detail = text || `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text);
      data = parsed;
      if (parsed && typeof parsed.detail === "string") {
        detail = parsed.title ? `[${parsed.title}] ${parsed.detail}` : parsed.detail;
      } else if (parsed && typeof parsed.message === "string") {
        detail = parsed.title ? `[${parsed.title}] ${parsed.message}` : parsed.message;
      }
    } catch {
      // Not JSON
    }
    return { detail, data };
  }

  // ==========================================================================
  // STUDIO v17: HARDWARE CAPABILITY PROFILER & 5-TIER WEIGHT ADAPTATION
  // ==========================================================================

  /**
   * Studio v17: Fetch Local Hardware Profile, Host Telemetry & 5-Tier Compatibility Matrix (`GET /v1/hardware/profile`).
   */
  async fetchHardwareProfile(
    options?: ClientResilienceOptions
  ): Promise<HardwareProfileSnapshotResponse> {
    const response = await this.fetchWithResilience(
      "/v1/hardware/profile",
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch hardware profile (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as HardwareProfileSnapshotResponse;
  }

  /**
   * Studio v17: Switch Local Hardware Power Profile (`tier_1_edge_cpu` .. `tier_5_datacenter_48gb`) & Auto-Adapt Models (`POST /v1/hardware/profile`).
   */
  async selectHardwareProfile(
    payload: {
      profile_id: HardwareProfileId;
      custom_vram_budget_mb?: number;
      auto_adapt_models?: boolean;
    },
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    active_profile_id: HardwareProfileId;
    active_profile: LocalHardwareProfile;
    adapted_models_count: number;
    adapted_models: Array<Record<string, any>>;
    auto_evicted_engines: string[];
    models: ModelCatalogEntry[];
    weights_summary: WeightsSummary;
    hardware_snapshot: HardwareProfileSnapshotResponse;
  }> {
    const response = await this.fetchWithResilience(
      "/v1/hardware/profile",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to select hardware profile (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as any;
  }

  /**
   * Studio v17: Switch a Specific Model to a Named Weight Tier (`nano_int4`, `compact_int8`, `balanced_fp16`, `studio_bf16`, `ultra_fp32`).
   */
  async setModelWeightTier(
    engineId: string,
    payload: {
      tier_id: WeightTierId;
      offload_strategy?: OffloadStrategy;
    },
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    engine_id: string;
    weight_tier: WeightTierId;
    precision: WeightPrecision;
    offload_strategy: OffloadStrategy;
    effective_vram_mb: number;
    effective_ram_mb: number;
    effective_disk_mb: number;
    quantization_savings_pct: number;
    model: ModelCatalogEntry;
    weights?: ModelWeightsDescriptor;
    weights_summary: WeightsSummary;
  }> {
    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/weights/tier`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to update weight tier for '${engineId}' (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as any;
  }

  /**
   * Studio v17: Update Model Memory Offload Mode (`POST /v1/models/{engine_id}/weights/offload`).
   */
  async setModelOffloadStrategy(
    engineId: string,
    offloadStrategy: OffloadStrategy,
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    engine_id: string;
    offload_strategy: OffloadStrategy;
    effective_vram_mb: number;
    effective_ram_mb: number;
    model: ModelCatalogEntry;
    weights_summary?: WeightsSummary;
  }> {
    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/weights/offload`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offload_strategy: offloadStrategy }),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to update offload strategy for '${engineId}' (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as any;
  }

  /**
   * Studio v17: 1-Click Auto-Adapt All Catalog Models to Active Local Hardware Power (`POST /v1/models/hardware/auto-adapt`).
   */
  async autoAdaptModelsToHardware(
    profileId?: HardwareProfileId,
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    active_profile: LocalHardwareProfile;
    adapted_models: Array<Record<string, any>>;
    auto_evicted_engines: string[];
    models: ModelCatalogEntry[];
    weights_summary: WeightsSummary;
  }> {
    const response = await this.fetchWithResilience(
      "/v1/models/hardware/auto-adapt",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: profileId ?? null }),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Hardware auto-adapt failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as any;
  }

  // ==========================================================================
  // PILLAR 1, 4 & v15/v16: CATALOG, HUB RESOLVER, DAG STREAMING, ARENA & SHARDS
  // ==========================================================================

  async fetchModelCatalog(options?: ClientResilienceOptions): Promise<ModelCatalogResponse> {
    const response = await this.fetchWithResilience(
      "/v1/models/catalog",
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch model catalog (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as ModelCatalogResponse;
  }

  async discoverHubModels(
    params?: {
      query?: string;
      pipeline_category?: string;
      pipeline_type?: string;
    },
    options?: ClientResilienceOptions
  ): Promise<HubDiscoveryResponse> {
    const search = new URLSearchParams();
    if (params?.query) search.set("query", params.query);
    if (params?.pipeline_category) search.set("pipeline_category", params.pipeline_category);
    if (params?.pipeline_type) search.set("pipeline_type", params.pipeline_type);
    const qs = search.toString();
    const response = await this.fetchWithResilience(
      `/v1/models/hub/discover${qs ? `?${qs}` : ""}`,
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to discover Hub models (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as HubDiscoveryResponse;
  }

  async resolveHubModel(
    modelId: string,
    task?: string,
    options?: ClientResilienceOptions
  ): Promise<HubResolveResponse> {
    const search = new URLSearchParams({ model_id: modelId });
    if (task) search.set("task", task);
    const response = await this.fetchWithResilience(
      `/v1/models/hub/resolve?${search.toString()}`,
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to resolve Hub model '${modelId}' (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as HubResolveResponse;
  }

  async installHubModel(
    payload: HubInstallRequest,
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    engine_id: string;
    model: ModelCatalogEntry;
    weights_summary: WeightsSummary;
  }> {
    const response = await this.fetchWithResilience(
      "/v1/models/hub/install",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      options
    );
    if (!response.ok) {
      const { detail, data } = await AIInferenceClient.parseError(response);
      const error: any = new Error(
        `Hub install failed (${response.status}): ${detail}`
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return (await response.json()) as any;
  }

  async inspectModelWeightsShards(
    engineId: string,
    options?: ClientResilienceOptions
  ): Promise<ModelShardInspectionResponse> {
    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/weights/inspect`,
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to inspect shards for '${engineId}' (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as ModelShardInspectionResponse;
  }

  async fetchDagPresets(
    options?: ClientResilienceOptions
  ): Promise<{ presets: DagPresetBlueprint[] }> {
    const response = await this.fetchWithResilience(
      "/v1/pipelines/dag/presets",
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch DAG presets (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as { presets: DagPresetBlueprint[] };
  }

  async executeDagPipeline(
    payload: {
      preset_id?: string;
      pipeline_name?: string;
      initial_input?: unknown;
      nodes?: DagNodeSpec[];
      enable_cache?: boolean;
    },
    options?: ClientResilienceOptions
  ): Promise<DagExecutionResponse> {
    const response = await this.fetchWithResilience(
      "/v1/pipelines/dag/execute",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `DAG pipeline execution failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as DagExecutionResponse;
  }

  async streamDagPipeline(
    payload: {
      preset_id?: string;
      pipeline_name?: string;
      initial_input?: unknown;
      nodes?: DagNodeSpec[];
      enable_cache?: boolean;
    },
    options?: ClientResilienceOptions
  ): Promise<ReadableStream<DagStreamEvent>> {
    const bodyStr = JSON.stringify(payload);
    const payloadSha256 = await sha256DigestHex(bodyStr);
    const response = await this.fetchWithResilience(
      "/v1/pipelines/dag/stream",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Content-SHA256": payloadSha256,
        },
        body: bodyStr,
      },
      { ...options, maxRetries: 0 }
    );
    if (!response.ok || !response.body) {
      throw new Error(
        `DAG streaming failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return response.body.pipeThrough(createNdjsonTransformStream<DagStreamEvent>());
  }

  async compareModelsInArena(
    payload: {
      left_engine_id: string;
      right_engine_id: string;
      inputs?: unknown;
      left_parameters?: Record<string, unknown>;
      right_parameters?: Record<string, unknown>;
    },
    options?: ClientResilienceOptions
  ): Promise<ServerArenaComparisonResponse> {
    const response = await this.fetchWithResilience(
      "/v1/models/arena/compare",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Server-side A/B Arena comparison failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as ServerArenaComparisonResponse;
  }

  async voteArenaWinner(
    comparisonId: string,
    preferredEngineId: string,
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    comparison_id: string;
    preferred_engine_id: string;
    updated: boolean;
  }> {
    const response = await this.fetchWithResilience(
      `/v1/models/arena/${encodeURIComponent(comparisonId)}/vote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferred_engine_id: preferredEngineId }),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Arena vote failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as any;
  }

  async fetchTelemetryLedger(
    params?: { limit?: number; pipeline_type?: string },
    options?: ClientResilienceOptions
  ): Promise<SqliteTelemetryLedgerResponse> {
    const search = new URLSearchParams();
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.pipeline_type) search.set("pipeline_type", params.pipeline_type);
    const qs = search.toString();
    const response = await this.fetchWithResilience(
      `/v1/telemetry/ledger${qs ? `?${qs}` : ""}`,
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch SQLite telemetry ledger (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as SqliteTelemetryLedgerResponse;
  }

  async clearTelemetryLedger(
    options?: ClientResilienceOptions
  ): Promise<{ status: string; storage_engine: string }> {
    const response = await this.fetchWithResilience(
      "/v1/telemetry/ledger",
      { method: "DELETE" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to clear SQLite telemetry ledger (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as { status: string; storage_engine: string };
  }

  async exportTelemetryDataset(
    format: "jsonl" | "csv" = "jsonl",
    options?: ClientResilienceOptions
  ): Promise<string> {
    const response = await this.fetchWithResilience(
      `/v1/telemetry/export?format=${encodeURIComponent(format)}`,
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Dataset export failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return await response.text();
  }

  async batchWeightsAction(
    payload: {
      action: "prefetch_category" | "evict_unpinned" | "auto_adapt_hardware";
      pipeline_category?: string;
      hardware_profile_id?: HardwareProfileId;
    },
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    action: string;
    affected_engines: string[];
    weights_summary: WeightsSummary;
  }> {
    const response = await this.fetchWithResilience(
      "/v1/models/weights/batch-action",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Batch weights action failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as any;
  }

  async fetchPipelineTaxonomy(
    options?: ClientResilienceOptions
  ): Promise<PipelineTaxonomyTreeResponse> {
    const response = await this.fetchWithResilience(
      "/v1/models/pipelines",
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch pipeline taxonomy (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as PipelineTaxonomyTreeResponse;
  }

  async prefetchModelWeights(
    engineId: string,
    revision?: string,
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    engine_id: string;
    weights: ModelWeightsDescriptor;
    model: ModelCatalogEntry;
    weights_summary: WeightsSummary;
  }> {
    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/weights/prefetch`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: revision ?? null }),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Weights prefetch failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as any;
  }

  async quantizeModelWeights(
    engineId: string,
    precision: WeightPrecision,
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    engine_id: string;
    precision: WeightPrecision;
    weight_tier?: WeightTierId;
    effective_vram_mb: number;
    effective_ram_mb: number;
    quantization_savings_pct?: number;
    model: ModelCatalogEntry;
    weights_summary: WeightsSummary;
  }> {
    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/weights/quantize`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ precision }),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Precision update failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as any;
  }

  async pinModelInVram(
    engineId: string,
    pinned: boolean,
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    engine_id: string;
    pinned_in_vram: boolean;
    model: ModelCatalogEntry;
    weights_summary: WeightsSummary;
  }> {
    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/weights/pin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned }),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Pin update failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as any;
  }

  async purgeModelWeightsCache(
    engineId: string,
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    engine_id: string;
    reclaimed_disk_mb: number;
    lifecycle_state: WeightsLifecycleState;
    model: ModelCatalogEntry;
    weights_summary: WeightsSummary;
  }> {
    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/weights/cache`,
      { method: "DELETE" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Disk cache purge failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as any;
  }

  async configureVramBudget(
    maxVramBudgetMb: number,
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    max_vram_budget_mb: number;
    auto_evicted_engines: string[];
    weights_summary: WeightsSummary;
  }> {
    const response = await this.fetchWithResilience(
      "/v1/models/vram/budget",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_vram_budget_mb: maxVramBudgetMb }),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `VRAM budget update failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as any;
  }

  async loadCatalogModel(
    payload: CatalogLoadRequest,
    options?: ClientResilienceOptions
  ): Promise<{ status: string; model: ModelCatalogEntry; weights_summary?: WeightsSummary }> {
    const response = await this.fetchWithResilience(
      "/v1/models/catalog/load",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { ...options, maxRetries: 0, timeoutMs: options?.timeoutMs ?? 180_000 }
    );
    if (!response.ok) {
      const { detail, data } = await AIInferenceClient.parseError(response);
      const error: any = new Error(
        `Model load failed (${response.status}): ${detail}`
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return (await response.json()) as {
      status: string;
      model: ModelCatalogEntry;
      weights_summary?: WeightsSummary;
    };
  }

  async getUvEnvironmentStatus(
    envId: string,
    options?: ClientResilienceOptions
  ): Promise<GpuSandboxStatusResponse> {
    const response = await this.fetchWithResilience(
      `/v1/environments/uv/${encodeURIComponent(envId)}/status`,
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch uv environment status for '${envId}' (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as GpuSandboxStatusResponse;
  }

  async getGpuSandboxStatus(
    envId: string = "vision-worker",
    options?: ClientResilienceOptions
  ): Promise<GpuSandboxStatusResponse> {
    return this.getUvEnvironmentStatus(envId, options);
  }

  async provisionGpuSandbox(
    envId: string = "vision-worker",
    packages: string[] = [
      "torch",
      "torchvision",
      "torchaudio",
      "diffusers",
      "transformers",
      "accelerate",
      "safetensors",
    ],
    options?: ClientResilienceOptions
  ): Promise<Record<string, unknown>> {
    return this.provisionUvEnvironment(
      {
        env_id: envId,
        python_version: "3.12",
        packages,
        enable_gpu: true,
      },
      options
    );
  }

  async warmupModel(
    engineId: string,
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    engine_id: string;
    warmup_latency_ms: number;
    model: ModelCatalogEntry;
    weights_summary?: WeightsSummary;
  }> {
    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/warmup`,
      { method: "POST" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Warmup failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as any;
  }

  async unloadModel(
    engineId: string,
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    engine_id: string;
    reclaimed_vram_mb: number;
    reclaimed_ram_mb: number;
    cuda_cache_cleared: boolean;
    model: ModelCatalogEntry;
    weights_summary?: WeightsSummary;
  }> {
    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/unload`,
      { method: "POST" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Model eviction failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as any;
  }

  async inferModel(
    engineId: string,
    payload: PolymorphicInferRequest,
    options?: ClientResilienceOptions
  ): Promise<PolymorphicInferenceResult> {
    const t0 = performance.now();
    let requestInit: RequestInit;
    let payloadSha256: string;

    if (payload.file) {
      const built = await buildMultimodalFormData(payload);
      payloadSha256 = built.contentSha256;
      requestInit = {
        method: "POST",
        headers: {
          "X-Content-SHA256": payloadSha256,
          "X-Inference-Meta": built.metaHeader,
        },
        body: built.formData,
      };
    } else {
      const bodyStr = JSON.stringify({
        inputs: payload.inputs ?? "",
        parameters: payload.parameters ?? {},
        ...(payload.slots ? { slots: payload.slots } : {}),
        auto_load: payload.auto_load ?? true,
      });
      payloadSha256 = await sha256DigestHex(bodyStr);
      requestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Content-SHA256": payloadSha256,
        },
        body: bodyStr,
      };
    }

    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/infer`,
      requestInit,
      options
    );

    if (!response.ok) {
      throw new Error(
        `Inference on '${engineId}' failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }

    const roundtripMs = Math.round((performance.now() - t0) * 10) / 10;
    const requestId = response.headers.get("X-Request-ID") ?? safeRandomUUID();
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("audio/wav")) {
      const wavBuffer = await response.arrayBuffer();
      const sampleRate = Number(response.headers.get("X-Sample-Rate") ?? "48000");
      const durationSeconds = Number(response.headers.get("X-Audio-Duration-Sec") ?? "0");
      const backendUsed = response.headers.get("X-Backend-Engine") ?? engineId;
      const executionTarget = response.headers.get("X-Execution-Target") ?? "host-venv";
      const pipelineType = response.headers.get("X-Pipeline-Type") ?? "text-to-speech";

      return {
        engineId,
        modelId: engineId,
        family: "tts",
        pipelineCategory: "audio_speech",
        pipelineType,
        task: "text-to-speech",
        modality: "pcm_audio",
        device: backendUsed,
        executionTarget,
        requestId,
        payloadSha256,
        roundtripMs,
        wavBuffer,
        sampleRate,
        durationSeconds,
        output: {
          modality: "pcm_audio",
          sample_rate: sampleRate,
          duration_seconds: durationSeconds,
          backend_used: backendUsed,
        },
      };
    }

    const data = (await response.json()) as {
      engine_id: string;
      model_id: string;
      family: ModalityFamily;
      pipeline_category?: PipelineCategoryId;
      pipeline_type?: string;
      task: string;
      modality: OutputModality;
      device: string;
      execution_target: string;
      payload_sha256?: string;
      output: any;
    };

    return {
      engineId: data.engine_id ?? engineId,
      modelId: data.model_id ?? engineId,
      family: data.family ?? "classification",
      pipelineCategory: data.pipeline_category,
      pipelineType: data.pipeline_type,
      task: data.task ?? "inference",
      modality: data.modality ?? "classification",
      device: data.device ?? "cpu",
      executionTarget: data.execution_target ?? "host-venv",
      requestId,
      payloadSha256: data.payload_sha256 || payloadSha256,
      roundtripMs,
      output: data.output,
    };
  }

  async streamModelNdjson<T = NdjsonStreamEvent>(
    engineId: string,
    payload: { inputs: unknown; parameters?: Record<string, unknown>; slots?: Record<string, unknown>; auto_load?: boolean },
    options?: ClientResilienceOptions
  ): Promise<ReadableStream<T>> {
    const bodyStr = JSON.stringify({
      inputs: payload.inputs,
      parameters: payload.parameters ?? {},
      ...(payload.slots ? { slots: payload.slots } : {}),
      auto_load: payload.auto_load ?? true,
    });
    const payloadSha256 = await sha256DigestHex(bodyStr);

    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Content-SHA256": payloadSha256,
        },
        body: bodyStr,
      },
      { ...options, maxRetries: 0 }
    );

    if (!response.ok || !response.body) {
      throw new Error(
        `NDJSON stream for '${engineId}' failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }

    return response.body.pipeThrough(createNdjsonTransformStream<T>());
  }

  /**
   * Pattern 1: Real-Time Token / Step Streaming using standard W3C Server-Sent Events (SSE).
   */
  async streamModelSse<T = JobServerEvent>(
    engineId: string,
    payload: { inputs: unknown; parameters?: Record<string, unknown>; slots?: Record<string, unknown>; auto_load?: boolean },
    options?: ClientResilienceOptions
  ): Promise<ReadableStream<T>> {
    const bodyStr = JSON.stringify({
      inputs: payload.inputs,
      parameters: { ...(payload.parameters ?? {}), format: "sse" },
      ...(payload.slots ? { slots: payload.slots } : {}),
      auto_load: payload.auto_load ?? true,
    });
    const payloadSha256 = await sha256DigestHex(bodyStr);

    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "text/event-stream",
          "X-Content-SHA256": payloadSha256,
        },
        body: bodyStr,
      },
      { ...options, maxRetries: 0 }
    );

    if (!response.ok || !response.body) {
      throw new Error(
        `SSE stream for '${engineId}' failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }

    return response.body.pipeThrough(createSseTransformStream<T>());
  }

  // ==========================================================================
  // PATTERN 2: ASYNCHRONOUS BACKGROUND JOBS & SERVER-SENT EVENTS (SSE)
  // ==========================================================================

  /**
   * Submit an asynchronous inference job returning HTTP 202 Accepted and JobRecord.
   */
  async submitJob(
    payload: SubmitJobRequest,
    options?: ClientResilienceOptions
  ): Promise<JobRecord> {
    const response = await this.fetchWithResilience(
      "/v1/jobs",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Job submission failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as JobRecord;
  }

  /**
   * One-shot status inspection for an asynchronous inference job.
   */
  async getJob(
    jobId: string,
    options?: ClientResilienceOptions
  ): Promise<JobRecord> {
    const response = await this.fetchWithResilience(
      `/v1/jobs/${encodeURIComponent(jobId)}`,
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch job '${jobId}' (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as JobRecord;
  }

  /**
   * Cooperative cancellation of a queued or running inference job.
   */
  async cancelJob(
    jobId: string,
    options?: ClientResilienceOptions
  ): Promise<{ status: string; job_id: string; message: string }> {
    const response = await this.fetchWithResilience(
      `/v1/jobs/${encodeURIComponent(jobId)}`,
      { method: "DELETE" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to cancel job '${jobId}' (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as { status: string; job_id: string; message: string };
  }

  /**
   * List recent background inference jobs with optional status/engine filters.
   */
  async listJobs(
    params?: { status?: JobStatus; engine_id?: string; limit?: number },
    options?: ClientResilienceOptions
  ): Promise<{ total: number; jobs: JobRecord[] }> {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.engine_id) search.set("engine_id", params.engine_id);
    if (params?.limit) search.set("limit", String(params.limit));
    const qs = search.toString();

    const response = await this.fetchWithResilience(
      `/v1/jobs${qs ? `?${qs}` : ""}`,
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to list jobs (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as { total: number; jobs: JobRecord[] };
  }

  /**
   * Connect to the persistent Server-Sent Events stream for real-time lifecycle and progress push.
   */
  async streamJobEvents(
    jobId: string,
    options?: { lastEventId?: string | number; signal?: AbortSignal }
  ): Promise<ReadableStream<JobServerEvent>> {
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
    };
    if (options?.lastEventId !== undefined) {
      headers["Last-Event-ID"] = String(options.lastEventId);
    }

    const response = await this.fetchWithResilience(
      `/v1/jobs/${encodeURIComponent(jobId)}/events`,
      {
        method: "GET",
        headers,
        signal: options?.signal,
      },
      { maxRetries: 0 }
    );

    if (!response.ok || !response.body) {
      throw new Error(
        `Job event stream for '${jobId}' failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }

    return response.body.pipeThrough(createSseTransformStream<JobServerEvent>());
  }

  /**
   * High-level helper: Submits a job, subscribes to its SSE stream, triggers onProgress,
   * and resolves with the final JobRecord on completion.
   */
  async executeJobAndWait(
    payload: SubmitJobRequest,
    onProgress?: (event: JobServerEvent) => void,
    signal?: AbortSignal
  ): Promise<JobRecord> {
    const job = await this.submitJob(payload);
    const eventStream = await this.streamJobEvents(job.job_id, { signal });
    const reader = eventStream.getReader();

    try {
      while (true) {
        const { value: ev, done } = await reader.read();
        if (done) break;
        if (!ev) continue;

        if (onProgress) {
          onProgress(ev);
        }

        const dataStatus = (ev.data as Record<string, any>)?.status;

        if (ev.event === "completed" || dataStatus === "completed") {
          try {
            return await this.getJob(job.job_id);
          } catch {
            const d = (ev.data || {}) as Record<string, any>;
            return {
              job_id: job.job_id,
              engine_id: payload.engine_id,
              pipeline_type: payload.pipeline_type ?? "inference",
              status: "completed",
              priority: 0,
              created_at: Date.now(),
              inputs: payload.inputs,
              parameters: payload.parameters ?? {},
              result: d.result ?? d.output ?? d,
              progress: { step: 1, total_steps: 1, percent: 100, stage: "completed" },
              events_url: `/v1/jobs/${job.job_id}/events`,
              status_url: `/v1/jobs/${job.job_id}`,
            };
          }
        }
        if (ev.event === "failed" || dataStatus === "failed") {
          const errData = ev.data as Record<string, any>;
          throw new Error(
            errData?.error?.message || errData?.message || `Job '${job.job_id}' failed.`
          );
        }
        if (ev.event === "cancelled" || dataStatus === "cancelled") {
          throw new Error(`Job '${job.job_id}' was cancelled.`);
        }
      }

      // Stream closed before receiving terminal event: fallback to polling until completion
      let latestJob = await this.getJob(job.job_id);
      let pollDelay = 250;
      let attempts = 0;
      const maxAttempts = 60;
      while (
        latestJob.status !== "completed" &&
        latestJob.status !== "failed" &&
        latestJob.status !== "cancelled" &&
        attempts < maxAttempts
      ) {
        if (signal?.aborted) {
          throw new DOMException("Aborted", "AbortError");
        }
        await new Promise((r) => setTimeout(r, pollDelay));
        pollDelay = Math.min(pollDelay * 1.5, 2000);
        latestJob = await this.getJob(job.job_id);
        attempts++;
        if (onProgress) {
          onProgress({
            id: String(attempts),
            event: latestJob.status === "completed" ? "completed" : "progress",
            data: latestJob,
          });
        }
      }

      if (latestJob.status === "failed") {
        throw new Error(latestJob.error?.message || `Job '${job.job_id}' failed.`);
      }
      if (latestJob.status === "cancelled") {
        throw new Error(`Job '${job.job_id}' was cancelled.`);
      }
      return latestJob;
    } finally {
      reader.releaseLock();
    }
  }

  async runArenaComparison(
    engineLeftId: string,
    engineRightId: string,
    payload: PolymorphicInferRequest,
    options?: ClientResilienceOptions
  ): Promise<ArenaComparisonResult> {
    const t0 = performance.now();
    const [left, right] = await Promise.all([
      this.inferModel(engineLeftId, payload, options),
      this.inferModel(engineRightId, payload, options),
    ]);
    const wallClockMs = Math.round((performance.now() - t0) * 10) / 10;
    return { left, right, wallClockMs };
  }

  async listVoices(
    engineIdOrOptions?: string | ClientResilienceOptions,
    options?: ClientResilienceOptions
  ): Promise<VoicePreset[]> {
    return this.fetchVoices(engineIdOrOptions, options);
  }

  async fetchVoices(
    engineIdOrOptions?: string | ClientResilienceOptions,
    options?: ClientResilienceOptions
  ): Promise<VoicePreset[]> {
    const engineId = typeof engineIdOrOptions === "string" ? engineIdOrOptions : "vieneu-tts-v3-turbo";
    const opts = typeof engineIdOrOptions === "object" ? engineIdOrOptions : options;
    return this.fetchModelVoices(engineId, opts);
  }

  async fetchModelVoices(
    engineId: string = "vieneu-tts-v3-turbo",
    options?: ClientResilienceOptions
  ): Promise<VoicePreset[]> {
    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/voices`,
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to fetch voices for '${engineId}' (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    const data = (await response.json()) as { voices: any[] };
    return (data.voices || []).map((v: any) => {
      if (typeof v === "string") {
        return { label: v, voice_id: v };
      }
      return {
        label: v.label || v.name || v.id || v.voice_id || String(v),
        voice_id: v.voice_id || v.id || v.name || String(v),
      };
    });
  }

  async registerModelVoice(
    engineId: string = "vieneu-tts-v3-turbo",
    payload: { voice_name: string; ref_audio_path?: string; ref_audio_b64?: string },
    options?: ClientResilienceOptions
  ): Promise<{ status: string; voice_name: string; voices: VoicePreset[]; engine_id: string }> {
    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/voices/register`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to register voice for '${engineId}' (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    const data = (await response.json()) as { status: string; voice_name: string; voices: any[]; engine_id: string };
    const normalizedVoices: VoicePreset[] = (data.voices || []).map((v: any) => {
      if (typeof v === "string") {
        return { label: v, voice_id: v };
      }
      return {
        label: v.label || v.name || v.id || v.voice_id || String(v),
        voice_id: v.voice_id || v.id || v.name || String(v),
      };
    });
    return {
      status: data.status,
      voice_name: data.voice_name,
      voices: normalizedVoices,
      engine_id: data.engine_id,
    };
  }

  async fetchHealth(options?: ClientResilienceOptions): Promise<SystemHealthResponse> {
    const response = await this.fetchWithResilience(
      "/v1/health",
      { method: "GET" },
      { ...options, maxRetries: options?.maxRetries ?? 1, timeoutMs: options?.timeoutMs ?? 5000 }
    );
    if (!response.ok) {
      throw new Error(`Health check failed (${response.status})`);
    }
    return (await response.json()) as SystemHealthResponse;
  }

  async synthesizeSpeech(
    payload: VieneuSynthesizeRequest,
    options?: ClientResilienceOptions
  ): Promise<SynthesizeResult> {
    const bodyStr = JSON.stringify(payload);
    const payloadSha256 = await sha256DigestHex(bodyStr);

    const inferPayload = JSON.stringify({
      inputs: payload.text,
      parameters: {
        voice: payload.voice,
        ref_audio_path: payload.ref_audio_path,
        denoise_ref: payload.denoise_ref,
        speed: payload.speed,
        pitch: payload.pitch,
        gain_db: payload.gain_db,
      },
      auto_load: true,
    });
    const response = await this.fetchWithResilience(
      "/v1/models/vieneu-tts-v3-turbo/infer",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "audio/wav",
          "X-Content-SHA256": payloadSha256,
        },
        body: inferPayload,
      },
      options
    );

    if (!response.ok) {
      throw new Error(
        `VieNeu-TTS synthesis failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }

    const wavBuffer = await response.arrayBuffer();
    const sampleRate = Number(response.headers.get("X-Sample-Rate") ?? "48000");
    const durationSeconds = Number(response.headers.get("X-Audio-Duration-Sec") ?? "0");
    const backendUsed = response.headers.get("X-Backend-Engine") ?? "vieneu-v3-turbo";
    const requestId = response.headers.get("X-Request-ID") ?? safeRandomUUID();

    return {
      wavBuffer,
      sampleRate,
      durationSeconds,
      backendUsed,
      requestId,
      payloadSha256,
    };
  }

  async *streamSpeech(
    payload: VieneuSynthesizeRequest,
    options?: ClientResilienceOptions
  ): AsyncGenerator<Uint8Array, void, unknown> {
    const bodyStr = JSON.stringify(payload);
    const payloadSha256 = await sha256DigestHex(bodyStr);

    const targetEngine = payload.engine_id || "vieneu-tts-v3-turbo";
    const streamPayload = JSON.stringify({
      inputs: payload.text,
      parameters: {
        voice: payload.voice,
        speed: payload.speed,
        pitch: payload.pitch,
        gain_db: payload.gain_db,
      },
      auto_load: true,
    });
    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(targetEngine)}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "audio/wav",
          "X-Content-SHA256": payloadSha256,
        },
        body: streamPayload,
      },
      { ...options, maxRetries: 0 }
    );

    if (!response.ok || !response.body) {
      throw new Error(
        `Speech stream for '${targetEngine}' failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }

    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  async streamFloat32Frames(
    payload: VieneuSynthesizeRequest,
    options?: ClientResilienceOptions
  ): Promise<ReadableStream<Float32Array>> {
    const bodyStr = JSON.stringify(payload);
    const response = await this.fetchWithResilience(
      "/v1/tts/vieneu/stream",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyStr,
      },
      { ...options, maxRetries: 0 }
    );

    if (!response.ok || !response.body) {
      throw new Error(`VieNeu-TTS stream failed (${response.status})`);
    }

    return response.body.pipeThrough(createPcmFrameTransformStream());
  }

  async listUvEnvironments(
    options?: ClientResilienceOptions
  ): Promise<UvEnvironmentSummary[]> {
    const response = await this.fetchWithResilience(
      "/v1/environments/uv",
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to list uv environments (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    const data = (await response.json()) as { environments: UvEnvironmentSummary[] };
    return data.environments ?? [];
  }

  async provisionUvEnvironment(
    payload: UvProvisionRequest,
    options?: ClientResilienceOptions
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchWithResilience(
      "/v1/environments/uv/provision",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { ...options, maxRetries: 0, timeoutMs: options?.timeoutMs ?? 180_000 }
    );
    if (!response.ok) {
      throw new Error(
        `uv provisioning failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async inspectUvEnvironment(
    envId: string,
    options?: ClientResilienceOptions
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchWithResilience(
      `/v1/environments/uv/${encodeURIComponent(envId)}`,
      { method: "GET" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Failed to inspect environment '${envId}' (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async runInUvEnvironment(
    envId: string,
    payload: { code: string; payload?: Record<string, unknown>; timeout_sec?: number },
    options?: ClientResilienceOptions
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchWithResilience(
      `/v1/environments/uv/${encodeURIComponent(envId)}/run`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { ...options, maxRetries: 0, timeoutMs: options?.timeoutMs ?? 60_000 }
    );
    if (!response.ok) {
      throw new Error(
        `Isolated uv execution failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async registerClonedVoice(
    payload: { voice_name: string; ref_audio_path: string },
    options?: ClientResilienceOptions
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchWithResilience(
      "/v1/tts/vieneu/voices/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Voice registration failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async loadHfModel(
    payload: HFLoadModelRequest,
    options?: ClientResilienceOptions
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchWithResilience(
      "/v1/models/hf/load",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { ...options, maxRetries: 0, timeoutMs: options?.timeoutMs ?? 180_000 }
    );
    if (!response.ok) {
      throw new Error(
        `HF model load failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async inferHfModel(
    engineId: string,
    payload: HFInferRequest,
    options?: ClientResilienceOptions
  ): Promise<Record<string, unknown>> {
    const response = await this.fetchWithResilience(
      `/v1/models/hf/${encodeURIComponent(engineId)}/infer`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      options
    );
    if (!response.ok) {
      throw new Error(
        `HF inference failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as Record<string, unknown>;
  }

  async resetModelCircuitBreaker(
    engineId: string,
    options?: ClientResilienceOptions
  ): Promise<{
    status: string;
    engine_id: string;
    circuit_breaker: Record<string, any>;
    model: ModelCatalogEntry;
  }> {
    const response = await this.fetchWithResilience(
      `/v1/models/${encodeURIComponent(engineId)}/circuit/reset`,
      { method: "POST" },
      options
    );
    if (!response.ok) {
      throw new Error(
        `Circuit breaker reset failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return (await response.json()) as any;
  }

  /**
   * Studio v28: Low-level WinterTC streaming passthrough helper for Edge Gateway routes.
   */
  public async fetchRawStream(
    path: string,
    body: unknown,
    acceptHeader: string = "application/x-ndjson",
    options?: ClientResilienceOptions
  ): Promise<Response> {
    const response = await this.fetchWithResilience(
      path,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: acceptHeader,
        },
        body: JSON.stringify(body ?? {}),
      },
      options
    );
    if (!response.ok || !response.body) {
      throw new Error(
        `Upstream stream request failed (${response.status}): ${await AIInferenceClient.extractErrorDetail(response)}`
      );
    }
    return response;
  }

  /**
   * Synthesize speech via standard OpenAI Audio Speech format (WinterTC ECMA-429 compliant).
   */
  public async openAiSpeech(options: {
    input: string;
    model?: string;
    voice?: string;
    speed?: number;
    responseFormat?: "wav" | "mp3" | "pcm";
    signal?: AbortSignal;
  }): Promise<ArrayBuffer> {
    const res = await this.fetchWithResilience(
      "/v1/audio/speech",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: options.model ?? "kokoro-82m-tts",
          input: options.input,
          voice: options.voice ?? "af_bella",
          speed: options.speed ?? 1.0,
          response_format: options.responseFormat ?? "wav",
        }),
      },
      { signal: options.signal }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(`Speech synthesis failed (${res.status}): ${JSON.stringify(err)}`);
    }
    return res.arrayBuffer();
  }

  /**
   * Transcribe audio via standard OpenAI Audio Transcriptions format (WinterTC ECMA-429 compliant).
   */
  public async openAiTranscription(options: {
    file: Blob | Uint8Array;
    fileName?: string;
    model?: string;
    language?: string;
    prompt?: string;
    responseFormat?: "json" | "text" | "verbose_json";
    signal?: AbortSignal;
  }): Promise<any> {
    const formData = new FormData();
    const blob = options.file instanceof Blob ? options.file : new Blob([options.file as any]);
    formData.append("file", blob, options.fileName ?? "audio.wav");
    formData.append("model", options.model ?? "whisper-large-v3-turbo");
    if (options.language) formData.append("language", options.language);
    if (options.prompt) formData.append("prompt", options.prompt);
    if (options.responseFormat) formData.append("response_format", options.responseFormat);

    const res = await this.fetchWithResilience(
      "/v1/audio/transcriptions",
      {
        method: "POST",
        body: formData,
      },
      { signal: options.signal }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(`Audio transcription failed (${res.status}): ${JSON.stringify(err)}`);
    }
    if (options.responseFormat === "text") {
      return res.text();
    }
    return res.json();
  }

  /**
   * Chat completions via standard OpenAI Chat Completion format (WinterTC ECMA-429 compliant).
   */
  public async openAiChatCompletion(options: {
    messages: Array<{ role: string; content: any }>;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  }): Promise<{
    id: string;
    model: string;
    choices: Array<{ message: { role: string; content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  }> {
    const res = await this.fetchWithResilience(
      "/v1/chat/completions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: options.model ?? "deepseek-r1-distill-qwen",
          messages: options.messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 256,
          stream: false,
        }),
      },
      { signal: options.signal }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(`Chat completion failed (${res.status}): ${JSON.stringify(err)}`);
    }
    return res.json();
  }

  /**
   * Image generation via standard OpenAI Image Generation format (WinterTC ECMA-429 compliant).
   */
  public async openAiImageGeneration(options: {
    prompt: string;
    model?: string;
    size?: string;
    responseFormat?: "url" | "b64_json";
    signal?: AbortSignal;
  }): Promise<{
    created: number;
    data: Array<{ url?: string; b64_json?: string }>;
  }> {
    const res = await this.fetchWithResilience(
      "/v1/images/generations",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: options.prompt,
          model: options.model ?? "flux-1-schnell",
          size: options.size ?? "1024x1024",
          response_format: options.responseFormat ?? "url",
        }),
      },
      { signal: options.signal }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(`Image generation failed (${res.status}): ${JSON.stringify(err)}`);
    }
    return res.json();
  }
}

function matchEdgeModelRoute(
  requestUrl: string,
  pathname: string,
  modelRoute: URLPattern | null
): { engineId?: string; action?: string } | null {
  if (modelRoute) {
    const groups = modelRoute.exec(requestUrl)?.pathname.groups;
    if (groups?.engineId && groups?.action) {
      return {
        engineId: decodeURIComponent(groups.engineId),
        action: decodeURIComponent(groups.action),
      };
    }
  }
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 4 && parts[0] === "edge" && parts[1] === "models") {
    return {
      engineId: decodeURIComponent(parts[2]),
      action: decodeURIComponent(parts[3]),
    };
  }
  return null;
}

export function createWinterTCEdgeGateway(upstreamBaseUrl: string = "http://127.0.0.1:8000") {
  const client = new AIInferenceClient(upstreamBaseUrl);
  const ttsRoute =
    typeof URLPattern !== "undefined" ? new URLPattern({ pathname: "/edge/tts/:action" }) : null;
  const modelRoute =
    typeof URLPattern !== "undefined"
      ? new URLPattern({ pathname: "/edge/models/:engineId/:action" })
      : null;

  async function parseEdgeJsonBody<T = any>(request: Request): Promise<T> {
    const cloned = request.clone();
    const rawText = await cloned.text();
    if (!rawText || !rawText.trim()) {
      return {} as T;
    }
    try {
      const parsed = JSON.parse(rawText);
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new SyntaxError("JSON payload must be an object");
      }
      return parsed as T;
    } catch (err: any) {
      const syntaxErr = new Error(
        `Malformed JSON body in WinterTC Edge request: ${err instanceof Error ? err.message : String(err)}`
      );
      (syntaxErr as any).status = 400;
      (syntaxErr as any).code = "INVALID_EDGE_JSON_BODY";
      throw syntaxErr;
    }
  }

  return async function handleEdgeRequest(request: Request): Promise<Response> {
    const requestId = request.headers.get("X-Request-ID") || safeRandomUUID();
    const edgeRuntime =
      (typeof navigator !== "undefined" && navigator.userAgent) || "WinterTC-ECMA-429-Edge";
    const baseHeaders = {
      "X-Edge-Runtime": edgeRuntime,
      "X-Request-ID": requestId,
    };

    try {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/edge/health") {
        const health = await client.fetchHealth({ signal: request.signal });
        return Response.json(health, { headers: baseHeaders });
      }

      if (request.method === "GET" && url.pathname === "/edge/hardware") {
        const hw = await client.fetchHardwareProfile({ signal: request.signal });
        return Response.json(hw, { headers: baseHeaders });
      }

      if (request.method === "POST" && url.pathname === "/edge/hardware") {
        const body = await parseEdgeJsonBody(request);
        const hwRes = await client.selectHardwareProfile(body, { signal: request.signal });
        return Response.json(hwRes, { headers: baseHeaders });
      }

      if (request.method === "GET" && url.pathname === "/edge/catalog") {
        const catalog = await client.fetchModelCatalog({ signal: request.signal });
        return Response.json(catalog, { headers: baseHeaders });
      }

      if (request.method === "GET" && url.pathname === "/edge/hub") {
        const hub = await client.discoverHubModels({}, { signal: request.signal });
        return Response.json(hub, { headers: baseHeaders });
      }

      if (request.method === "GET" && url.pathname === "/edge/hub/resolve") {
        const modelId = url.searchParams.get("model_id") || "briaai/RMBG-2.0";
        const task = url.searchParams.get("task") || undefined;
        const resolved = await client.resolveHubModel(modelId, task, { signal: request.signal });
        return Response.json(resolved, { headers: baseHeaders });
      }

      if (request.method === "POST" && url.pathname === "/edge/dag/execute") {
        const body = await parseEdgeJsonBody(request);
        const dagRes = await client.executeDagPipeline(body, { signal: request.signal });
        return Response.json(dagRes, { headers: baseHeaders });
      }

      if (request.method === "POST" && url.pathname === "/edge/dag/stream") {
        const body = await parseEdgeJsonBody(request);
        const upstreamRes = await client.fetchRawStream(
          "/v1/pipelines/dag/stream",
          body,
          "application/x-ndjson",
          { signal: request.signal }
        );
        const passthrough = new TransformStream<Uint8Array, Uint8Array>();
        upstreamRes.body!.pipeTo(passthrough.writable).catch(() => {});
        return new Response(passthrough.readable, {
          status: 200,
          headers: {
            ...baseHeaders,
            "Content-Type": "application/x-ndjson; charset=utf-8",
            "X-Edge-Stream-Mode": "ndjson-dag-passthrough",
          },
        });
      }

      if (request.method === "POST" && url.pathname === "/edge/arena/compare") {
        const body = await parseEdgeJsonBody(request);
        const arenaRes = await client.compareModelsInArena(body, { signal: request.signal });
        return Response.json(arenaRes, { headers: baseHeaders });
      }

      if (request.method === "GET" && url.pathname === "/edge/telemetry") {
        const ledger = await client.fetchTelemetryLedger({}, { signal: request.signal });
        return Response.json(ledger, { headers: baseHeaders });
      }

      if (request.method === "GET" && url.pathname === "/edge/pipelines") {
        const pipelines = await client.fetchPipelineTaxonomy({ signal: request.signal });
        return Response.json(pipelines, { headers: baseHeaders });
      }

      const modelMatch = matchEdgeModelRoute(request.url, url.pathname, modelRoute);
      if (modelMatch?.engineId && modelMatch?.action) {
        if (request.method === "POST" && modelMatch.action === "infer") {
          const body = await parseEdgeJsonBody<PolymorphicInferRequest>(request);
          const result = await client.inferModel(modelMatch.engineId, body, {
            signal: request.signal,
          });
          return Response.json(result, {
            headers: {
              ...baseHeaders,
              "X-Request-ID": result.requestId,
              "X-Content-SHA256": result.payloadSha256,
              "X-Modality-Lens": result.modality,
            },
          });
        }
        if (request.method === "POST" && modelMatch.action === "stream") {
          const body = await parseEdgeJsonBody<PolymorphicInferRequest>(request);
          const upstreamRes = await client.fetchRawStream(
            `/v1/models/${encodeURIComponent(modelMatch.engineId)}/stream`,
            body,
            "application/x-ndjson",
            { signal: request.signal }
          );
          const passthrough = new TransformStream<Uint8Array, Uint8Array>();
          upstreamRes.body!.pipeTo(passthrough.writable).catch(() => {});
          return new Response(passthrough.readable, {
            status: 200,
            headers: {
              ...baseHeaders,
              "Content-Type": "application/x-ndjson; charset=utf-8",
              "X-Edge-Stream-Mode": "ndjson-model-passthrough",
            },
          });
        }
        if (request.method === "GET" && modelMatch.action === "inspect") {
          const inspection = await client.inspectModelWeightsShards(modelMatch.engineId, {
            signal: request.signal,
          });
          return Response.json(inspection, { headers: baseHeaders });
        }
        if (request.method === "POST" && modelMatch.action === "tier") {
          const body = await parseEdgeJsonBody(request);
          const tierRes = await client.setModelWeightTier(modelMatch.engineId, body, {
            signal: request.signal,
          });
          return Response.json(tierRes, { headers: baseHeaders });
        }
        if (request.method === "POST" && modelMatch.action === "reset-circuit") {
          const resetRes = await client.resetModelCircuitBreaker(modelMatch.engineId, {
            signal: request.signal,
          });
          return Response.json(resetRes, { headers: baseHeaders });
        }
      }

      const action = ttsRoute
        ? ttsRoute.exec(request.url)?.pathname.groups.action
        : url.pathname.startsWith("/edge/tts/")
        ? url.pathname.split("/")[3]
        : null;

      if (request.method === "GET" && action === "voices") {
        const voices = await client.fetchVoices({ signal: request.signal });
        return Response.json({ voices }, { headers: baseHeaders });
      }

      if (request.method === "POST" && action === "synthesize") {
        const body = await parseEdgeJsonBody<VieneuSynthesizeRequest>(request);
        const result = await client.synthesizeSpeech(body, { signal: request.signal });
        return new Response(result.wavBuffer, {
          status: 200,
          headers: {
            ...baseHeaders,
            "Content-Type": "audio/wav",
            "X-Request-ID": result.requestId,
            "X-Payload-SHA256": result.payloadSha256,
            "X-Sample-Rate": String(result.sampleRate),
          },
        });
      }

      if (request.method === "POST" && action === "stream") {
        const body = await parseEdgeJsonBody<VieneuSynthesizeRequest>(request);
        const upstreamRes = await client.fetchRawStream(
          "/v1/models/vieneu-tts-v3-turbo/stream",
          {
            inputs: body.text,
            parameters: {
              voice: body.voice,
              speed: body.speed,
              pitch: body.pitch,
              gain_db: body.gain_db,
            },
            auto_load: true,
          },
          "audio/wav",
          { signal: request.signal }
        );
        const passthrough = new TransformStream<Uint8Array, Uint8Array>();
        upstreamRes.body!.pipeTo(passthrough.writable).catch(() => {});
        return new Response(passthrough.readable, {
          status: 200,
          headers: {
            ...baseHeaders,
            "Content-Type": "audio/wav",
            "X-Sample-Rate": upstreamRes.headers.get("X-Sample-Rate") || "48000",
            "X-Edge-Stream-Mode": "pcm-wav-passthrough",
          },
        });
      }

      return Response.json(
        {
          type: "https://inference.enterprise.internal/errors/route_not_found",
          title: "ROUTE_NOT_FOUND",
          status: 404,
          detail: `No WinterTC Edge Gateway route matched ${request.method} ${url.pathname}`,
          request_id: requestId,
        },
        { status: 404, headers: baseHeaders }
      );
    } catch (err: any) {
      const status = typeof err?.status === "number" ? err.status : 502;
      const code = err?.code || "EDGE_GATEWAY_UPSTREAM_ERROR";
      const detail = err instanceof Error ? err.message : String(err);
      return Response.json(
        {
          type: `https://inference.enterprise.internal/errors/${String(code).toLowerCase()}`,
          title: code,
          status,
          detail,
          request_id: requestId,
        },
        { status, headers: baseHeaders }
      );
    }
  };
}
