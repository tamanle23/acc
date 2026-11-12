import { Component, createEffect, createMemo, createSignal, For, Show } from "solid-js";
import {
  Search,
  Volume2,
  Boxes,
  Terminal,
  Activity,
  FileCode,
  Palette,
  RefreshCw,
  Sparkles,
  X,
  CornerDownLeft,
  LayoutGrid,
  Cpu,
  GitCompare,
  Workflow,
  Download,
  Wand2,
  Gauge,
} from "lucide-solid";
import { useThemeManager } from "@/components/studio/theme-manager";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { HardwareProfileId, ModelCatalogEntry } from "@acc/ai-control-plane-sdk";
import type { StudioWorkspaceId } from "@/types/studio";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkspace: (id: StudioWorkspaceId) => void;
  onSelectEngine?: (engineId: string) => void;
  onSelectHardwareProfile?: (profileId: HardwareProfileId) => void;
  onTriggerAutoAdaptHardware?: () => void;
  onTriggerArena?: () => void;
  onTriggerDagChain?: () => void;
  onTriggerStreamDag?: () => void;
  onTriggerExportDataset?: (format: "jsonl" | "csv") => void;
  onSelectVoice: (voiceId: string) => void;
  onLoadTemplate: (text: string) => void;
  onRefreshTelemetry: () => void;
  catalogModels?: ModelCatalogEntry[];
  voices: { label: string; voice_id: string }[];
  templates: { label: string; text: string }[];
}

