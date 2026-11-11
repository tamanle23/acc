import { createSignal, createMemo, Show, For } from 'solid-js';
import type {
  ModelCatalogEntry,
  PipelineCategoryId,
  LocalHardwareProfile,
  HardwareProfileId,
  HostHardwareTelemetry,
  ModelShardInspectionResponse,
  WeightPrecision,
  WeightTierId,
  OffloadStrategy,
} from '@ai-monorepo/ai-control-plane-sdk';
import {
  Boxes,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Activity,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  HardDrive,
  Flame,
  PowerOff,
  Lock,
  Unlock,
  Trash2,
  Plus,
  X,
  Gauge,
  Wand2,
  Search,
  Sliders,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Settings,
  Tag,
  Check,
} from 'lucide-solid';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPipelineStudioStyle } from '@/components/studio/bespoke-pipeline-studios';
import {
  PIPELINE_CATEGORIES,
  WEIGHT_TIER_OPTIONS,
} from '@/constants/studio-constants';

export type LifecycleFilterId = 'all' | 'active' | 'cached' | 'evicted' | 'hub';

export interface ModelCatalogRackCellProps {
  spanClass: string;
  catalogModels: ModelCatalogEntry[];
  activeEngineId: string;
  setActiveEngineId: (engineId: string) => void;
  selectedPipelineCategory: 'all' | PipelineCategoryId;
  setSelectedPipelineCategory: (cat: 'all' | PipelineCategoryId) => void;
  totalVramMb: number;
  maxVramBudgetMb: number;
  vramBudgetInput: number;
  setVramBudgetInput: (val: number) => void;
  handleUpdateVramBudget: (newBudgetMb: number) => Promise<void>;
  activeHardwareProfile: LocalHardwareProfile;
  hardwareProfiles: LocalHardwareProfile[];
  hostTelemetry: HostHardwareTelemetry;
  hardwareAdaptBusy: boolean;
  handleSelectHardwareProfile: (profileId: HardwareProfileId, adaptAllModels?: boolean) => Promise<void>;
  handleAutoAdaptAllModels: () => Promise<void>;
  lifecycleBusyId: string | null;
  handleWarmupModel: (engineId: string) => Promise<void>;
  handleLoadOrBindModel: (engineId: string, executionTarget: string) => Promise<void>;
  handleUnloadEvictModel: (engineId: string) => Promise<void>;
  handlePrefetchWeights: (engineId: string) => Promise<void>;
  handleQuantizeWeights: (engineId: string, precision: WeightPrecision) => Promise<void>;
  handleTogglePinModel: (engineId: string, pinned: boolean) => Promise<void>;
  handlePurgeDiskCache: (engineId: string) => Promise<void>;
  handleInspectModelShards: (engineId: string) => Promise<void>;
  handleSetModelWeightTier: (engineId: string, tierId: WeightTierId, offload: OffloadStrategy) => Promise<void>;
  inspectedShardModel: ModelShardInspectionResponse | null;
  setInspectedShardModel: (val: ModelShardInspectionResponse | null) => void;
  shardInspectBusyId: string | null;
  onOpenHubModal: () => void;
  hubMarketplaceModels: ModelCatalogEntry[];
  quickHubSelectId: string;
  setQuickHubSelectId: (id: string) => void;
  handleOneClickHubInstall: (payload: {
    repo_id?: string;
    engine_id?: string;
    model_id?: string;
    task?: string;
    task_override?: string;
    action: 'prefetch_disk' | 'load_vram';
    precision?: WeightPrecision;
    execution_target?: string;
  }) => Promise<void>;
  handleBatchWeightsAction: (
    action: 'prefetch_category' | 'evict_unpinned' | 'auto_adapt_hardware',
    pipelineCategory?: string
  ) => Promise<void>;
  uvEnvs: Array<{ env_id: string; python_executable: string; created_at?: number }>;
}

