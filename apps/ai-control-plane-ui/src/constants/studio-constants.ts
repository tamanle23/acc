import type { Component } from 'solid-js';
import type {
  PipelineCategoryId,
  LocalHardwareProfile,
  WeightTierId,
  WeightPrecision,
  DagPresetBlueprint,
  ModelCatalogEntry,
  ModalityFamily,
} from '@ai-monorepo/ai-control-plane-sdk';
import {
  LayoutGrid,
  Sparkles,
  Boxes,
  Terminal,
  Database,
  FileCode,
  Volume2,
  Mic,
  Wand2,
  Eye,
  MessageSquare,
  BarChart3,
  Network,
} from 'lucide-solid';
import type { StudioWorkspaceId } from '@/types/studio';

export const STUDIO_SCRIPT_TEMPLATES = [
  {
    label: "VN Studio Broadcast",
    text: "Xin chào! Chào mừng bạn đến với buồng lái suy luận AI đa phương thức chuẩn Enterprise, tích hợp VieNeu TTS v3 Turbo 48kHz và cô lập môi trường bằng uv.",
  },
  {
    label: "Tech News Cadence",
    text: "Bản tin công nghệ: Kiến trúc Dynamic Micro-Batching kết hợp cùng ONNX Runtime giúp giảm độ trễ phản hồi âm thanh xuống dưới 15 mili giây.",
  },
  {
    label: "AI Voice Assistant",
    text: "Chào bạn, tôi là trợ lý giọng nói AI thế hệ thứ ba. Hôm nay tôi có thể hỗ trợ gì cho hệ thống kỹ thuật của bạn?",
  },
];

export const PIPELINE_CATEGORIES: Array<{
  id: 'all' | PipelineCategoryId;
  label: string;
  shortLabel: string;
}> = [
    { id: 'all', label: 'All Pipeline Studios', shortLabel: 'All' },
    { id: 'audio_speech', label: 'Audio & Speech Pipelines', shortLabel: 'Audio/Speech' },
    { id: 'generative_diffusion', label: 'Generative Diffusion Image', shortLabel: 'Diffusion' },
    { id: 'computer_vision', label: 'Computer Vision & Segmentation', shortLabel: 'Vision/Seg' },
    { id: 'generative_multimodal', label: 'Generative LLM & VLM', shortLabel: 'LLM/VLM' },
    { id: 'nlu_reranking', label: 'NLU, NER & Reranking', shortLabel: 'NLU/Rerank' },
    { id: 'vector_embeddings', label: 'Vector Embeddings', shortLabel: 'Embeddings' },
  ];

