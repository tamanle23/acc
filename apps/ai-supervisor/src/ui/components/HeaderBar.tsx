import { Show } from "solid-js";
import {
  Activity,
  Flame,
  RotateCw,
  Sparkles,
  ExternalLink,
  Settings as SettingsIcon,
} from "lucide-solid";
import type { createSupervisorStore } from "../stores/supervisorStore";
import type { createThemeStore } from "../stores/themeStore";
import { ThemeSwitcher } from "./ThemeSwitcher";

interface HeaderBarProps {
  store: ReturnType<typeof createSupervisorStore>;
  themeStore: ReturnType<typeof createThemeStore>;
  onOpenSettings: () => void;
}

export function HeaderBar(props: HeaderBarProps) {
  const status = () => props.store.status();

  const tierBadgeText = () => {
    const s = status();
    if (!s) return "PROBING HARDWARE";
    const p = s.hardwareProfile || (s as any).profile;
    return p?.activeTier ? p.activeTier.toUpperCase() : "PROBING HARDWARE";
  };

  const trayBadgeStyle = () => {
    const s = status();
    if (!s) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    if (s.trayColor === "green") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (s.trayColor === "yellow") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    return "bg-rose-500/20 text-rose-400 border-rose-500/30";
  };

  const trayLabel = () => {
    const s = status();
    if (!s) return "Fleet Initializing";
    if (s.trayColor === "green") return "All Systems Operational";
    if (s.trayColor === "yellow") return "Fleet Active / Processing";
    return "Service Alert Required";
  };

  const handleOpenStudio = () => {
    const s = status();
    const port = s?.services?.studio?.port ?? s?.config?.studioPort ?? 3300;
    window.open(`http://localhost:${port}`, "_blank");
  };

  return (
    <header class="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[var(--border-subtle)] gap-4 transition-colors">
      <div class="flex items-center gap-3">
        <div class="p-2.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--border-focus)]/30 text-[var(--accent-primary)] shadow-inner transition-colors">
          <Activity class="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-xl font-bold tracking-tight text-[var(--text-primary)]">ACC Control Plane</h1>
            <span class="px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-[var(--accent-subtle)] text-[var(--accent-primary)] border-[var(--border-focus)]/30">
              {tierBadgeText()}
            </span>
          </div>
          <div class="flex items-center gap-2 mt-1">
            <span class={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${trayBadgeStyle()}`}>
              <span class="w-1.5 h-1.5 rounded-full mr-1.5 bg-current animate-ping" />
              {trayLabel()}
            </span>
            <Show when={status()?.update?.state === "READY"}>
              <span class="px-2 py-0.5 text-xs font-medium rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                Update Ready (v{status()?.update?.targetVersion})
              </span>
            </Show>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        {/* Preset Theme Switcher */}
        <ThemeSwitcher themeStore={props.themeStore} />

        <button
          onClick={() => props.store.purgeVram()}
          disabled={props.store.isActionPending()}
          title="Evict loaded models and clear VRAM across fleet"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Flame class="w-3.5 h-3.5 text-rose-400" />
          Purge VRAM
        </button>

        <button
          onClick={() => props.store.restartAll()}
          disabled={props.store.isActionPending()}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <RotateCw class="w-3.5 h-3.5" />
          Restart Fleet
        </button>

        <button
          onClick={() => props.store.checkUpdates()}
          disabled={props.store.isActionPending()}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Sparkles class="w-3.5 h-3.5 text-amber-400" />
          Check Updates
        </button>

        <button
          onClick={props.onOpenSettings}
          title="Control Plane Settings"
          class="p-2 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
        >
          <SettingsIcon class="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        <button
          onClick={handleOpenStudio}
          class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white shadow-sm transition-all cursor-pointer"
        >
          <ExternalLink class="w-3.5 h-3.5" />
          Open Studio
        </button>
      </div>
    </header>
  );
}
