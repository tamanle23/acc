import { createSignal, onCleanup, onMount } from "solid-js";
import type {
  SupervisorStatusResponse,
  SupervisorConfig,
  FleetTelemetrySnapshot,
} from "../types";

export function createSupervisorStore() {
  const [status, setStatus] = createSignal<SupervisorStatusResponse | null>(null);
  const [telemetry, setTelemetry] = createSignal<FleetTelemetrySnapshot | null>(null);
  const [isLoading, setIsLoading] = createSignal<boolean>(true);
  const [error, setError] = createSignal<string | null>(null);
  const [activeLogService, setActiveLogService] = createSignal<string>("supervisor");
  const [logs, setLogs] = createSignal<readonly string[]>([]);
  const [logFilter, setLogFilter] = createSignal<string>("");
  const [isActionPending, setIsActionPending] = createSignal<boolean>(false);
  const [toastMessage, setToastMessage] = createSignal<{ text: string; type: "info" | "success" | "error" } | null>(null);

  let toastTimer: ReturnType<typeof setTimeout> | null = null;
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

  const fetchTelemetry = async () => {
    try {
      const res = await fetch("/api/telemetry/snapshot");
      if (!res.ok) return;
      const data: FleetTelemetrySnapshot = await res.json();
      setTelemetry(data);
    } catch {
      // transient telemetry network error
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
    fetchStatus();
    fetchTelemetry();
    fetchLogs();
    const statusInterval = setInterval(fetchStatus, 2000);
    const telemetryInterval = setInterval(fetchTelemetry, 1500);
    const logsInterval = setInterval(fetchLogs, 3000);

    onCleanup(() => {
      clearInterval(statusInterval);
      clearInterval(telemetryInterval);
      clearInterval(logsInterval);
      if (toastTimer) clearTimeout(toastTimer);
    });
  });

  return {
    status,
    telemetry,
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
    controlService,
    purgeVram,
    restartAll,
    checkUpdates,
    saveConfig,
    refreshStatus: fetchStatus,
    refreshTelemetry: fetchTelemetry,
    refreshLogs: fetchLogs,
  };
}
