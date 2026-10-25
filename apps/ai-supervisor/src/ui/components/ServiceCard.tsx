import { Play, Square, RotateCw } from "lucide-solid";
import type { ServiceState, ServiceStatus } from "../types";

interface ServiceCardProps {
  service: ServiceState;
  displayName: string;
  description: string;
  isActionPending: boolean;
  telemetry?: {
    cpuPercent?: number;
    memoryRssMb?: number;
    domain?: any;
  };
  onControl: (action: "start" | "stop" | "restart") => void;
  onViewLogs?: () => void;
  customAction?: {
    label: string;
    onClick: () => void;
  };
}

export function ServiceCard(props: ServiceCardProps) {
  const statusClasses = (status: ServiceStatus) => {
    switch (status) {
      case "RUNNING":
      case "ADOPTED":
        return "bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]";
      case "STARTING":
      case "BUSY":
        return "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]";
      case "CRASH_LOOP":
      case "UNHEALTHY":
        return "bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]";
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
    <div
      class="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between hover:border-[var(--border-focus)]/60 transition-all"
      style={{
        "box-shadow": "var(--card-shadow)",
        "backdrop-filter": "var(--surface-backdrop)",
        "-webkit-backdrop-filter": "var(--surface-backdrop)",
      }}
    >
      <div>
        <div class="flex items-start justify-between gap-3 mb-2">
          <div>
            <h3 class="font-semibold text-[var(--text-primary)] text-base">{props.displayName}</h3>
            <p class="text-xs text-[var(--text-muted)] mt-0.5">{props.description}</p>
          </div>
          <span class={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusClasses(props.service.status)}`}>
            {props.service.status}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2 py-3 my-2 text-xs border-y border-[var(--border-subtle)] text-[var(--text-muted)]">
          <div>
            <span class="text-[var(--text-muted)] block text-[11px]">Port / PID</span>
            <span class="font-mono font-medium text-[var(--text-primary)]">
              {props.service.port ? `:${props.service.port}` : "--"}{props.service.pid ? ` (${props.service.pid})` : ""}
            </span>
          </div>
          <div>
            <span class="text-[var(--text-muted)] block text-[11px]">CPU / RSS</span>
            <span class="font-mono font-medium text-[var(--text-primary)]">
              {props.telemetry?.cpuPercent !== undefined ? `${props.telemetry.cpuPercent.toFixed(1)}%` : "0%"} / {props.telemetry?.memoryRssMb ?? 0}MB
            </span>
          </div>
          <div>
            <span class="text-[var(--text-muted)] block text-[11px]">Uptime</span>
            <span class="font-mono font-medium text-[var(--text-primary)]">{formatUptime(props.service.uptimeSeconds)}</span>
          </div>
        </div>

        {props.service.lastError && (
          <div class="text-xs text-[var(--status-error-text)] bg-[var(--status-error-bg)] p-2 rounded border border-[var(--status-error-border)] mb-3 truncate">
            {props.service.lastError}
          </div>
        )}
      </div>

      <div class="flex flex-wrap items-center gap-2 pt-2">
        <button
          onClick={() => props.onControl("start")}
          disabled={isRunning() || props.isActionPending}
          class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--status-success-bg)] hover:brightness-110 text-[var(--status-success-text)] border border-[var(--status-success-border)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <Play class="w-3 h-3 text-[var(--status-success-text)]" />
          Start
        </button>

        <button
          onClick={() => props.onControl("stop")}
          disabled={!isRunning() || props.isActionPending}
          class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--status-error-bg)] hover:brightness-110 text-[var(--status-error-text)] border border-[var(--status-error-border)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <Square class="w-3 h-3 text-[var(--status-error-text)]" />
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
