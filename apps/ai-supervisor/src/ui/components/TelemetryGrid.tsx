import { Show } from "solid-js";
import { Progress, Tooltip } from "@ark-ui/solid";
import { Cpu, HardDrive, Layers, Microchip, Activity } from "lucide-solid";
import type { HardwareProfile, FleetTelemetrySnapshot } from "../types";

interface TelemetryGridProps {
  profile: HardwareProfile | undefined;
  telemetry: FleetTelemetrySnapshot | null;
  isLoading: boolean;
}

export function TelemetryGrid(props: TelemetryGridProps) {
  const ramMetrics = () => {
    const sys = props.telemetry?.system;
    if (sys && sys.totalMemoryMb > 0) {
      const totalGb = (sys.totalMemoryMb / 1024).toFixed(1);
      const freeGb = (sys.freeMemoryMb / 1024).toFixed(1);
      const usedGb = ((sys.totalMemoryMb - sys.freeMemoryMb) / 1024).toFixed(1);
      const pctUsed = Math.min(
        100,
        Math.round(((sys.totalMemoryMb - sys.freeMemoryMb) / sys.totalMemoryMb) * 100)
      );
      return { totalGb, freeGb, usedGb, pctUsed };
    }
    const prof = props.profile;
    if (prof && prof.totalSystemRamBytes > 0) {
      const totalGb = (prof.totalSystemRamBytes / (1024 * 1024 * 1024)).toFixed(1);
      const freeGb = (prof.freeSystemRamBytes / (1024 * 1024 * 1024)).toFixed(1);
      const usedGb = ((prof.totalSystemRamBytes - prof.freeSystemRamBytes) / (1024 * 1024 * 1024)).toFixed(1);
      const pctUsed = Math.min(
        100,
        Math.round(((prof.totalSystemRamBytes - prof.freeSystemRamBytes) / prof.totalSystemRamBytes) * 100)
      );
      return { totalGb, freeGb, usedGb, pctUsed };
    }
    return { totalGb: "0.0", freeGb: "0.0", usedGb: "0.0", pctUsed: 0 };
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
      totalCpuPercent: Math.min(100, Math.round(totalCpuPercent)),
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
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold text-sm text-[var(--text-primary)] truncate" title={props.profile?.gpu?.name || "Compute Host"}>
                {props.profile?.gpu?.name || "Compute Host"}
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

      {/* 2. System RAM & Sidecar RSS Footprint (with Ark UI Progress) */}
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

            {/* Ark UI Progress Primitive */}
            <Progress.Root value={ramMetrics().pctUsed} class="w-full mt-2">
              <Progress.Track class="w-full bg-[var(--border-subtle)]/60 rounded-full h-1.5 overflow-hidden">
                <Progress.Range
                  class={`h-full rounded-full transition-all duration-500 block ${
                    ramMetrics().pctUsed > 85 ? "bg-rose-500" : ramMetrics().pctUsed > 65 ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                />
              </Progress.Track>
            </Progress.Root>

            <div class="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1.5">
              <span>Free: {ramMetrics().freeGb} GB</span>
              <span title="Resident Set Size consumed across child services">
                Fleet RSS: <span class="font-mono text-[var(--text-primary)]">{aggregateCpuAndMemory().totalSidecarRssMb} MB</span>
              </span>
            </div>
          </Show>
        </div>
      </div>

      {/* 3. Neural VRAM & Model Cache (with Ark UI Progress) */}
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

            {/* Ark UI Progress Primitive */}
            <Progress.Root value={vramMetrics().pct} class="w-full mt-2">
              <Progress.Track class="w-full bg-[var(--border-subtle)]/60 rounded-full h-1.5 overflow-hidden">
                <Progress.Range
                  class={`h-full rounded-full transition-all duration-500 block ${
                    vramMetrics().pct > 85 ? "bg-rose-500" : vramMetrics().pct > 60 ? "bg-amber-500" : "bg-[var(--accent-primary)]"
                  }`}
                />
              </Progress.Track>
            </Progress.Root>

            <div class="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1.5">
              <span>Cached Models: <span class="font-medium text-[var(--text-primary)]">{vramMetrics().cachedModels}</span></span>
              <span class="truncate max-w-[120px]" title="Kokoro TTS & VieNeu">
                Kokoro / VieNeu
              </span>
            </div>
          </Show>
        </div>
      </div>

      {/* 4. CPU Activity & Active Rendering Pipeline (with Ark UI Progress) */}
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
                {aggregateCpuAndMemory().totalCpuPercent}% <span class="text-xs text-[var(--text-muted)] font-normal">Active</span>
              </div>
              <span class="text-xs font-mono font-medium text-[var(--text-muted)] truncate max-w-[100px]">
                {props.profile?.cpu?.model ? props.profile.cpu.model.split(" ")[0] : `${props.profile?.cpu?.cores ?? 4} Cores`}
              </span>
            </div>

            {/* Ark UI Progress Primitive */}
            <Progress.Root value={aggregateCpuAndMemory().totalCpuPercent} class="w-full mt-2">
              <Progress.Track class="w-full bg-[var(--border-subtle)]/60 rounded-full h-1.5 overflow-hidden">
                <Progress.Range
                  class={`h-full rounded-full transition-all duration-500 block ${
                    aggregateCpuAndMemory().totalCpuPercent > 80 ? "bg-rose-500" : aggregateCpuAndMemory().totalCpuPercent > 50 ? "bg-amber-500" : "bg-sky-500"
                  }`}
                />
              </Progress.Track>
            </Progress.Root>

            <div class="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1.5">
              <Show
                when={workerMetrics()}
                fallback={<span>Pipeline: <span class="text-[var(--text-primary)]">Standby</span></span>}
              >
                {(wm) => (
                  <>
                    <span class="truncate max-w-[130px]" title={wm().activeJobId}>Job: {wm().activeJobId.slice(0, 8)}...</span>
                    <span class="font-mono text-[var(--text-primary)]">{wm().renderFps} FPS</span>
                  </>
                )}
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
