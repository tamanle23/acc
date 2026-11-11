import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import type {
  ModelCatalogEntry,
  LocalHardwareProfile,
  WeightsSummary,
  WeightTierId,
  OffloadStrategy,
} from "@ai-monorepo/ai-control-plane-sdk";
import {
  FALLBACK_HARDWARE_PROFILES,
} from "@/constants/studio-constants";
import { computeClientModelWeights } from "@/lib/audio-synthesizer";

const initialModels: ModelCatalogEntry[] = [];

export const [catalogState, setCatalogState] = createStore({
  models: initialModels as ModelCatalogEntry[],
  hubMarketplaceModels: [] as ModelCatalogEntry[],
  hardwareProfiles: FALLBACK_HARDWARE_PROFILES as LocalHardwareProfile[],
  activeProfile: FALLBACK_HARDWARE_PROFILES[1] as LocalHardwareProfile,
  weightsSummary: null as WeightsSummary | null,
  vramBudgetMb: 8192,
  filterTab: "all" as "all" | "in_vram" | "cached_disk" | "standby" | "hub",
  searchQuery: "",
  hubModalOpen: false,
  quickHubSelectId: "sdxl-turbo-img2img",
  evictionModalOpen: false,
});

export const [selectedEngineId, setSelectedEngineId] = createSignal<string>("vieneu-tts-v3-turbo");

export function updateModelWeightTier(engineId: string, tier: WeightTierId, offload: OffloadStrategy = "none") {
  setCatalogState("models", (m) => m.engine_id === engineId, (prev) =>
    computeClientModelWeights(prev, tier, offload, catalogState.activeProfile)
  );
}

export function setActiveHardwareProfile(profile: LocalHardwareProfile) {
  setCatalogState("activeProfile", profile);
  setCatalogState("vramBudgetMb", profile.vram_budget_mb);
  // Recalculate weights for all models against new profile
  setCatalogState("models", (models) =>
    models.map((m) =>
      computeClientModelWeights(
        m,
        (m.weights?.weight_tier as any) || "balanced_fp16",
        (m.weights?.offload_strategy as any) || "none",
        profile
      )
    )
  );
}