export const StudioCommandPalette: Component<CommandPaletteProps> = (props) => {
  const { presets, setThemeById, openGallery } = useThemeManager();
  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let listRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (props.isOpen) {
      setQuery("");
      setSelectedIndex(0);
    }
  });

  createEffect(() => {
    query();
    setSelectedIndex(0);
  });

  const actions = createMemo(() => {
    const q = query().trim().toLowerCase();

    const list = [
      {
        id: "hw-auto-adapt",
        group: "Hardware-Adaptive Weight Tiering (v26)",
        label: "1-Click Auto-Adapt All Models to Active Local Hardware Power",
        icon: Gauge,
        run: () => props.onTriggerAutoAdaptHardware?.(),
      },
      {
        id: "hw-tier-1",
        group: "Hardware-Adaptive Weight Tiering (v26)",
        label: "Switch Hardware Power: Tier 1 • Edge / Ultrabook CPU (2GB VRAM • Nano INT4 + CPU Offload)",
        icon: Cpu,
        run: () => props.onSelectHardwareProfile?.("tier_1_edge_cpu"),
      },
      {
        id: "hw-tier-2",
        group: "Hardware-Adaptive Weight Tiering (v26)",
        label: "Switch Hardware Power: Tier 2 • Consumer GPU (6–8GB VRAM • Compact INT8 + Hybrid KV)",
        icon: Cpu,
        run: () => props.onSelectHardwareProfile?.("tier_2_consumer_8gb"),
      },
      {
        id: "hw-tier-3",
        group: "Hardware-Adaptive Weight Tiering (v26)",
        label: "Switch Hardware Power: Tier 3 • Prosumer Studio GPU (12–16GB VRAM • Balanced FP16)",
        icon: Cpu,
        run: () => props.onSelectHardwareProfile?.("tier_3_prosumer_16gb"),
      },
      {
        id: "hw-tier-4",
        group: "Hardware-Adaptive Weight Tiering (v26)",
        label: "Switch Hardware Power: Tier 4 • Enthusiast Workstation (24GB VRAM • Studio BF16 FlashAttention-2)",
        icon: Cpu,
        run: () => props.onSelectHardwareProfile?.("tier_4_workstation_24gb"),
      },
      {
        id: "hw-tier-5",
        group: "Hardware-Adaptive Weight Tiering (v26)",
        label: "Switch Hardware Power: Tier 5 • Datacenter Multi-GPU (48–80GB VRAM • Ultra FP32 Full-Fidelity)",
        icon: Cpu,
        run: () => props.onSelectHardwareProfile?.("tier_5_datacenter_48gb"),
      },
      {
        id: "trigger-arena",
        group: "AI Model Arena & Blind Evaluation (v26)",
        label: "Launch Blind Head-to-Head Arena Comparison Test",
        icon: GitCompare,
        run: () => props.onTriggerArena?.(),
      },
      {
        id: "trigger-dag-sync",
        group: "Multi-Modal DAG Pipeline (v26)",
        label: "Execute Multi-Modal DAG: ASR Transcribe -> LLM Summarize -> TTS Audio",
        icon: Workflow,
        run: () => props.onTriggerDagChain?.(),
      },
      {
        id: "trigger-dag-stream",
        group: "Multi-Modal DAG Pipeline (v26)",
        label: "Stream Live DAG Execution: Parallel Multi-Modal Stage Walkthrough",
        icon: Workflow,
        run: () => props.onTriggerStreamDag?.(),
      },
      {
        id: "export-jsonl",
        group: "Telemetry & Dataset Export (v26)",
        label: "Export Verified Inference Telemetry & DAG Traces to JSONL",
        icon: Download,
        run: () => props.onTriggerExportDataset?.("jsonl"),
      },
      {
        id: "export-csv",
        group: "Telemetry & Dataset Export (v26)",
        label: "Export Verified Inference Telemetry & Latencies to CSV",
        icon: Download,
        run: () => props.onTriggerExportDataset?.("csv"),
      },
      {
        id: "open-theme-gallery",
        group: "Studio Customization",
        label: "Open 20-Theme Studio Gallery (Catppuccin, Tokyo Night, Dracula, etc.)",
        icon: Palette,
        run: () => openGallery(),
      },
      {
        id: "reset-theme",
        group: "Studio Customization",
        label: "Reset Studio Theme to Default (Obsidian Zinc)",
        icon: RefreshCw,
        run: () => setThemeById("obsidian-zinc"),
      },
      {
        id: "ws-pipelines",
        group: "Workspaces",
        label: "Switch to Bespoke Pipeline Studios",
        icon: Sparkles,
        run: () => props.onSelectWorkspace("pipelines"),
      },
      {
        id: "ws-weights",
        group: "Workspaces",
        label: "Switch to Hardware Tiering & Weights",
        icon: Boxes,
        run: () => props.onSelectWorkspace("hf"),
      },
      {
        id: "ws-env",
        group: "Workspaces",
        label: "Switch to uv Sandbox Orchestrator",
        icon: Terminal,
        run: () => props.onSelectWorkspace("env"),
      },
      {
        id: "ws-telemetry",
        group: "Workspaces",
        label: "Switch to SQLite WAL & Telemetry",
        icon: Activity,
        run: () => props.onSelectWorkspace("telemetry"),
      },
      {
        id: "ws-sdk",
        group: "Workspaces",
        label: "Switch to WinterTC Edge SDK",
        icon: FileCode,
        run: () => props.onSelectWorkspace("sdk"),
      },
      ...(props.catalogModels || []).map((m) => ({
        id: `engine-${m.engine_id}`,
        group: `Catalog: ${m.pipeline_type.toUpperCase()}`,
        label: `Select Model: ${m.display_name} (${m.engine_id}) [Tier: ${m.weights?.weight_tier ?? "balanced_fp16"}]`,
        icon: Boxes,
        run: () => props.onSelectEngine?.(m.engine_id),
      })),
      ...props.voices.map((v) => ({
        id: `voice-${v.voice_id}`,
        group: "Voice Presets",
        label: `Select Voice: ${v.label}`,
        icon: Volume2,
        run: () => props.onSelectVoice(v.voice_id),
      })),
      ...props.templates.map((t, idx) => ({
        id: `tpl-${idx}`,
        group: "Prompt Templates",
        label: `Load Template: "${t.label}"`,
        icon: Sparkles,
        run: () => props.onLoadTemplate(t.text),
      })),
      ...presets.map((t) => ({
        id: `theme-${t.id}`,
        group: `Theme: ${t.category}`,
        label: `Apply Theme: ${t.name} (${t.mode.toUpperCase()} • ${t.description})`,
        icon: Palette,
        run: () => setThemeById(t.id),
      })),
    ];

    if (!q) return list;
    return list.filter(
      (action) =>
        action.label.toLowerCase().includes(q) ||
        action.group.toLowerCase().includes(q)
    );
  });

  const visibleActions = createMemo(() => actions().slice(0, 38));

  const clampedIndex = createMemo(() => {
    const len = visibleActions().length;
    return len > 0 ? Math.max(0, Math.min(selectedIndex(), len - 1)) : 0;
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    const len = visibleActions().length;
    if (len === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = (clampedIndex() + 1) % len;
      setSelectedIndex(next);
      const el = listRef?.querySelector(`[data-cmd-idx="${next}"]`);
      el?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (clampedIndex() - 1 + len) % len;
      setSelectedIndex(prev);
      const el = listRef?.querySelector(`[data-cmd-idx="${prev}"]`);
      el?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Home") {
      e.preventDefault();
      setSelectedIndex(0);
      const el = listRef?.querySelector(`[data-cmd-idx="0"]`);
      el?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "End") {
      e.preventDefault();
      const last = len - 1;
      setSelectedIndex(last);
      const el = listRef?.querySelector(`[data-cmd-idx="${last}"]`);
      el?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = visibleActions()[clampedIndex()];
      if (target) {
        target.run();
        props.onClose();
      }
    }
  };

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-start justify-center bg-background/80 backdrop-blur-sm pt-16 px-4"
        role="dialog"
        aria-modal="true"
        aria-label="Studio Command Palette"
        onClick={props.onClose}
      >
        <div
          class="w-full max-w-2xl rounded-2xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <div class="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface/70">
            <Search class="w-4 h-4 text-primary shrink-0" />
            <Input
              autofocus
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
              aria-label="Search studio commands"
              placeholder="Search Hardware Tiers (Edge 2GB..Datacenter 48GB), Weight Tiers (Nano INT4..Ultra FP32), DAGs..."
              class="border-0 bg-transparent focus-visible:ring-0 h-9 px-0 text-sm"
            />
            <Badge variant="outline" class="shrink-0 font-mono text-[10px]">
              ↑↓ ENTER • ESC
            </Badge>
            <button
              type="button"
              onClick={props.onClose}
              class="text-muted-foreground hover:text-foreground p-1"
              aria-label="Close command palette"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div
            id="studio-command-listbox"
            ref={listRef}
            role="listbox"
            aria-label="Available Studio Commands"
            class="max-h-[60vh] overflow-y-auto p-2 space-y-1 studio-scroll"
          >
            <Show
              when={visibleActions().length > 0}
              fallback={
                <p class="text-xs text-muted-foreground text-center py-8">
                  No matching studio commands found.
                </p>
              }
            >
              <For each={visibleActions()}>
                {(item, idx) => {
                  const Icon = item.icon;
                  const isSelected = () => idx() === clampedIndex();
                  return (
                    <button
                      id={`cmd-opt-${item.id}`}
                      data-cmd-idx={idx()}
                      role="option"
                      aria-selected={isSelected()}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(idx())}
                      onClick={() => {
                        item.run();
                        props.onClose();
                      }}
                      class={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left text-xs transition group ${
                        isSelected()
                          ? "bg-primary/20 text-foreground border border-primary/40 shadow-sm"
                          : "hover:bg-primary/15 hover:text-foreground border border-transparent"
                      }`}
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <Icon class="w-4 h-4 text-primary shrink-0" />
                        <span class="truncate font-medium text-foreground">
                          {item.label}
                        </span>
                      </div>
                      <div class="flex items-center gap-2 shrink-0">
                        <span class="text-[10px] font-mono text-muted-foreground">
                          {item.group}
                        </span>
                        <CornerDownLeft
                          class={`w-3.5 h-3.5 text-primary transition ${
                            isSelected()
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          }`}
                        />
                      </div>
                    </button>
                  );
                }}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};
