import { ServiceCard } from "./ServiceCard";
import type { ServiceMap, FleetTelemetrySnapshot } from "../types";

interface FleetGridProps {
  services: ServiceMap | undefined;
  telemetry: FleetTelemetrySnapshot | null;
  isActionPending: boolean;
  onControlService: (name: string, action: "start" | "stop" | "restart") => void;
  onPurgeVram: () => void;
  onOpenStudio: () => void;
  onOpenTtsPlayground?: () => void;
}

export function FleetGrid(props: FleetGridProps) {
  const getService = (name: string) => {
    const baseService = props.services?.[name] ?? {
      name,
      status: "STOPPED",
      uptimeSeconds: 0,
      restartCount: 0,
    };
    const telemetryService = props.telemetry?.services?.[name];
    if (telemetryService) {
      return {
        ...baseService,
        status: telemetryService.status || baseService.status,
        uptimeSeconds: telemetryService.uptimeSeconds ?? baseService.uptimeSeconds,
        pid: (telemetryService.pid ?? baseService.pid) as number | undefined,
      };
    }
    return baseService;
  };

  const getServiceTelemetry = (name: string) => {
    return props.telemetry?.services?.[name];
  };

  return (
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
      {/* 1. AI Control Plane (Unified AI Inference) */}
      <ServiceCard
        displayName="AI Control Plane"
        description="Unified Multi-Modal AI Inference Backend (VieNeu-TTS, Kokoro, Qwen, FLUX)"
        service={getService("ai-control-plane")}
        telemetry={getServiceTelemetry("ai-control-plane")}
        isActionPending={props.isActionPending}
        onControl={(action) => props.onControlService("ai-control-plane", action)}
        customAction={{
          label: "Test Voice",
          onClick: props.onOpenTtsPlayground || props.onPurgeVram,
        }}
      />

      {/* 2. Worker Hypervisor */}
      <ServiceCard
        displayName="Worker Daemon"
        description="Multiple purposes worker host"
        service={getService("worker")}
        telemetry={getServiceTelemetry("worker")}
        isActionPending={props.isActionPending}
        onControl={(action) => props.onControlService("worker", action)}
      />

      {/* 3. Studio Web Server */}
      <ServiceCard
        displayName="Studio NLE"
        description="Non-linear video editor web client interface"
        service={getService("studio")}
        telemetry={getServiceTelemetry("studio")}
        isActionPending={props.isActionPending}
        onControl={(action) => props.onControlService("studio", action)}
        customAction={{
          label: "View Studio",
          onClick: props.onOpenStudio,
        }}
      />
    </div>
  );
}
