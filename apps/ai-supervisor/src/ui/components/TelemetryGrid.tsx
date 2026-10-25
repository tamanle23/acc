import { Show } from "solid-js";
import { Cpu, HardDrive, Microchip, Layers, Activity, Zap } from "lucide-solid";
import type { HardwareProfile, FleetTelemetrySnapshot } from "../types";

interface TelemetryGridProps {
  profile: HardwareProfile | undefined;
  telemetry?: FleetTelemetrySnapshot | null;
  isLoading: boolean;
}

export function TelemetryGrid(props: TelemetryGridProps) {
  const ramMetrics = () => {
    // Prefer real-time snapshot telemetry if available, fallback to hardwareProfile
    const totalMb = props.telemetry?.system?.totalMemoryMb ?? (props.profile ? props.profile.totalSystemRamBytes / (1024 * 1024) : 0);
    const freeMb = props.telemetry?.system?.freeMemoryMb ?? (props.profile ? props.profile.freeSystemRamBytes / (1024 * 1024) : 0);

    const totalGb = totalMb / 1024;
    const freeGb = freeMb / 1024;
    const usedGb = Math.max(0, totalGb - freeGb);
    const pctUsed = totalGb > 0 ? Math.min(100, Math.round((usedGb / totalGb) * 100)) : 0;

    return {
      freeGb: freeGb.toFixed(1),
      totalGb: totalGb.toFixed(1),
      usedGb: usedGb.toFixed(1),
      pctUsed,
    };
  };

  const vramMetrics = () => {
    const pythonTelemetry = props.telemetry?.services?.["python-backend"]?.domain;
    if (pythonTelemetry && pythonTelemetry.type === "python-backend") {
      const usedMb = pythonTelemetry.vramUsedMb;
      const totalMb = pythonTelemetry.totalVramBytes / (1024 * 1024);
      const pct = totalMb > 0 ? Math.min(100, Math.round((usedMb / totalMb) * 100)) : 0;
      return {
        hasData: true,
        usedMb,
        totalMb: Math.round(totalMb),
        pct,
        cachedModels: pythonTelemetry.cachedModelCount,
        activeModels: pythonTelemetry.activeModels,
      };
    }
    return {
      hasData: false,
      usedMb: 0,
      totalMb: 0,
      pct: 0,
      cachedModels: 0,
      activeModels: [],
    };
  };

  const workerMetrics = () => {
    const workerTelemetry = props.telemetry?.services?.["worker"]?.domain;
    if (workerTelemetry && workerTelemetry.type === "worker") {
      return {
        activeJobId: workerTelemetry.activeJobId,
        currentFrame: workerTelemetry.currentFrame,
        totalFrames: workerTelemetry.totalFrames,
        renderFps: workerTelemetry.renderFps,
      };
    }
    return null;
  };

  const aggregateCpuAndMemory = () => {
    let totalSidecarRssMb = 0;
    let totalCpuPercent = 0;
    if (props.telemetry?.services) {
      for (const svc of Object.values(props.telemetry.services)) {
        totalSidecarRssMb += svc.memoryRssMb || 0;
        totalCpuPercent += svc.cpuPercent || 0;
      }
    }
    return {
      totalSidecarRssMb: Math.round(totalSidecarRssMb),
      totalCpuPercent: Math.round(totalCpuPercent),
    };
  };

  return (
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
      {/* 1. Hardware Accelerator & Tier */}
      <div
        class="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between transition-all"
        style={{
          "box-shadow": "var(--card-shadow)",
          "backdrop-filter": "var(--surface-backdrop)",
          "-webkit-backdrop-filter": "var(--surface-backdrop)",
        }}
      >
        <div class="flex items-center justify-between text-[var(--text-muted)] mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider">Hardware Accelerator</span>
          <Microchip class="w-4 h-4 text-[var(--accent-primary)]" />
        </div>
        <div>
          <Show
            when={!props.isLoading && props.profile}
            fallback={<div class="h-6 w-3/4 bg-[var(--border-subtle)] rounded animate-pulse" />}
          >
            <div class="flex items-center justify-between gap-1">
              <span class="text-base font-bold text-[var(--text-primary)] truncate" title={props.profile?.gpu?.name || "CPU (Software Fallback)"}>
                {props.profile?.gpu?.name || "CPU (Software Fallback)"}
              </span>
              <Show when={props.profile?.gpu?.totalVramBytes && props.profile.gpu.totalVramBytes > 0}>
                <span class="text-[11px] font-mono font-medium px-1.5 py-0.5 rounded bg-[var(--accent-subtle)] text-[var(--accent-primary)] border border-[var(--border-focus)]/30 shrink-0">
                  {(props.profile!.gpu!.totalVramBytes! / (1024 * 1024 * 1024)).toFixed(0)}GB VRAM
                </span>
              </Show>
            </div>
            <div class="flex items-center justify-between text-xs text-[var(--text-muted)] mt-1.5">
              <span>Tier: <span class="font-medium text-[var(--text-primary)]">{props.profile?.activeTier.toUpperCase()}</span></span>
              <span class="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)]">
                {props.profile?.recommendedPythonDevice?.toUpperCase() ?? "CPU"}
              </span>
            </div>
            <div class="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1">
              <span class="truncate max-w-[150px]" title={props.profile?.gpu?.vendor || (props.profile?.gpu?.isAppleSilicon ? "Apple Silicon" : "Host")}>
                {props.profile?.gpu?.vendor ? `Vendor: ${props.profile.gpu.vendor}` : (props.profile?.gpu?.isAppleSilicon ? "UMA Shared" : "Direct Compute")}
              </span>
              <Show when={props.profile?.gpu?.metalSupport}>
                <span class="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                  {props.profile?.gpu?.metalSupport}
                </span>
              </Show>
            </div>
          </Show>
        </div>
      </div>

      {/* 2. System RAM & Sidecar RSS Footprint */}
      <div
        class="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between transition-all"
        style={{
          "box-shadow": "var(--card-shadow)",
          "backdrop-filter": "var(--surface-backdrop)",
          "-webkit-backdrop-filter": "var(--surface-backdrop)",
        }}
      >
        <div class="flex items-center justify-between text-[var(--text-muted)] mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider">System RAM</span>
          <HardDrive class="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <Show
            when={!props.isLoading && (props.profile || props.telemetry)}
            fallback={<div class="h-6 w-1/2 bg-[var(--border-subtle)] rounded animate-pulse" />}
          >
            <div class="flex items-baseline justify-between">
              <div class="text-base font-bold text-[var(--text-primary)]">
                {ramMetrics().usedGb} <span class="text-xs text-[var(--text-muted)] font-normal">/ {ramMetrics().totalGb} GB</span>
              </div>
              <span class="text-xs font-mono font-medium text-[var(--text-muted)]">
                {ramMetrics().pctUsed}%
              </span>
            </div>

            <div class="w-full bg-[var(--border-subtle)]/60 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                class={`h-1.5 rounded-full transition-all duration-500 ${
                  ramMetrics().pctUsed > 85 ? "bg-rose-500" : ramMetrics().pctUsed > 65 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${ramMetrics().pctUsed}%` }}
              />
            </div>

            <div class="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1.5">
              <span>Free: {ramMetrics().freeGb} GB</span>
              <span title="Resident Set Size consumed across child services">
                Fleet RSS: <span class="font-mono text-[var(--text-primary)]">{aggregateCpuAndMemory().totalSidecarRssMb} MB</span>
              </span>
            </div>
          </Show>
        </div>
      </div>

      {/* 3. Neural VRAM & Model Cache */}
      <div
        class="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between transition-all"
        style={{
          "box-shadow": "var(--card-shadow)",
          "backdrop-filter": "var(--surface-backdrop)",
          "-webkit-backdrop-filter": "var(--surface-backdrop)",
        }}
      >
        <div class="flex items-center justify-between text-[var(--text-muted)] mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider">Neural VRAM & Models</span>
          <Layers class="w-4 h-4 text-[var(--accent-primary)]" />
        </div>
        <div>
          <Show
            when={!props.isLoading}
            fallback={<div class="h-6 w-1/3 bg-[var(--border-subtle)] rounded animate-pulse" />}
          >
            <div class="flex items-baseline justify-between">
              <div class="text-base font-bold text-[var(--text-primary)]">
                {vramMetrics().usedMb} <span class="text-xs text-[var(--text-muted)] font-normal">/ {vramMetrics().totalMb > 0 ? `${(vramMetrics().totalMb / 1024).toFixed(1)} GB` : "Host"}</span>
              </div>
              <span class="text-xs font-mono font-medium text-[var(--text-muted)]">
                {vramMetrics().pct}%
              </span>
            </div>

            <div class="w-full bg-[var(--border-subtle)]/60 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                class={`h-1.5 rounded-full transition-all duration-500 ${
                  vramMetrics().pct > 85 ? "bg-rose-500" : vramMetrics().pct > 60 ? "bg-amber-500" : "bg-[var(--accent-primary)]"
                }`}
                style={{ width: `${Math.max(4, vramMetrics().pct)}%` }}
              />
            </div>

            <div class="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1.5">
              <span>Cached Models: <span class="font-medium text-[var(--text-primary)]">{vramMetrics().cachedModels}</span></span>
              <span class="truncate max-w-[120px]" title="Kokoro TTS & VieNeu">
                Kokoro / VieNeu
              </span>
            </div>
          </Show>
        </div>
      </div>

      {/* 4. CPU Activity & Active Rendering Pipeline */}
      <div
        class="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex flex-col justify-between transition-all"
        style={{
          "box-shadow": "var(--card-shadow)",
          "backdrop-filter": "var(--surface-backdrop)",
          "-webkit-backdrop-filter": "var(--surface-backdrop)",
        }}
      >
        <div class="flex items-center justify-between text-[var(--text-muted)] mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider">CPU & Render Pipeline</span>
          <Cpu class="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <Show
            when={!props.isLoading && (props.profile || props.telemetry)}
            fallback={<div class="h-6 w-1/4 bg-[var(--border-subtle)] rounded animate-pulse" />}
          >
            <div class="flex items-baseline justify-between">
              <div class="text-base font-bold text-[var(--text-primary)]">
                {props.profile?.cpuCores || props.telemetry?.system?.cpuCount || "--"} <span class="text-xs text-[var(--text-muted)] font-normal">Cores</span>
              </div>
              <span class="inline-flex items-center gap-1 text-xs font-mono font-medium text-amber-400">
                <Activity class="w-3 h-3 animate-pulse" />
                {aggregateCpuAndMemory().totalCpuPercent}% Fleet
              </span>
            </div>

            <div class="w-full bg-[var(--border-subtle)]/60 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                class="h-1.5 rounded-full bg-amber-400 transition-all duration-500"
                style={{ width: `${Math.min(100, aggregateCpuAndMemory().totalCpuPercent)}%` }}
              />
            </div>

            <div class="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1.5">
              <Show
                when={workerMetrics()?.activeJobId}
                fallback={
                  <>
                    <span class="truncate max-w-[140px]" title={props.profile?.cpu?.model || "Standard x86/ARM Processor"}>
                      {props.profile?.cpu?.model ? props.profile.cpu.model.split("@")[0].replace("Intel(R) Core(TM) ", "").trim() : "Worker Host"}
                    </span>
                    <span class="text-emerald-400 font-medium">Idle / Ready</span>
                  </>
                }
              >
                <span class="truncate max-w-[140px] text-[var(--accent-primary)] font-mono">
                  Job {workerMetrics()?.activeJobId?.slice(0, 8)}: {workerMetrics()?.currentFrame}/{workerMetrics()?.totalFrames}f
                </span>
                <span class="font-mono text-emerald-400">{workerMetrics()?.renderFps ?? 0} fps</span>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