export const FALLBACK_HARDWARE_PROFILES: LocalHardwareProfile[] = [
  {
    profile_id: "tier_1_edge_cpu",
    tier_number: 1,
    name: "Tier 1: Edge / Ultrabook CPU & iGPU",
    short_name: "Tier 1 • Edge 2GB",
    representative_hardware: "Intel Core Ultra / AMD Ryzen AI / Apple M1 8GB / Raspberry Pi 5",
    vram_budget_mb: 2048,
    system_ram_budget_mb: 8192,
    single_model_vram_ceiling_mb: 1200,
    recommended_weight_tier: "nano_int4",
    recommended_precision: "int4",
    default_offload_strategy: "cpu_ram_offload",
    recommended_execution_target: "host-venv",
    recommended_max_batch_size: 2,
    compute_backend: "ONNX Runtime CPU + GGUF/AWQ INT4 Layer Offload",
    accent_color: "cyan",
  },
  {
    profile_id: "tier_2_consumer_8gb",
    tier_number: 2,
    name: "Tier 2: Consumer Laptop / Desktop GPU (6–8 GB)",
    short_name: "Tier 2 • Consumer 6GB",
    representative_hardware: "NVIDIA RTX 3060 / 4060 (8GB) • Apple M2/M3 (16GB Unified)",
    vram_budget_mb: 6144,
    system_ram_budget_mb: 16384,
    single_model_vram_ceiling_mb: 3200,
    recommended_weight_tier: "compact_int8",
    recommended_precision: "int8",
    default_offload_strategy: "hybrid_kv_offload",
    recommended_execution_target: "host-venv",
    recommended_max_batch_size: 4,
    compute_backend: "CUDA / Metal INT8 SmoothQuant + Hybrid KV-Cache Offload",
    accent_color: "emerald",
  },
  {
    profile_id: "tier_3_prosumer_16gb",
    tier_number: 3,
    name: "Tier 3: Prosumer Studio GPU (12–16 GB)",
    short_name: "Tier 3 • Prosumer 12GB",
    representative_hardware: "NVIDIA RTX 4070 Ti / 4080 (16GB) • Apple M3 Pro/Max (36GB)",
    vram_budget_mb: 12288,
    system_ram_budget_mb: 32768,
    single_model_vram_ceiling_mb: 6400,
    recommended_weight_tier: "balanced_fp16",
    recommended_precision: "fp16",
    default_offload_strategy: "none",
    recommended_execution_target: "host-venv",
    recommended_max_batch_size: 8,
    compute_backend: "CUDA FP16 Tensor Cores + Dynamic Micro-Batching",
    accent_color: "violet",
  },
  {
    profile_id: "tier_4_workstation_24gb",
    tier_number: 4,
    name: "Tier 4: Enthusiast Workstation GPU (24 GB)",
    short_name: "Tier 4 • Workstation 20GB",
    representative_hardware: "NVIDIA RTX 3090 / 4090 (24GB) • RTX A5000 • Apple M3 Ultra",
    vram_budget_mb: 20480,
    system_ram_budget_mb: 65536,
    single_model_vram_ceiling_mb: 12000,
    recommended_weight_tier: "studio_bf16",
    recommended_precision: "bf16",
    default_offload_strategy: "none",
    recommended_execution_target: "host-venv",
    recommended_max_batch_size: 16,
    compute_backend: "CUDA BF16 Native FlashAttention-2 + Multi-Model Residency",
    accent_color: "amber",
  },
  {
    profile_id: "tier_5_datacenter_48gb",
    tier_number: 5,
    name: "Tier 5: Datacenter / Multi-GPU Server (48–80 GB)",
    short_name: "Tier 5 • Datacenter 48GB",
    representative_hardware: "NVIDIA L40S / RTX 6000 Ada (48GB) • A100 / H100 (80GB)",
    vram_budget_mb: 49152,
    system_ram_budget_mb: 131072,
    single_model_vram_ceiling_mb: 32768,
    recommended_weight_tier: "ultra_fp32",
    recommended_precision: "bf16",
    default_offload_strategy: "none",
    recommended_execution_target: "host-venv",
    recommended_max_batch_size: 32,
    compute_backend: "H100/A100 BF16/FP32 Full-Fidelity Concurrent DAG Cluster",
    accent_color: "rose",
  },
];

export const WEIGHT_TIER_OPTIONS: Array<{
  tier_id: WeightTierId;
  shortLabel: string;
  precision: WeightPrecision;
  speedup: string;
  quality: string;
}> = [
    { tier_id: "nano_int4", shortLabel: "Nano (INT4 • -68% VRAM)", precision: "int4", speedup: "2.35x", quality: "94.8%" },
    { tier_id: "compact_int8", shortLabel: "Compact (INT8 • -45% VRAM)", precision: "int8", speedup: "1.65x", quality: "98.4%" },
    { tier_id: "balanced_fp16", shortLabel: "Balanced (FP16 • 99.8%)", precision: "fp16", speedup: "1.20x", quality: "99.8%" },
    { tier_id: "studio_bf16", shortLabel: "Studio Pro (BF16 • 100%)", precision: "bf16", speedup: "1.00x", quality: "100%" },
    { tier_id: "ultra_fp32", shortLabel: "Ultra Master (FP32 • 2x VRAM)", precision: "fp32", speedup: "0.55x", quality: "100%" },
  ];

export const TIER_SPEC_MAP: Record<
  WeightTierId,
  {
    label: string;
    precision: WeightPrecision;
    vram_mult: number;
    ram_mult: number;
    speedup: number;
    quality_pct: number;
  }
