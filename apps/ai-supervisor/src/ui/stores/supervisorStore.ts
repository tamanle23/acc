import { createSignal, onCleanup, onMount } from "solid-js";
import type {
  SupervisorStatusResponse,
  SupervisorConfig,
  FleetTelemetrySnapshot,
  AuditEventEntry,
  StreamConnectionStatus,
} from "../types";

export function createSupervisorStore() {
  const [status, setStatus] = createSignal<SupervisorStatusResponse | null>(null);
  const [telemetry, setTelemetry] = createSignal<FleetTelemetrySnapshot | null>(null);
  const [auditEvents, setAuditEvents] = createSignal<readonly AuditEventEntry[]>([]);
  const [streamStatus, setStreamStatus] = createSignal<StreamConnectionStatus>("CONNECTING");
  const [isLoading, setIsLoading] = createSignal<boolean>(true);
  const [error, setError] = createSignal<string | null>(null);
  const [activeLogService, setActiveLogService] = createSignal<string>("supervisor");
  const [logs, setLogs] = createSignal<readonly string[]>([]);
  const [logFilter, setLogFilter] = createSignal<string>("");
  const [isActionPending, setIsActionPending] = createSignal<boolean>(false);
  const [toastMessage, setToastMessage] = createSignal<{ text: string; type: "info" | "success" | "error" } | null>(null);
  const [isAuditDrawerOpen, setIsAuditDrawerOpen] = createSignal<boolean>(false);
  const [isTtsPlaygroundOpen, setIsTtsPlaygroundOpen] = createSignal<boolean>(false);

  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let eventSource: EventSource | null = null;

  const showToast = (text: string, type: "info" | "success" | "error" = "info") => {
    if (toastTimer) clearTimeout(toastTimer);
    setToastMessage({ text, type });
    toastTimer = setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SupervisorStatusResponse = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    const service = activeLogService();
    const filter = encodeURIComponent(logFilter());
    try {
      const res = await fetch(`/api/logs/${service}?filter=${filter}&limit=250`);
      if (!res.ok) return;
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch {
      // ignore transient poll errors
    }
  };

  const fetchAuditHistory = async () => {
    try {
      const res = await fetch("/api/telemetry/audits");
      if (!res.ok) return;
      const data: AuditEventEntry[] = await res.json();
      setAuditEvents(data);
    } catch {}
  };

  const setupEventSource = () => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;

    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    setStreamStatus("CONNECTING");
    eventSource = new EventSource("/api/telemetry/stream");

    eventSource.onopen = () => {
      setStreamStatus("CONNECTED");
    };

    eventSource.addEventListener("telemetry", (e: MessageEvent) => {
      try {
        const snapshot: FleetTelemetrySnapshot = JSON.parse(e.data);
        setTelemetry(snapshot);

        // Synchronize service statuses from real-time telemetry snapshot into status store
        if (snapshot.services) {
          setStatus((prev) => {
            if (!prev) return prev;
            const updatedServices = { ...prev.services };
            for (const [name, sidecar] of Object.entries(snapshot.services)) {
              if (updatedServices[name]) {
                updatedServices[name] = {
                  ...updatedServices[name],
                  status: sidecar.status,
                  uptimeSeconds: sidecar.uptimeSeconds ?? updatedServices[name].uptimeSeconds,
                  pid: sidecar.pid ?? updatedServices[name].pid,
                };
              }
            }
            return {
              ...prev,
              services: updatedServices,
            };
          });
        }
      } catch {}
    });

    eventSource.addEventListener("audit", (e: MessageEvent) => {
      try {
        const audit: AuditEventEntry = JSON.parse(e.data);
        setAuditEvents((prev) => [audit, ...prev].slice(0, 200));

        if (audit.eventType === "OOM_INTERCEPTED") {
          showToast(`OOM Alert: ${audit.message}`, "error");
        }
      } catch {}
    });

    eventSource.addEventListener("audit_history", (e: MessageEvent) => {
      try {
        const audits: AuditEventEntry[] = JSON.parse(e.data);
        setAuditEvents(audits);
      } catch {}
    });

    eventSource.addEventListener("alert", (e: MessageEvent) => {
      try {
        const alert = JSON.parse(e.data);
        showToast(`[${alert.service}] ${alert.message}`, alert.level === "critical" ? "error" : "info");
      } catch {}
    });

    eventSource.onerror = () => {
      setStreamStatus("RECONNECTING");
    };
  };

  const controlService = async (serviceName: string, action: "start" | "stop" | "restart") => {
    setIsActionPending(true);
    try {
      const res = await fetch(`/api/service/${serviceName}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error(`Failed to ${action} ${serviceName}`);
      showToast(`Service ${serviceName}: ${action} executed`, "success");
      await fetchStatus();
      await fetchLogs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setIsActionPending(false);
    }
  };

  const purgeVram = async () => {
    setIsActionPending(true);
    try {
      const res = await fetch("/api/vram/purge", { method: "POST" });
      if (!res.ok) throw new Error("VRAM purge failed");
      showToast("VRAM purge command dispatched across fleet", "success");
      await fetchLogs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setIsActionPending(false);
    }
  };

  const restartAll = async () => {
    setIsActionPending(true);
    try {
      const res = await fetch("/api/service/all/restart", { method: "POST" });
      if (!res.ok) throw new Error("Restart all failed");
      showToast("All supervised services restarted", "success");
      await fetchStatus();
      await fetchLogs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setIsActionPending(false);
    }
  };

  const checkUpdates = async () => {
    setIsActionPending(true);
    try {
      const res = await fetch("/api/update/check", { method: "POST" });
      const data = await res.json();
      if (data.available) {
        showToast(`Update v${data.status.targetVersion} is available!`, "info");
      } else {
        showToast("ACC Control Plane is on the latest version", "success");
      }
      await fetchStatus();
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
    } finally {
      setIsActionPending(false);
    }
  };

  const saveConfig = async (configUpdate: Partial<SupervisorConfig>) => {
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configUpdate),
      });
      if (!res.ok) throw new Error("Failed to save config");
      showToast("Configuration saved successfully", "success");
      await fetchStatus();
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), "error");
      return false;
    }
  };

  onMount(() => {
    // Initial fetch
    fetchStatus();
    fetchLogs();
    fetchAuditHistory();

    // Stream telemetry live without HTTP setInterval polling
    setupEventSource();

    onCleanup(() => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (toastTimer) clearTimeout(toastTimer);
    });
  });

  return {
    status,
    telemetry,
    auditEvents,
    streamStatus,
    isLoading,
    error,
    activeLogService,
    setActiveLogService: (s: string) => {
      setActiveLogService(s);
      fetchLogs();
    },
    logs,
    logFilter,
    setLogFilter: (f: string) => {
      setLogFilter(f);
      fetchLogs();
    },
    isActionPending,
    toastMessage,
    isAuditDrawerOpen,
    setIsAuditDrawerOpen,
    isTtsPlaygroundOpen,
    setIsTtsPlaygroundOpen,
    controlService,
    purgeVram,
    restartAll,
    checkUpdates,
    saveConfig,
    refreshStatus: fetchStatus,
    refreshLogs: fetchLogs,
  };
}
