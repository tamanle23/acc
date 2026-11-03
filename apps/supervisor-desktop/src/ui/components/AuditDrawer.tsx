import { createSignal, createMemo, For, Show } from "solid-js";
import { Drawer } from "@ark-ui/solid";
import {
  ShieldAlert,
  X,
  Clock,
  HardDrive,
  Cpu,
  Layers,
  Filter,
  CheckCircle2,
  AlertTriangle,
} from "lucide-solid";
import type { createSupervisorStore } from "../stores/supervisorStore";
import type { AuditEventEntry } from "../types";

interface AuditDrawerProps {
  store: ReturnType<typeof createSupervisorStore>;
}

export function AuditDrawer(props: AuditDrawerProps) {
  const [filterType, setFilterType] = createSignal<string>("ALL");

  const filteredEvents = createMemo(() => {
    const events = props.store.auditEvents();
    const filter = filterType();
    if (filter === "ALL") return events;
    return events.filter((e) => e.eventType === filter);
  });

  const oomCount = createMemo(() => {
    return props.store.auditEvents().filter((e) => e.eventType === "OOM_INTERCEPTED").length;
  });

  const getEventBadge = (eventType: AuditEventEntry["eventType"]) => {
    switch (eventType) {
      case "OOM_INTERCEPTED":
        return {
          bg: "bg-[var(--status-error-bg)] text-[var(--status-error-text)] border-[var(--status-error-border)]",
          icon: ShieldAlert,
          label: "OOM Circuit Breaker",
        };
      case "MODEL_LOADED":
        return {
          bg: "bg-[var(--status-success-bg)] text-[var(--status-success-text)] border-[var(--status-success-border)]",
          icon: CheckCircle2,
          label: "Model Loaded",
        };
      case "MODEL_EVICTED":
        return {
          bg: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border-[var(--status-warning-border)]",
          icon: Layers,
          label: "Auto Evicted",
        };
      default:
        return {
          bg: "bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border-[var(--border-subtle)]",
          icon: Clock,
          label: eventType,
        };
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <Drawer.Root
      open={props.store.isAuditDrawerOpen()}
      onOpenChange={(e) => props.store.setIsAuditDrawerOpen(e.open)}
    >
      <Drawer.Backdrop class="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-200" />
      <Drawer.Positioner class="fixed inset-y-0 right-0 z-50 flex max-w-full pl-10">
        <Drawer.Content class="w-screen max-w-md bg-[var(--bg-canvas)] border-l border-[var(--border-subtle)] shadow-2xl flex flex-col h-full transform transition-transform duration-300">
          {/* Header */}
          <div class="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
            <div class="flex items-center gap-2.5">
              <div class="p-2 rounded-lg bg-[var(--accent-subtle)] border border-[var(--border-focus)]/30 text-[var(--accent-primary)]">
                <ShieldAlert class="w-5 h-5" />
              </div>
              <div>
                <Drawer.Title class="text-base font-bold text-[var(--text-primary)]">
                  Model Lifecycle & OOM Audit
                </Drawer.Title>
                <Drawer.Description class="text-xs text-[var(--text-muted)]">
                  Real-time telemetry stream & circuit breaker forensics
                </Drawer.Description>
              </div>
            </div>

            <Drawer.CloseTrigger class="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition-colors cursor-pointer">
              <X class="w-5 h-5" />
            </Drawer.CloseTrigger>
          </div>

          {/* Quick Metrics Bar */}
          <div class="px-5 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]/50 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span class="text-[var(--text-muted)]">OOM Mitigations:</span>
              <span class={`font-mono font-bold px-2 py-0.5 rounded-full text-[11px] ${
                oomCount() > 0
                  ? "bg-[var(--status-error-bg)] text-[var(--status-error-text)] border border-[var(--status-error-border)]"
                  : "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
              }`}>
                {oomCount()}
              </span>
            </div>
            <div class="flex items-center gap-1.5 text-[var(--text-muted)] font-mono text-[11px]">
              <HardDrive class="w-3.5 h-3.5" />
              <span>Sliding Ring Buffer: {props.store.auditEvents().length} / 200</span>
            </div>
          </div>

          {/* Filter Tabs */}
          <div class="px-5 py-2.5 border-b border-[var(--border-subtle)] flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setFilterType("ALL")}
              class={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                filterType() === "ALL"
                  ? "bg-[var(--accent-primary)] text-white"
                  : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => setFilterType("OOM_INTERCEPTED")}
              class={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                filterType() === "OOM_INTERCEPTED"
                  ? "bg-[var(--status-error-bg)] text-[var(--status-error-text)] border border-[var(--status-error-border)]"
                  : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
              }`}
            >
              <AlertTriangle class="w-3 h-3 text-[var(--status-error-text)]" />
              OOM Alerts
            </button>
            <button
              onClick={() => setFilterType("MODEL_LOADED")}
              class={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                filterType() === "MODEL_LOADED"
                  ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]"
                  : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
              }`}
            >
              Loaded
            </button>
            <button
              onClick={() => setFilterType("MODEL_EVICTED")}
              class={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                filterType() === "MODEL_EVICTED"
                  ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]"
                  : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]"
              }`}
            >
              Evicted
            </button>
          </div>

          {/* Event Stream Timeline */}
          <div class="flex-1 overflow-y-auto p-5 space-y-3 font-mono text-xs">
            <Show
              when={filteredEvents().length > 0}
              fallback={
                <div class="h-64 flex flex-col items-center justify-center text-center text-[var(--text-muted)] p-6">
                  <CheckCircle2 class="w-8 h-8 text-[var(--status-success-text)] mb-2" />
                  <p class="font-semibold text-sm text-[var(--text-primary)]">No Anomaly Events</p>
                  <p class="text-xs mt-1">All sidecar models operating within headroom limits.</p>
                </div>
              }
            >
              <For each={filteredEvents()}>
                {(event) => {
                  const badge = getEventBadge(event.eventType);
                  const Icon = badge.icon;
                  return (
                    <div class="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] transition-colors shadow-xs">
                      <div class="flex items-center justify-between gap-2 mb-1.5">
                        <span class={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badge.bg}`}>
                          <Icon class="w-3 h-3" />
                          {badge.label}
                        </span>
                        <span class="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                          <Clock class="w-3 h-3" />
                          {formatTime(event.timestamp)}
                        </span>
                      </div>

                      <p class="text-xs font-sans text-[var(--text-primary)] leading-relaxed">
                        {event.message}
                      </p>

                      <Show when={event.details}>
                        <div class="mt-2 pt-2 border-t border-[var(--border-subtle)]/50 text-[10px] text-[var(--text-muted)] flex flex-wrap gap-2">
                          <For each={Object.entries(event.details || {})}>
                            {([k, v]) => (
                              <span class="px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
                                {k}: <strong class="text-[var(--text-primary)]">{String(v)}</strong>
                              </span>
                            )}
                          </For>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </Show>
          </div>

          {/* Footer Note */}
          <div class="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[10px] text-[var(--text-muted)] text-center">
            Persisted forensically to <code class="text-[var(--text-primary)]">~/.acc/supervisor/audit_events.jsonl</code>
          </div>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
}