> = {
  nano_int4: {
    label: "Nano Edge INT4",
    precision: "int4",
    vram_mult: 0.32,
    ram_mult: 0.65,
    speedup: 2.35,
    quality_pct: 94.8,
  },
  compact_int8: {
    label: "Compact INT8",
    precision: "int8",
    vram_mult: 0.55,
    ram_mult: 0.80,
    speedup: 1.65,
    quality_pct: 98.4,
  },
  balanced_fp16: {
    label: "Balanced FP16",
    precision: "fp16",
    vram_mult: 0.78,
    ram_mult: 0.90,
    speedup: 1.2,
    quality_pct: 99.8,
  },
  studio_bf16: {
    label: "Studio Pro BF16",
    precision: "bf16",
    vram_mult: 1.0,
    ram_mult: 1.0,
    speedup: 1.0,
    quality_pct: 100.0,
  },
  ultra_fp32: {
    label: "Ultra Master FP32",
    precision: "fp32",
    vram_mult: 1.95,
    ram_mult: 1.45,
    speedup: 0.55,
    quality_pct: 100.0,
  },
};

export const FALLBACK_DAG_PRESETS: DagPresetBlueprint[] = [
  {
    preset_id: "diffusion-rmbg-vlm-tts",
    name: "Generative Studio-to-Voice Ad Loop (4-Stage Cross-Modal DAG)",
    description:
      "1. FLUX.1-schnell synthesizes 1024×1024 studio frame -> 2. briaai/RMBG-2.0 extracts 8-bit Alpha Matte -> 3. Qwen2.5-VL writes broadcast copy -> 4. VieNeu-TTS v3 Turbo synthesizes 48 kHz master audio.",
    default_input:
      "Ultra-detailed studio product photography of a brushed titanium broadcast condenser microphone with glowing emerald acoustic rings",
    nodes: [
      {
        node_id: "stage_1_flux",
        engine_id: "flux-1-schnell",
        label: "1. FLUX.1-schnell (Text-to-Image)",
        parameters: { num_inference_steps: 4, guidance_scale: 3.5, seed: 42 },
      },
      {
        node_id: "stage_2_rmbg",
        engine_id: "bria-rmbg-2.0",
        label: "2. BRIA RMBG-2.0 (8-Bit Alpha Matte)",
        parameters: { mask_threshold: 0.5, edge_feather_px: 2, background_mode: "checkerboard" },
      },
      {
        node_id: "stage_3_qwen",
        engine_id: "qwen2.5-vl-instruct",
        label: "3. Qwen2.5-VL-Instruct (VLM Copywriter)",
        parameters: { temperature: 0.6, max_new_tokens: 256 },
      },
      {
        node_id: "stage_4_vieneu",
        engine_id: "vieneu-tts-v3-turbo",
        label: "4. VieNeu-TTS v3 Turbo (48 kHz Master)",
        parameters: { voice: "Hải Đăng", speed: 1.0 },
      },
    ],
  },
  {
    preset_id: "voice-to-voice-assistant",
    name: "Autonomous Voice-to-Voice Assistant (3-Stage Acoustic DAG)",
    description:
      "1. Whisper Large v3 Turbo transcribes speech -> 2. Qwen2.5-VL reasons over transcript -> 3. VieNeu-TTS v3 Turbo synthesizes 48 kHz spoken reply.",
    default_input:
      "Hệ thống buồng lái AI đa phương thức tích hợp Whisper Large v3 Turbo, Qwen 2.5 VL và VieNeu TTS 48kHz.",
    nodes: [
      {
        node_id: "stage_1_whisper",
        engine_id: "whisper-large-v3-turbo",
        label: "1. Whisper Large v3 Turbo (ASR)",
        parameters: { language: "vi", word_timestamps: true },
      },
      {
        node_id: "stage_2_qwen",
        engine_id: "qwen2.5-vl-instruct",
        label: "2. Qwen2.5-VL-Instruct (Reasoning)",
        parameters: { temperature: 0.6, max_new_tokens: 256 },
      },
      {
        node_id: "stage_3_vieneu",
        engine_id: "vieneu-tts-v3-turbo",
        label: "3. VieNeu-TTS v3 Turbo (48 kHz WAV)",
        parameters: { voice: "Hải Đăng", speed: 1.0 },
      },
    ],
  },
  {
    preset_id: "vision-audit-rerank-embed",
    name: "Spatial Vision Audit & Vector Indexing (3-Stage Telemetry DAG)",
    description:
      "1. RT-DETR-v2 detects hardware & thermal anomalies -> 2. DeepSeek-R1 synthesizes incident report -> 3. BGE-M3 indexes report into 384D Matryoshka vectors.",
    default_input: "datacenter_rack_thermal.png — Server Rack & GPU Thermal Audit",
    nodes: [
      {
        node_id: "stage_1_rtdetr",
        engine_id: "rtdetr-v2-vision",
        label: "1. RT-DETR-v2 (Object Detection)",
        parameters: { confidence_threshold: 0.25, iou_threshold: 0.45 },
      },
      {
        node_id: "stage_2_deepseek",
        engine_id: "deepseek-r1-distill-qwen",
        label: "2. DeepSeek-R1-Distill (Incident Synthesis)",
        parameters: { temperature: 0.5, max_new_tokens: 256 },
      },
      {
        node_id: "stage_3_bgem3",
        engine_id: "bge-m3-embeddings",
        label: "3. BGE-M3 (Matryoshka Vector Indexing)",
        parameters: { dimensions: 384, normalize: true },
      },
    ],
  },
];