export function ModelCatalogRackCell(props: ModelCatalogRackCellProps) {
  const [lifecycleFilter, setLifecycleFilter] = createSignal<LifecycleFilterId>('all');
  const [searchQuery, setSearchQuery] = createSignal('');
  const [expandedSettingsId, setExpandedSettingsId] = createSignal<string | null>(null);

  // Uninstalled Hub models (in marketplace catalog but not yet locally registered)
  const uninstalledHubModels = createMemo(() => {
    return (props.hubMarketplaceModels || []).filter(
      (hm) => !(props.catalogModels || []).some((cm) => cm.engine_id === hm.engine_id)
    );
  });

  // Memory & Cache Metrics
  const residentModels = createMemo(() => {
    return (props.catalogModels || []).filter((m) => m.loaded || m.weights?.lifecycle_state === 'ACTIVE_VRAM');
  });

  const totalDiskCacheMb = createMemo(() => {
    return (props.catalogModels || []).reduce(
      (acc, m) => acc + (m.weights?.disk_size_mb ?? (m.loaded ? m.expected_disk_mb ?? 600 : 0)),
      0
    );
  });

  const totalOffloadedRamMb = createMemo(() => {
    return (props.catalogModels || []).reduce((acc, m) => {
      const offload = m.weights?.offload_strategy ?? 'none';
      if (offload === 'none') return acc;
      return acc + (m.weights?.effective_ram_mb ?? m.ram_footprint_mb);
    }, 0);
  });

  const vramPct = createMemo(() => Math.min(100, Math.round((props.totalVramMb / Math.max(1, props.maxVramBudgetMb)) * 100)));
  const lruThresholdMb = createMemo(() => Math.round(props.maxVramBudgetMb * 0.85));
  const isNearLimit = createMemo(() => props.totalVramMb >= lruThresholdMb());

  // Filtered models
  const filteredCatalogModels = createMemo(() => {
    const q = searchQuery().trim().toLowerCase();
    const lFilter = lifecycleFilter();
    const cat = props.selectedPipelineCategory;

    return (props.catalogModels || []).filter((m) => {
      // 1. Pipeline category filter
      if (cat !== 'all' && m.pipeline_category !== cat) {
        return false;
      }

      // 2. Lifecycle filter
      const wState = m.weights?.lifecycle_state ?? (m.loaded ? 'ACTIVE_VRAM' : 'REGISTERED');
      if (lFilter === 'active' && wState !== 'ACTIVE_VRAM') return false;
      if (lFilter === 'cached' && wState !== 'CACHED_ON_DISK') return false;
      if (lFilter === 'evicted' && wState !== 'EVICTED_TO_DISK') return false;

      // 3. Search query
      if (q) {
        const matchesName = m.display_name.toLowerCase().includes(q);
        const matchesType = m.pipeline_type.toLowerCase().includes(q);
        const matchesEngine = m.engine_id.toLowerCase().includes(q);
        const matchesArch = (m.architecture || '').toLowerCase().includes(q);
        if (!matchesName && !matchesType && !matchesEngine && !matchesArch) {
          return false;
        }
      }

      return true;
    });
  });

  // Counts for filter pills
  const counts = createMemo(() => {
    const models = props.catalogModels || [];
    const active = models.filter((m) => (m.weights?.lifecycle_state ?? (m.loaded ? 'ACTIVE_VRAM' : 'REGISTERED')) === 'ACTIVE_VRAM').length;
    const cached = models.filter((m) => m.weights?.lifecycle_state === 'CACHED_ON_DISK').length;
    const evicted = models.filter((m) => m.weights?.lifecycle_state === 'EVICTED_TO_DISK').length;
    return {
      all: models.length,
      active,
      cached,
      evicted,
      hub: uninstalledHubModels().length,
    };
  });

  return (
    <Card class={`${props.spanClass} flex flex-col justify-between border-border bg-card/95 backdrop-blur shadow-sm`}>
      <div>
        {/* Header */}
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-3 border-b border-border/60">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-lg bg-primary/15 border border-primary/30 text-primary">
              <Boxes class="w-4 h-4" />
            </div>
            <div>
              <CardTitle class="text-base font-semibold">
                Unified Model Weights & Lifecycle Manager
              </CardTitle>
              <CardDescription class="text-xs">
                5-Tier Hardware Profiler • Auto-LRU VRAM Guard • Checkpoint Shard Inspector
              </CardDescription>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <Button
              variant="default"
              size="sm"
              onClick={props.onOpenHubModal}
              class="h-8 text-xs font-mono"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Hub Market ({props.hubMarketplaceModels.length})</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent class="p-4 space-y-3.5">
          {/* SECTION 1: 5-TIER HARDWARE POWER SWITCHER & AUTO-ADAPT */}
          <div class="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span class="text-[10px] font-mono uppercase text-primary font-bold flex items-center gap-1.5">
                  <Cpu class="w-3.5 h-3.5" />
                  <span>
                    Detected Hardware: {props.hostTelemetry.cpu_cores} Cores • {Math.round(props.hostTelemetry.system_ram_mb / 1024)}GB System RAM
                  </span>
                </span>
                <p class="text-xs text-foreground font-semibold mt-0.5">
                  {props.activeHardwareProfile.name} — <span class="text-muted-foreground font-normal">{props.activeHardwareProfile.representative_hardware}</span>
                </p>
              </div>

              <Button
                size="sm"
                variant="default"
                disabled={props.hardwareAdaptBusy}
                onClick={() => void props.handleAutoAdaptAllModels()}
                class="h-7 px-3 text-[11px] font-mono"
                title="Automatically adapt all model weight tiers and offload modes to fit the active hardware profile"
              >
                <Show when={props.hardwareAdaptBusy} fallback={<Wand2 class="w-3 h-3 mr-1.5" />}>
                  <RefreshCw class="w-3 h-3 animate-spin mr-1.5" />
                </Show>
                <span>Auto-Adapt Fleet</span>
              </Button>
            </div>

            {/* 5 Hardware Tier Selector Pills */}
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-0.5">
              <For each={props.hardwareProfiles}>
                {(hp) => {
                  const isActiveTier = () => hp.profile_id === props.activeHardwareProfile.profile_id;
                  const isDetected = () => hp.profile_id === props.hostTelemetry.detected_tier_id;
                  return (
                    <button
                      type="button"
                      disabled={props.hardwareAdaptBusy}
                      onClick={() => void props.handleSelectHardwareProfile(hp.profile_id, true)}
                      class={`p-1.5 rounded-lg border text-left transition flex flex-col justify-between ${
                        isActiveTier()
                          ? 'border-primary bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'border-border bg-card/85 text-muted-foreground hover:text-foreground hover:border-primary/40'
                      }`}
                    >
                      <div class="flex items-center justify-between gap-1 w-full">
                        <span class="text-[10px] font-mono font-bold truncate">
                          T{hp.tier_number}: {Math.round(hp.vram_budget_mb / 1024)}GB
                        </span>
                        <Show when={isDetected()}>
                          <span
                            class={`text-[8px] font-mono px-1 rounded ${
                              isActiveTier() ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-success/20 text-success font-semibold'
                            }`}
                          >
                            HOST
                          </span>
                        </Show>
                      </div>
                      <span class={`text-[9px] font-mono truncate mt-0.5 ${isActiveTier() ? 'opacity-95' : 'text-primary'}`}>
                        {hp.recommended_weight_tier.replace('_', ' ').toUpperCase()}
                      </span>
                    </button>
                  );
                }}
              </For>
            </div>

            <div class="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/50">
              <span>Backend: <strong class="text-foreground">{props.activeHardwareProfile.compute_backend}</strong></span>
              <span>Rec. Precision: <strong class="text-success uppercase">{props.activeHardwareProfile.recommended_weight_tier}</strong></span>
            </div>
          </div>

          {/* SECTION 2: GLOBAL MEMORY TOPOLOGY VISUALIZER (VRAM / RAM / DISK) */}
          <div class="p-3.5 rounded-xl border border-border bg-surface/70 space-y-2.5">
            {/* Header Metrics */}
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <span class="text-muted-foreground">
                GPU VRAM:{' '}
                <strong class={isNearLimit() ? 'text-warning' : 'text-primary'}>
                  {props.totalVramMb} / {props.maxVramBudgetMb} MB ({vramPct()}%)
                </strong>
              </span>
              <div class="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>
                  RAM Offload: <strong class="text-foreground">{totalOffloadedRamMb()} MB</strong>
                </span>
                <span class="flex items-center gap-1">
                  <HardDrive class="w-3 h-3 text-primary" />
                  <span>SSD Cache: <strong class="text-primary">{totalDiskCacheMb()} MB</strong></span>
                </span>
              </div>
            </div>

            {/* Segmented Memory Topology Bar */}
            <div class="relative w-full h-3 rounded-full bg-secondary overflow-hidden border border-border flex">
              {/* Resident model segments */}
              <For each={residentModels()}>
                {(m, idx) => {
                  const mVram = () => m.weights?.effective_vram_mb ?? m.vram_footprint_mb;
                  const mPct = () => Math.max(1, (mVram() / Math.max(1, props.maxVramBudgetMb)) * 100);
                  const colors = ['bg-primary', 'bg-accent', 'bg-secondary', 'bg-warning', 'bg-success'];
                  const segColor = colors[idx() % colors.length];

                  return (
                    <div
                      title={`${m.display_name}: ${mVram()} MB VRAM`}
                      class={`h-full border-r border-background/40 transition-all duration-300 ${segColor}`}
                      style={{ width: `${mPct()}%` }}
                    />
                  );
                }}
              </For>

              {/* 85% Auto-LRU Threshold Indicator Line */}
              <div
                title="85% Auto-LRU Eviction Trigger Threshold"
                class="absolute top-0 bottom-0 w-0.5 bg-destructive z-10"
                style={{ left: '85%' }}
              />
            </div>

            {/* Controls Bar: VRAM Ceiling Slider & Batch Actions */}
            <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div class="flex items-center gap-2 flex-1 min-w-[200px]">
                <span class="text-[10px] font-mono text-muted-foreground shrink-0">
                  VRAM Ceiling:
                </span>
                <input
                  type="range"
                  min={1024}
                  max={49152}
                  step={512}
                  value={props.vramBudgetInput}
                  onInput={(e) => void props.handleUpdateVramBudget(parseInt(e.currentTarget.value, 10))}
                  aria-label="Global VRAM Budget Ceiling MB"
                  class="studio-slider flex-1"
                />
                <span class="text-[10px] font-mono text-foreground tabular-nums shrink-0">
                  {props.vramBudgetInput} MB
                </span>
              </div>

              <div class="flex items-center gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void props.handleBatchWeightsAction('prefetch_category', props.selectedPipelineCategory)}
                  disabled={Boolean(props.lifecycleBusyId)}
                  class="h-6 px-2 text-[10px] font-mono text-primary border-primary/40 bg-primary/10 hover:bg-primary/20 font-medium"
                >
                  <HardDrive class="w-2.5 h-2.5 text-primary mr-1" />
                  <span>Prefetch Visible</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void props.handleBatchWeightsAction('evict_unpinned')}
                  disabled={Boolean(props.lifecycleBusyId)}
                  class="h-6 px-2 text-[10px] font-mono text-warning border-warning/40 bg-warning/10 hover:bg-warning/20 font-medium"
                >
                  <PowerOff class="w-2.5 h-2.5 text-warning mr-1" />
                  <span>Evict Unpinned</span>
                </Button>
              </div>
            </div>
          </div>

          {/* SECTION 3: FLEET LIFECYCLE FILTER TABS & SEARCH */}
          <div class="space-y-2 pt-1">
            <div class="flex flex-wrap items-center justify-between gap-2">
              {/* Lifecycle Stage Pills */}
              <div class="flex items-center p-0.5 rounded-lg bg-surface/80 border border-border" role="tablist">
                <button
                  type="button"
                  onClick={() => setLifecycleFilter('all')}
                  class={`px-2 py-1 rounded-md text-[10px] font-mono transition flex items-center gap-1 ${
                    lifecycleFilter() === 'all'
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>All</span>
                  <span class="text-[9px] opacity-80">({counts().all})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLifecycleFilter('active')}
                  class={`px-2 py-1 rounded-md text-[10px] font-mono transition flex items-center gap-1 ${
                    lifecycleFilter() === 'active'
                      ? 'bg-success text-success-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-success-foreground animate-pulse" />
                  <span>In VRAM</span>
                  <span class="text-[9px] opacity-80">({counts().active})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLifecycleFilter('cached')}
                  class={`px-2 py-1 rounded-md text-[10px] font-mono transition flex items-center gap-1 ${
                    lifecycleFilter() === 'cached'
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <HardDrive class="w-2.5 h-2.5" />
                  <span>Cached Disk</span>
                  <span class="text-[9px] opacity-80">({counts().cached})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLifecycleFilter('evicted')}
                  class={`px-2 py-1 rounded-md text-[10px] font-mono transition flex items-center gap-1 ${
                    lifecycleFilter() === 'evicted'
                      ? 'bg-warning text-warning-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>Standby</span>
                  <span class="text-[9px] opacity-80">({counts().evicted})</span>
                </button>
              </div>

              {/* Real-time Model Search Input */}
              <div class="relative w-44 sm:w-56">
                <Search class="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filter models, arch, task..."
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  class="h-7 pl-8 pr-2 text-[11px] font-mono bg-surface/50 border-border"
                />
                <Show when={searchQuery()}>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </Show>
              </div>
            </div>

            {/* Pipeline Category Filter Pills */}
            <div class="flex flex-wrap gap-1 pt-1">
              <For each={PIPELINE_CATEGORIES}>
                {(cat) => (
                  <button
                    type="button"
                    onClick={() => props.setSelectedPipelineCategory(cat.id)}
                    class={`px-2 py-0.5 rounded text-[10px] font-mono transition border ${
                      props.selectedPipelineCategory === cat.id
                        ? 'bg-primary text-primary-foreground border-primary font-semibold'
                        : 'bg-surface/50 text-muted-foreground border-border/70 hover:text-foreground'
                    }`}
                  >
                    {cat.shortLabel}
                  </button>
                )}
              </For>
            </div>
          </div>

          {/* SECTION 4: STREAMLINED MODEL FLEET CARDS (5+ STATE MATRIX) */}
          <div class="space-y-2.5 max-h-[460px] overflow-y-auto pr-1 studio-scroll">
            <Show
              when={filteredCatalogModels().length > 0}
              fallback={
                <div class="p-8 rounded-xl border border-dashed border-border text-center space-y-2 font-mono">
                  <p class="text-xs text-muted-foreground">
                    No models match the current filter <strong>{lifecycleFilter()}</strong> in category <strong>{props.selectedPipelineCategory}</strong>.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setLifecycleFilter('all');
                      props.setSelectedPipelineCategory('all');
                      setSearchQuery('');
                    }}
                    class="h-7 text-xs"
                  >
                    Reset Filters
                  </Button>
                </div>
              }
            >
              <For each={filteredCatalogModels()}>
                {(m) => {
                  const isSelected = () => m.engine_id === props.activeEngineId;
                  const isBusy = () => props.lifecycleBusyId === m.engine_id;
                  const wState = () => m.weights?.lifecycle_state ?? (m.loaded ? 'ACTIVE_VRAM' : 'REGISTERED');
                  const activeTier = () => (m.weights?.weight_tier ?? 'balanced_fp16') as WeightTierId;
                  const offloadStrategy = () => (m.weights?.offload_strategy ?? 'none') as OffloadStrategy;
                  const isPinned = () => Boolean(m.weights?.pinned_in_vram);
                  const diskMb = () => m.weights?.disk_size_mb ?? (m.loaded ? m.expected_disk_mb ?? 600 : 0);
                  const effVram = () => m.weights?.effective_vram_mb ?? (offloadStrategy() === 'cpu_ram_offload' ? 0 : m.vram_footprint_mb);
                  const effRam = () => m.weights?.effective_ram_mb ?? m.ram_footprint_mb;
                  const shardCount = () => m.weights?.shard_count ?? m.shard_count ?? 2;
                  const verifiedShards = () => m.weights?.verified_shards ?? (diskMb() > 0 ? shardCount() : 0);
                  const pStyle = () => getPipelineStudioStyle(m.pipeline_type);
                  const isExpanded = () => expandedSettingsId() === m.engine_id;
                  const isShardInspected = () => props.inspectedShardModel?.engine_id === m.engine_id;
                  const isCudaRequired = () => offloadStrategy() !== 'cpu_ram_offload';
                  const isOffloadUnsupported = () => isCudaRequired() && !props.hostTelemetry.cuda_available;

                  // State Badge Colors & Label
                  const wStateLabel = () =>
                    m.loaded
                      ? offloadStrategy() === 'cpu_ram_offload'
                        ? 'ACTIVE_RAM'
                        : offloadStrategy() === 'hybrid_kv_offload'
                        ? 'ACTIVE_HYBRID'
                        : 'ACTIVE_VRAM'
                      : wState();

                  const stateBadgeClass = () =>
                    m.loaded
                      ? offloadStrategy() === 'cpu_ram_offload'
                        ? 'bg-primary/15 text-primary border-primary/40 font-semibold'
                        : offloadStrategy() === 'hybrid_kv_offload'
                        ? 'bg-accent/15 text-accent border-accent/40 font-semibold'
                        : 'bg-success/15 text-success border-success/40 font-semibold'
                      : wState() === 'CACHED_ON_DISK'
                      ? 'bg-primary/15 text-primary border-primary/40 font-semibold'
                      : wState() === 'EVICTED_TO_DISK'
                      ? 'bg-warning/15 text-warning border-warning/40 font-semibold'
                      : 'bg-surface text-muted-foreground border-border';

                  return (
                    <div
                      onClick={() => {
                        props.setActiveEngineId(m.engine_id);
                      }}
                      class={`p-3 rounded-xl border transition cursor-pointer space-y-2.5 ${
                        isSelected()
                          ? `${pStyle().accentBorder} ${pStyle().accentBg} shadow-xs ring-1 ring-primary/40`
                          : 'border-border bg-surface/55 hover:border-primary/40'
                      }`}
                    >
                      {/* Card Top: Identity, Status Beacon & Primary Actions */}
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <span
                            class={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              m.loaded
                                ? offloadStrategy() === 'cpu_ram_offload'
                                  ? 'bg-primary animate-pulse shadow-sm shadow-primary/50'
                                  : 'bg-success animate-pulse shadow-sm shadow-success/50'
                                : diskMb() > 0
                                ? 'bg-primary'
                                : 'bg-muted-foreground/40'
                            }`}
                          />
                          <div class="truncate">
                            <span class="text-xs font-semibold text-foreground block truncate">
                              {m.display_name}
                            </span>
                            <span class={`text-[10px] font-mono ${pStyle().accentText}`}>
                              {m.pipeline_type} • {m.architecture || 'Transformer'} • {verifiedShards()}/{shardCount()} shards
                            </span>
                          </div>
                        </div>

                        {/* Right Side: Badges & Primary Action Target */}
                        <div class="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* Engine Runtime Badge */}
                          <Show when={m.runtime_backend && m.runtime_backend !== 'torch'}>
                            <span class="text-[9px] font-mono px-1.5 py-0.5 rounded border bg-purple-500/10 text-purple-400 border-purple-500/30">
                              {m.runtime_backend === 'onnxruntime'
                                ? 'ORT DirectML'
                                : m.runtime_backend === 'llama_cpp'
                                ? 'GGUF llama.cpp'
                                : m.runtime_backend === 'paged_attention'
                                ? 'vLLM PagedAttn'
                                : m.runtime_backend}
                            </span>
                          </Show>
                          <span class={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${stateBadgeClass()}`}>
                            {wStateLabel()}
                          </span>

                          {/* PRIMARY ACTIONS BASED ON LIFECYCLE STAGE */}
                          <Show
                            when={m.loaded}
                            fallback={
                              <Show
                                when={diskMb() > 0}
                                fallback={
                                  <>
                                    <Button
                                      size="sm"
                                      variant="default"
                                      disabled={isBusy()}
                                      onClick={() => void props.handlePrefetchWeights(m.engine_id)}
                                      class="h-7 px-2.5 text-[10px] font-mono border border-primary/40 text-primary bg-primary/15 hover:bg-primary/25 font-semibold"
                                      title="Prefetch checkpoint shards to SSD cache without consuming VRAM"
                                    >
                                      <Show when={isBusy()} fallback={<HardDrive class="w-3 h-3 text-primary mr-1" />}>
                                        <RefreshCw class="w-3 h-3 animate-spin mr-1" />
                                      </Show>
                                      <span>+ Prefetch</span>
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={true}
                                      class="h-7 px-2.5 text-[10px] font-mono opacity-40 cursor-not-allowed"
                                      title="Must prefetch checkpoint shards to disk cache before mounting"
                                    >
                                      <Zap class="w-3 h-3 mr-1 text-muted-foreground" />
                                      <span>Mount {offloadStrategy() === 'cpu_ram_offload' ? 'RAM' : 'VRAM'}</span>
                                    </Button>
                                  </>
                                }
                              >
                                <Show
                                  when={offloadStrategy() !== 'cpu_ram_offload'}
                                  fallback={
                                    <Button
                                      size="sm"
                                      variant="default"
                                      disabled={isBusy()}
                                      onClick={() => void props.handleLoadOrBindModel(m.engine_id, m.execution_target)}
                                      class="h-7 px-3 text-[10px] font-mono shadow-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                                      title="Mount verified local disk shards into Host System RAM"
                                    >
                                      <Show when={isBusy()} fallback={<Zap class="w-3 h-3 mr-1" />}>
                                        <RefreshCw class="w-3 h-3 animate-spin mr-1" />
                                      </Show>
                                      <span>Mount Host RAM</span>
                                    </Button>
                                  }
                                >
                                  <Show
                                    when={!isOffloadUnsupported()}
                                    fallback={
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={isBusy()}
                                        onClick={() => void props.handleSetModelWeightTier(m.engine_id, activeTier(), 'cpu_ram_offload')}
                                        class="h-7 px-2.5 text-[10px] font-mono border-warning/40 bg-warning/15 text-warning hover:bg-warning/25 font-semibold"
                                        title="GPU mode requires CUDA (host has no active CUDA). Click to switch to CPU+RAM Offload."
                                      >
                                        <AlertCircle class="w-3 h-3 mr-1 text-warning" />
                                        <span>Requires CUDA</span>
                                      </Button>
                                    }
                                  >
                                    <Button
                                      size="sm"
                                      variant="default"
                                      disabled={isBusy()}
                                      onClick={() => void props.handleLoadOrBindModel(m.engine_id, `uv-sandbox:${m.recommended_uv_profile || 'vision-worker'}`)}
                                      class="h-7 px-3 text-[10px] font-mono shadow-xs"
                                      title={offloadStrategy() === 'hybrid_kv_offload' ? 'Mount into GPU VRAM with Hybrid KV cache offload' : 'Mount into GPU VRAM'}
                                    >
                                      <Show when={isBusy()} fallback={<Zap class="w-3 h-3 mr-1" />}>
                                        <RefreshCw class="w-3 h-3 animate-spin mr-1" />
                                      </Show>
                                      <span>{offloadStrategy() === 'hybrid_kv_offload' ? 'Mount Hybrid' : 'Mount VRAM'}</span>
                                    </Button>
                                  </Show>
                                </Show>
                              </Show>
                            }
                          >
                            <Button
                              size="sm"
                              variant={m.warmed_up ? 'secondary' : 'outline'}
                              disabled={isBusy()}
                              onClick={() => void props.handleWarmupModel(m.engine_id)}
                              class={`h-7 px-2.5 text-[10px] font-mono ${
                                m.warmed_up ? 'text-success border-success/40 bg-success/10 font-semibold' : ''
                              }`}
                              title={
                                m.warmed_up
                                  ? `Warmed (${m.last_warmup_ms ?? 0}ms). Click to run synthetic warmup calibration again.`
                                  : 'Run synthetic dummy inference forward pass'
                              }
                            >
                              <Flame class={`w-3 h-3 mr-1 ${m.warmed_up ? 'text-success' : 'text-warning'}`} />
                              <span>{m.warmed_up ? `${m.last_warmup_ms ?? 38}ms` : 'Warmup'}</span>
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={isBusy()}
                              onClick={() => void props.handleUnloadEvictModel(m.engine_id)}
                              class="h-7 px-2 text-[10px] font-mono text-warning hover:bg-warning/10 font-medium"
                              title={offloadStrategy() === 'cpu_ram_offload' ? 'Evict from Host RAM' : 'Soft Evict from VRAM to Disk'}
                            >
                              <PowerOff class="w-3 h-3 mr-1" />
                              <span>Evict</span>
                            </Button>
                          </Show>

                          {/* Settings & Shard Inspector Toggle */}
                          <button
                            type="button"
                            onClick={() => setExpandedSettingsId(isExpanded() ? null : m.engine_id)}
                            title="Configure Weight Tier, Offload & Execution Sandbox"
                            class={`p-1.5 rounded-lg border transition ${
                              isExpanded()
                                ? 'border-primary bg-primary/20 text-primary'
                                : 'border-border bg-card/80 text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <Settings class="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Offline / Conflict / Failure Alert Banner */}
                      <Show when={m.last_error || (isOffloadUnsupported() && !m.loaded)}>
                        <div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-warning/10 border border-warning/30 text-warning text-[10px] font-mono">
                          <div class="flex items-center gap-1.5 min-w-0">
                            <AlertCircle class="w-3.5 h-3.5 text-warning shrink-0" />
                            <span class="truncate">
                              {m.last_error || "GPU VRAM mode requires CUDA device. Host is running CPU-only."}
                            </span>
                          </div>
                          <Show when={!props.hostTelemetry.cuda_available && offloadStrategy() !== 'cpu_ram_offload'}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void props.handleSetModelWeightTier(m.engine_id, activeTier(), 'cpu_ram_offload');
                              }}
                              class="shrink-0 px-2 py-0.5 rounded bg-primary/20 hover:bg-primary/30 text-primary font-semibold border border-primary/40 text-[9px] transition"
                            >
                              Switch to CPU RAM
                            </button>
                          </Show>
                        </div>
                      </Show>

                      {/* Compact Specs Bar */}
                      <div class="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                        <div class="flex items-center gap-3">
                          <span>
                            VRAM: <strong class={effVram() === 0 ? "text-muted-foreground" : "text-foreground"}>{effVram()} MB</strong>
                          </span>
                          <span>
                            RAM: <strong class="text-foreground">{effRam()} MB</strong>
                          </span>
                          <span>
                            Mode: <strong class={offloadStrategy() === 'cpu_ram_offload' ? 'text-primary uppercase' : 'text-foreground uppercase'}>
                              {offloadStrategy() === 'cpu_ram_offload' ? 'CPU RAM' : offloadStrategy() === 'hybrid_kv_offload' ? 'Hybrid' : 'GPU Only'}
                            </strong>
                          </span>
                          <span>
                            Tier: <strong class="text-primary uppercase">{activeTier()}</strong>
                          </span>
                        </div>

                        <div class="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => void props.handleInspectModelShards(m.engine_id)}
                            disabled={props.shardInspectBusyId === m.engine_id}
                            class="text-primary hover:underline flex items-center gap-1"
                          >
                            <Gauge class="w-3 h-3" />
                            <span>{isShardInspected() ? 'Inspecting Shards' : 'Inspect Shards'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void props.handleTogglePinModel(m.engine_id, !isPinned())}
                            title={isPinned() ? 'Pinned in VRAM (Shielded)' : 'Pin in VRAM'}
                            class={`flex items-center gap-1 px-1.5 py-0.2 rounded border ${
                              isPinned()
                                ? 'border-warning/40 bg-warning/15 text-warning font-semibold'
                                : 'border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <Show when={isPinned()} fallback={<Unlock class="w-2.5 h-2.5" />}>
                              <Lock class="w-2.5 h-2.5" />
                            </Show>
                            <span>{isPinned() ? 'Pinned' : 'Pin'}</span>
                          </button>
                        </div>
                      </div>

                      {/* PROGRESSIVE DISCLOSURE: SETTINGS & TIER DRAWER */}
                      <Show when={isExpanded()}>
                        <div
                          class="p-3 rounded-lg border border-border/80 bg-surface/80 space-y-2 text-[11px] font-mono animate-in fade-in duration-150"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div class="flex items-center justify-between text-[10px] text-muted-foreground font-bold uppercase pb-1 border-b border-border/50">
                            <span>Advanced Configuration & Sandbox Execution</span>
                            <button
                              type="button"
                              onClick={() => setExpandedSettingsId(null)}
                              class="text-muted-foreground hover:text-foreground"
                            >
                              <X class="w-3 h-3" />
                            </button>
                          </div>

                          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                            {/* Weight Tier */}
                            <div class="space-y-1">
                              <label class="text-[10px] text-muted-foreground block">
                                Quantized Weight Tier:
                              </label>
                              <select
                                value={activeTier()}
                                onChange={(e) =>
                                  void props.handleSetModelWeightTier(
                                    m.engine_id,
                                    e.currentTarget.value as WeightTierId,
                                    offloadStrategy()
                                  )
                                }
                                disabled={isBusy()}
                                class="h-7 w-full rounded border border-border bg-card px-2 text-[10px] font-mono text-primary"
                              >
                                <For each={WEIGHT_TIER_OPTIONS}>
                                  {(opt) => (
                                    <option value={opt.tier_id}>
                                      {opt.shortLabel}
                                    </option>
                                  )}
                                </For>
                              </select>
                            </div>

                            {/* Memory Offload */}
                            <div class="space-y-1">
                              <label class="text-[10px] text-muted-foreground block">
                                Memory Offload Mode:
                              </label>
                              <select
                                value={offloadStrategy()}
                                onChange={(e) =>
                                  void props.handleSetModelWeightTier(
                                    m.engine_id,
                                    activeTier(),
                                    e.currentTarget.value as OffloadStrategy
                                  )
                                }
                                disabled={isBusy()}
                                class="h-7 w-full rounded border border-border bg-card px-2 text-[10px] font-mono text-foreground"
                              >
                                <option value="none">
                                  {props.hostTelemetry.cuda_available ? 'GPU VRAM Only' : '🚫 GPU VRAM Only (Requires CUDA)'}
                                </option>
                                <option value="hybrid_kv_offload">
                                  {props.hostTelemetry.cuda_available ? 'Hybrid KV Offload' : '🚫 Hybrid KV Offload (Requires CUDA)'}
                                </option>
                                <option value="cpu_ram_offload">
                                  {props.hostTelemetry.cuda_available ? 'CPU+RAM Layer Offload' : '✓ CPU+RAM Layer Offload (Host System RAM)'}
                                </option>
                              </select>
                            </div>

                            {/* Execution Sandbox Target */}
                            <div class="space-y-1">
                              <label class="text-[10px] text-muted-foreground block">
                                Execution Target:
                              </label>
                              <select
                                value={m.execution_target}
                                onChange={(e) => void props.handleLoadOrBindModel(m.engine_id, e.currentTarget.value)}
                                disabled={isBusy()}
                                class="h-7 w-full rounded border border-border bg-card px-2 text-[10px] font-mono text-foreground"
                              >
                                <option value="host-venv">host-venv (Host CPU)</option>
                                <option value={`uv-sandbox:${m.recommended_uv_profile || 'vision-worker'}`}>
                                  uv:{m.recommended_uv_profile || 'vision-worker'} (Recommended GPU/Isolated Profile)
                                </option>
                                <For each={props.uvEnvs.filter((env) => env.env_id !== (m.recommended_uv_profile || 'vision-worker'))}>
                                  {(env) => (
                                    <option value={`uv-sandbox:${env.env_id}`}>
                                      uv:{env.env_id}
                                    </option>
                                  )}
                                </For>
                              </select>
                            </div>
                          </div>

                          {/* Purge Cache Action */}
                          <Show when={!m.loaded && diskMb() > 0}>
                            <div class="flex justify-end pt-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isBusy()}
                                onClick={() => void props.handlePurgeDiskCache(m.engine_id)}
                                class="h-6 px-2 text-[10px] font-mono text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 class="w-3 h-3 mr-1" />
                                <span>Purge SSD Shards ({diskMb()} MB)</span>
                              </Button>
                            </div>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
