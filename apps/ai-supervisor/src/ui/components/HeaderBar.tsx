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
    if (!s) return "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]";
    if (s.trayColor === "green") return "bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]";
    if (s.trayColor === "yellow") return "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]";
    return "bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]";
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
    <header class="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-[var(--border-subtle)] gap-4 transition-colors">
      <div class="flex items-center gap-3">
        <div class="p-2.5 rounded-xl bg-[var(--accent-subtle)] border border-[var(--border-focus)]/30 text-[var(--accent-primary)] shadow-xs">
          <Activity class="w-6 h-6" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              ACC AI-Supervisor
            </h1>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
              v1.0.0
            </span>
          </div>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-xs text-[var(--text-muted)]">
              Hybrid Multi-Daemon Control Plane
            </span>
            <span class="text-[10px] text-[var(--text-muted)]">•</span>
            <span class={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${trayBadgeStyle()}`}>
              {trayLabel()}
            </span>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2 self-end sm:self-auto">
        <Show when={status()?.hardwareProfile || (status() as any)?.profile}>
          <div
            class="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)]"
            title="Active Hardware Acceleration Tier"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
            <span class="font-mono text-[11px] font-semibold text-[var(--text-primary)]">{tierBadgeText()}</span>
          </div>
        </Show>

        <ThemeSwitcher themeStore={props.themeStore} />

        <button
          onClick={() => props.store.purgeVram()}
          title="Force release inactive models & VRAM from GPU memory"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--status-error-bg)] hover:brightness-110 text-[var(--status-error-text)] border border-[var(--status-error-border)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          disabled={props.store.isActionPending()}
        >
          <Flame class="w-3.5 h-3.5 text-[var(--status-error-text)]" />
          Purge VRAM
        </button>

        <button
          onClick={() => props.store.refreshStatus()}
          title="Refresh fleet telemetry & status"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          disabled={props.store.isLoading()}
        >
          <RotateCw class={`w-3.5 h-3.5 text-[var(--text-muted)] ${props.store.isLoading() ? "animate-spin" : ""}`} />
          Refresh
        </button>

        <button
          onClick={props.onOpenSettings}
          title="Supervisor & fleet settings"
          class="p-2 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
        >
          <SettingsIcon class="w-4 h-4 text-[var(--text-muted)]" />
        </button>

        <button
          onClick={handleOpenStudio}
          title="Launch Studio NLE in default browser"
          class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white shadow-xs transition-all cursor-pointer"
        >
          <span>Open Studio</span>
          <ExternalLink class="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
