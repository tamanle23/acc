import { Component, For, Show } from "solid-js";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Cpu,
  Plus,
  Search,
  Palette,
  Sun,
  Moon,
} from "lucide-solid";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ModelCatalogEntry } from "@acc/ai-control-plane-sdk";
import type { ThemePreset } from "@/lib/themes";

export interface StudioHeaderProps {
  sidebarExpanded: boolean;
  onToggleSidebar: () => void;
  activeEngineId: string;
  onSelectEngine: (engineId: string) => void;
  catalogModels: ModelCatalogEntry[];
  onOpenHubModal: () => void;
  onOpenCommandPalette: () => void;
  currentTheme: ThemePreset;
  presets: readonly ThemePreset[];
  onSetThemeById: (themeId: string) => void;
  onOpenGallery: () => void;
  onCycleQuickMode: () => void;
  isClusterHealthy: boolean;
}

export const StudioHeader: Component<StudioHeaderProps> = (props) => {
  return (
    <header class="h-14 shrink-0 border-b border-border/80 bg-surface/90 backdrop-blur-xl px-4 lg:px-6 flex items-center justify-between gap-3 z-30">
      <div class="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={props.onToggleSidebar}
          class="hidden md:inline-flex h-9 w-9"
          aria-label={
            props.sidebarExpanded
              ? "Collapse navigation rail"
              : "Expand navigation rail"
          }
          title="Toggle Navigation Rail"
        >
          <Show
            when={props.sidebarExpanded}
            fallback={<PanelLeftOpen class="w-4 h-4" />}
          >
            <PanelLeftClose class="w-4 h-4" />
          </Show>
        </Button>

        <div class="p-2 bg-primary/15 border border-primary/30 rounded-lg text-primary shadow-glow shrink-0">
          <Cpu class="w-4 h-4" aria-hidden="true" />
        </div>

        <div class="truncate">
          <div class="flex items-center gap-2">
            <h1 class="font-semibold text-xs sm:text-sm text-foreground tracking-tight truncate">
              Unified Multi-Modal AI Inference Cockpit
            </h1>
            <Badge variant="default" class="hidden sm:inline-flex text-[10px]">
              Studio v32
            </Badge>
          </div>
        </div>

        <select
          value={props.activeEngineId}
          onChange={(e) => props.onSelectEngine(e.currentTarget.value)}
          aria-label="Active Multi-Modal Engine"
          class="hidden xl:block h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <For each={props.catalogModels}>
            {(m) => (
              <option value={m.engine_id}>
                [{m.pipeline_type}] {m.display_name} (
                {m.weights?.weight_tier ?? "balanced_fp16"})
              </option>
            )}
          </For>
        </select>

        <Button
          variant="outline"
          size="sm"
          onClick={props.onOpenHubModal}
          class="hidden lg:inline-flex h-8 text-xs"
        >
          <Plus class="w-3.5 h-3.5 text-primary" />
          <span>Model Hub</span>
        </Button>
      </div>

      <button
        type="button"
        onClick={props.onOpenCommandPalette}
        class="hidden lg:flex items-center justify-between gap-6 px-3.5 py-1.5 rounded-lg border border-border bg-card/85 hover:border-primary/50 text-xs text-muted-foreground transition w-72 xl:w-96 shadow-inner"
      >
        <span class="flex items-center gap-2 truncate">
          <Search class="w-3.5 h-3.5 text-primary" />
          <span>Search Hardware Tiers, Nano INT4..Ultra FP32, or 20 themes...</span>
        </span>
        <kbd class="px-1.5 py-0.5 text-[10px] font-mono bg-surface border border-border rounded text-foreground">
          ⌘K
        </kbd>
      </button>

      <div class="flex items-center gap-2 shrink-0">
        <div class="hidden 2xl:flex items-center gap-1 bg-card border border-border rounded-lg p-1">
          <For each={props.presets.slice(0, 4)}>
            {(preset) => (
              <button
                onClick={() => props.onSetThemeById(preset.id)}
                title={`Switch to ${preset.name}`}
                class={`px-2 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1.5 ${
                  props.currentTheme.id === preset.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  class="w-2 h-2 rounded-full border border-border"
                  style={{ "background-color": preset.swatches[2] }}
                />
                <span>{preset.name.split(" ")[0]}</span>
              </button>
            )}
          </For>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={props.onOpenGallery}
          aria-label="Open 20-Theme Studio Gallery"
          class="h-9"
        >
          <Palette class="w-3.5 h-3.5 text-primary" />
          <span class="hidden sm:inline">{props.currentTheme.name}</span>
          <Badge variant="default" class="px-1.5 py-0 text-[10px]">
            20
          </Badge>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={props.onCycleQuickMode}
          title="Toggle Dark / Light Studio Mode"
          aria-label="Toggle Dark or Light Studio Mode"
          class="h-9 w-9"
        >
          <Show
            when={props.currentTheme.mode === "light"}
            fallback={<Moon class="w-4 h-4 text-primary" />}
          >
            <Sun class="w-4 h-4 text-amber-500" />
          </Show>
        </Button>

        <div
          role="status"
          aria-live="polite"
          class="flex items-center gap-1.5 px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs"
        >
          <span
            class={`w-2 h-2 rounded-full ${
              props.isClusterHealthy
                ? "bg-success animate-pulse"
                : "bg-destructive"
            }`}
          />
          <span class="text-foreground font-medium hidden sm:inline">
            {props.isClusterHealthy ? "Cluster Online" : "Offline"}
          </span>
        </div>
      </div>
    </header>
  );
};
