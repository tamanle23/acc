import { Show } from "solid-js";
import { Cpu, HardDrive, Microchip, Layers } from "lucide-solid";
import type { HardwareProfile } from "../types";

interface TelemetryGridProps {
  profile: HardwareProfile | undefined;
  isLoading: boolean;
}

export function TelemetryGrid(props: TelemetryGridProps) {
  const ramMetrics = () => {
    if (!props.profile) return { freeGb: "0.0", totalGb: "0.0", pctUsed: 0 };
    const free = props.profile.freeSystemRamBytes / (1024 * 1024 * 1024);
    const total = props.profile.totalSystemRamBytes / (1024 * 1024 * 1024);
    const used = total - free;
    const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
    return {
      freeGb: free.toFixed(1),
      totalGb: total.toFixed(1),
      pctUsed: pct,
    };
  };

  return (
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
      {/* 1. Hardware Profile */}
      <div class="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs flex flex-col justify-between transition-colors">
        <div class="flex items-center justify-between text-[var(--text-muted)] mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider">Hardware Accelerator</span>
          <Microchip class="w-4 h-4 text-[var(--accent-primary)]" />
        </div>
        <div>
          <Show
            when={!props.isLoading && props.profile}
            fallback={<div class="h-6 w-3/4 bg-[var(--border-subtle)] rounded animate-pulse" />}
          >
            <div class="text-base font-bold text-[var(--text-primary)] truncate" title={props.profile?.gpu?.name || "CPU (Software Fallback)"}>
              {props.profile?.gpu?.name || "CPU (Software Fallback)"}
            </div>
            <div class="text-xs text-[var(--text-muted)] mt-1">
              Tier: <span class="font-medium text-[var(--text-primary)]">{props.profile?.activeTier.toUpperCase()}</span>
            </div>
          </Show>
        </div>
      </div>

      {/* 2. System RAM */}
      <div class="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs flex flex-col justify-between transition-colors">
        <div class="flex items-center justify-between text-[var(--text-muted)] mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider">System RAM</span>
          <HardDrive class="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <Show
            when={!props.isLoading && props.profile}
            fallback={<div class="h-6 w-1/2 bg-[var(--border-subtle)] rounded animate-pulse" />}
          >
            <div class="text-base font-bold text-[var(--text-primary)]">
              {ramMetrics().freeGb} <span class="text-xs text-[var(--text-muted)] font-normal">/ {ramMetrics().totalGb} GB Free</span>
            </div>
            <div class="w-full bg-[var(--border-subtle)]/60 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div
                class={`h-1.5 rounded-full transition-all duration-500 ${
                  ramMetrics().pctUsed > 85 ? "bg-rose-500" : ramMetrics().pctUsed > 65 ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${ramMetrics().pctUsed}%` }}
              />
            </div>
          </Show>
        </div>
      </div>

      {/* 3. Python Device */}
      <div class="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs flex flex-col justify-between transition-colors">
        <div class="flex items-center justify-between text-[var(--text-muted)] mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider">Python AI Target</span>
          <Layers class="w-4 h-4 text-[var(--accent-primary)]" />
        </div>
        <div>
          <Show
            when={!props.isLoading && props.profile}
            fallback={<div class="h-6 w-1/3 bg-[var(--border-subtle)] rounded animate-pulse" />}
          >
            <div class="text-base font-bold text-[var(--text-primary)] uppercase">
              {props.profile?.recommendedPythonDevice || "CPU"}
            </div>
            <div class="text-xs text-[var(--text-muted)] mt-1">
              Kokoro TTS & Sam Vision Device
            </div>
          </Show>
        </div>
      </div>

      {/* 4. CPU Cores */}
      <div class="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs flex flex-col justify-between transition-colors">
        <div class="flex items-center justify-between text-[var(--text-muted)] mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider">Active CPU Cores</span>
          <Cpu class="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <Show
            when={!props.isLoading && props.profile}
            fallback={<div class="h-6 w-1/4 bg-[var(--border-subtle)] rounded animate-pulse" />}
          >
            <div class="text-base font-bold text-[var(--text-primary)]">
              {props.profile?.cpuCores || "--"} <span class="text-xs text-[var(--text-muted)] font-normal">Physical / Logic</span>
            </div>
            <div class="text-xs text-[var(--text-muted)] mt-1">
              Worker Concurrency Host
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
}