/**
 * Initial empty fallback catalog.
 * The AI Control Plane backend (GET /v1/models) is the sole single source of truth
 * for model catalog entries and parameters_schema.
 */
export const FALLBACK_CATALOG_MODELS: ModelCatalogEntry[] = [];

export const DEFAULT_ISOLATED_SCRIPT = `import sys, platform, json

payload = json.loads(sys.stdin.read() or "{}")
pkgs = []
try:
    import importlib.metadata as meta
    pkgs = sorted([f"{d.metadata['Name']}=={d.version}" for d in meta.distributions()])[:12]
except Exception:
    pass

print(json.dumps({
    "status": "isolated_execution_verified",
    "python_executable": sys.executable,
    "python_version": platform.python_version(),
    "platform": platform.system(),
    "sample_packages": pkgs,
    "echo_payload": payload,
}))`;

export const NAV_ITEMS: { id: StudioWorkspaceId; label: string; shortLabel: string; icon: Component<any>; badge?: string }[] = [
  { id: 'pipelines', label: 'Bespoke Pipeline Studios', shortLabel: 'Studios', icon: Sparkles },
  { id: 'hf', label: 'Hardware Tiering & Weights', shortLabel: 'Weights', icon: Boxes },
  { id: 'env', label: 'uv Sandbox Orchestrator', shortLabel: 'uv Envs', icon: Terminal },
  { id: 'telemetry', label: 'SQLite WAL & SLA Telemetry', shortLabel: 'Telemetry', icon: Database },
  { id: 'sdk', label: 'WinterTC Edge SDK', shortLabel: 'Edge SDK', icon: FileCode },
];

export const FAMILY_META: Record<ModalityFamily, { label: string; icon: Component<any>; badgeVariant: 'default' | 'success' | 'warning' | 'outline' }> = {
  tts: { label: 'Speech TTS Studio', icon: Volume2, badgeVariant: 'default' },
  asr: { label: 'Audio ASR Booth', icon: Mic, badgeVariant: 'success' },
  diffusion: { label: 'Diffusion Atelier', icon: Wand2, badgeVariant: 'warning' },
  vision: { label: 'Vision & Seg Studios', icon: Eye, badgeVariant: 'warning' },
  llm: { label: 'LLM / VLM Canvas', icon: MessageSquare, badgeVariant: 'default' },
  classification: { label: 'NLU & Rerank Lab', icon: BarChart3, badgeVariant: 'outline' },
  embeddings: { label: 'Vector Space Lab', icon: Network, badgeVariant: 'success' },
};
