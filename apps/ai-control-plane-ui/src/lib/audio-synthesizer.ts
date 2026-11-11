import type {
  ModelCatalogEntry,
  WeightTierId,
  OffloadStrategy,
  LocalHardwareProfile,
} from '@ai-monorepo/ai-control-plane-sdk';
import { TIER_SPEC_MAP } from '@/constants/studio-constants';

export function computeClientModelWeights(
  m: ModelCatalogEntry,
  tierId: WeightTierId,
  offloadStrategy: OffloadStrategy,
  hwProfile: LocalHardwareProfile,
  forceLoaded?: boolean
): ModelCatalogEntry {
  const baseVram = m.weights?.base_vram_mb ?? m.vram_footprint_mb ?? 1200;
  const baseRam = m.weights?.base_ram_mb ?? m.ram_footprint_mb ?? 512;
  const spec = TIER_SPEC_MAP[tierId] ?? TIER_SPEC_MAP.balanced_fp16;

  const offloadSpeedPenalty =
    offloadStrategy === "cpu_ram_offload"
      ? 0.78
      : offloadStrategy === "hybrid_kv_offload"
      ? 0.92
      : 1.0;

  let effVram = 0;
  let effRam = 0;
  let savingsPct = 0;

  if (offloadStrategy === "cpu_ram_offload") {
    effVram = 0;
    effRam = Math.max(128, Math.round(baseRam * spec.ram_mult + baseVram * spec.vram_mult));
    savingsPct = 100;
  } else if (offloadStrategy === "hybrid_kv_offload") {
    effVram = Math.max(64, Math.round(baseVram * spec.vram_mult * 0.72));
    effRam = Math.max(128, Math.round(baseRam * spec.ram_mult + baseVram * spec.vram_mult * 0.28));
    savingsPct = Math.max(0, Math.round((1 - effVram / Math.max(1, baseVram)) * 100));
  } else {
    effVram = Math.max(64, Math.round(baseVram * spec.vram_mult));
    effRam = Math.max(128, Math.round(baseRam * spec.ram_mult));
    savingsPct = Math.max(0, Math.round((1 - effVram / Math.max(1, baseVram)) * 100));
  }

  const effSpeedup = Number((spec.speedup * offloadSpeedPenalty).toFixed(2));

  let fitStatus: "OPTIMAL_FIT" | "QUANTIZED_FIT" | "OFFLOAD_HYBRID" | "EXCEEDS_VRAM" =
    "OPTIMAL_FIT";
  let badgeText = "OPTIMAL FIT";
  if (offloadStrategy === "cpu_ram_offload") {
    fitStatus = "OPTIMAL_FIT";
    badgeText = "CPU RAM (0 VRAM)";
  } else if (effVram > hwProfile.vram_budget_mb) {
    fitStatus = "EXCEEDS_VRAM";
    badgeText = "EXCEEDS VRAM";
  } else if (offloadStrategy !== "none") {
    fitStatus = "OFFLOAD_HYBRID";
    badgeText = "HYBRID KV-RAM";
  } else if (tierId === "nano_int4" || tierId === "compact_int8") {
    fitStatus = "QUANTIZED_FIT";
    badgeText = "QUANTIZED FIT";
  }

  const isLoaded = forceLoaded !== undefined ? forceLoaded : Boolean(m.loaded);
  return {
    ...m,
    loaded: isLoaded,
    status: isLoaded ? "loaded" : "unloaded",
    vram_mb: isLoaded ? effVram : 0,
    ram_mb: isLoaded ? effRam : 0,
    vram_footprint_mb: effVram,
    ram_footprint_mb: effRam,
    weights: {
      ...(m.weights ?? {
        engine_id: m.engine_id,
        model_id: m.model_id,
        pipeline_category: m.pipeline_category,
        pipeline_type: m.pipeline_type,
        revision: m.revision ?? "main",
        weight_format: m.weight_format ?? "safetensors",
        supported_precisions: m.supported_precisions ?? ["fp32", "bf16", "fp16", "int8", "int4"],
        lifecycle_state: isLoaded ? "ACTIVE_VRAM" : "REGISTERED",
        disk_size_mb: isLoaded ? m.expected_disk_mb ?? 800 : 0,
        expected_disk_mb: m.expected_disk_mb ?? 800,
        shard_count: m.shard_count ?? 2,
        verified_shards: isLoaded ? m.shard_count ?? 2 : 0,
        is_cached_on_disk: Boolean(isLoaded),
        pinned_in_vram: false,
      }),
      lifecycle_state: isLoaded ? "ACTIVE_VRAM" : (m.weights?.lifecycle_state ?? "REGISTERED"),
      is_cached_on_disk: isLoaded ? true : Boolean(m.weights?.is_cached_on_disk),
      disk_size_mb: isLoaded ? (m.weights?.expected_disk_mb ?? m.expected_disk_mb ?? 800) : (m.weights?.disk_size_mb ?? 0),
      base_vram_mb: baseVram,
      base_ram_mb: baseRam,
      weight_tier: tierId,
      precision: spec.precision,
      offload_strategy: offloadStrategy,
      effective_vram_mb: effVram,
      effective_ram_mb: effRam,
      quantization_savings_pct: savingsPct,
      hardware_compatibility: {
        status: fitStatus,
        badge_text: badgeText,
        active_tier_label: spec.label,
        speedup_multiplier: effSpeedup,
        quality_retention_pct: spec.quality_pct,
        recommended_tier_for_host: hwProfile.recommended_weight_tier,
        recommended_offload_for_host: hwProfile.default_offload_strategy,
        fits_in_single_model_ceiling: effVram <= hwProfile.single_model_vram_ceiling_mb,
      },
    } as any,
  };
}
