import { createStore } from "solid-js/store";
import type {
  SystemHealthResponse,
  HostHardwareTelemetry,
} from "@ai-monorepo/ai-control-plane-sdk";

export const [telemetryState, setTelemetryState] = createStore({
  health: null as SystemHealthResponse | null,
  hostTelemetry: {
    cpu_cores: 8,
    architecture: "x86_64",
    platform_system: "Linux",
    system_ram_mb: 16384,
    cuda_available: false,
    detected_tier_id: "tier_2_consumer_8gb",
  } as HostHardwareTelemetry,
  ledgerEntries: [] as any[],
  pingLatencyMs: 4.2,
  activeWorkers: 2,
  circuitOpen: false,
});
