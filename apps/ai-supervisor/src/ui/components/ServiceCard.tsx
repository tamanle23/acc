import { Play, Square, RotateCw } from "lucide-solid";
import type { ServiceState, ServiceStatus } from "../types";

interface ServiceCardProps {
  service: ServiceState;
  displayName: string;
  description: string;
  isActionPending: boolean;
  onControl: (action: "start" | "stop" | "restart") => void;
  onViewLogs?: () => void;
  customAction?: {
    label: string;
    onClick: () => void;
  };
}

export function ServiceCard(props: ServiceCardProps) {
  const statusColor = (status: ServiceStatus) => {
    switch (status) {
      case "RUNNING":
      case "ADOPTED":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "STARTING":
      case "BUSY":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "CRASH_LOOP":
      case "UNHEALTHY":
        return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "STOPPED":
      default:
        return "bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]";
    }
  };

  const isRunning = () =>
    props.service.status === "RUNNING" ||
    props.service.status === "ADOPTED" ||
    props.service.status === "BUSY";

  const formatUptime = (seconds: number) => {
    if (!seconds || seconds <= 0) return "0s";
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  };

  return (
    <div class="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs flex flex-col justify-between hover:border-[var(--border-focus)]/50 transition-colors">
      <div>
        <div class="flex items-start justify-between gap-3 mb-2">
          <div>
            <h3 class="font-semibold text-[var(--text-primary)] text-base">{props.displayName}</h3>
            <p class="text-xs text-[var(--text-muted)] mt-0.5">{props.description}</p>
          </div>
          <span class={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusColor(props.service.status)}`}>
            {props.service.status}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2 py-3 my-2 text-xs border-y border-[var(--border-subtle)] text-[var(--text-muted)]">
          <div>
            <span class="text-[var(--text-muted)] block text-[11px]">Port</span>
            <span class="font-mono font-medium text-[var(--text-primary)]">{props.service.port ?? "--"}</span>
          </div>
          <div>
            <span class="text-[var(--text-muted)] block text-[11px]">PID</span>
            <span class="font-mono font-medium text-[var(--text-primary)]">{props.service.pid ?? "--"}</span>
          </div>
          <div>
            <span class="text-[var(--text-muted)] block text-[11px]">Uptime</span>
            <span class="font-mono font-medium text-[var(--text-primary)]">{formatUptime(props.service.uptimeSeconds)}</span>
          </div>
        </div>

        {props.service.lastError && (
          <div class="text-xs text-rose-400 bg-rose-950/30 p-2 rounded border border-rose-900/50 mb-3 truncate">
            {props.service.lastError}
          </div>
        )}
      </div>

      <div class="flex flex-wrap items-center gap-2 pt-2">
        <button
          onClick={() => props.onControl("start")}
          disabled={isRunning() || props.isActionPending}
          class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/60 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <Play class="w-3 h-3 text-emerald-400" />
          Start
        </button>

        <button
          onClick={() => props.onControl("stop")}
          disabled={!isRunning() || props.isActionPending}
          class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/60 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <Square class="w-3 h-3 text-rose-400" />
          Stop
        </button>

        <button
          onClick={() => props.onControl("restart")}
          disabled={props.isActionPending}
          class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-subtle)] text-[var(--text-primary)] border border-[var(--border-subtle)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <RotateCw class="w-3 h-3 text-[var(--text-muted)]" />
          Restart
        </button>

        {props.customAction && (
          <button
            onClick={props.customAction.onClick}
            class="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--accent-subtle)] hover:bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--border-focus)]/30 cursor-pointer transition-colors"
          >
            {props.customAction.label}
          </button>
        )}
      </div>
    </div>
  );
}
