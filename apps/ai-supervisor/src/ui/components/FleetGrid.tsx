import { ServiceCard } from "./ServiceCard";
import type { ServiceMap } from "../types";

interface FleetGridProps {
  services: ServiceMap | undefined;
  isActionPending: boolean;
  onControlService: (name: string, action: "start" | "stop" | "restart") => void;
  onPurgeVram: () => void;
  onOpenStudio: () => void;
}

export function FleetGrid(props: FleetGridProps) {
  const getService = (name: string) => {
    return (
      props.services?.[name] ?? {
        name,
        status: "STOPPED",
        uptimeSeconds: 0,
        restartCount: 0,
      }
    );
  };

  return (
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
      {/* 1. Python Backend */}
      <ServiceCard
        displayName="Python Backend"
        description="Kokoro TTS & Segment Anything (SAM) Vision service"
        service={getService("python-backend")}
        isActionPending={props.isActionPending}
        onControl={(action) => props.onControlService("python-backend", action)}
      />

      {/* 2. Worker Hypervisor */}
      <ServiceCard
        displayName="Worker Daemon"
        description="Workflow worker host"
        service={getService("worker")}
        isActionPending={props.isActionPending}
        onControl={(action) => props.onControlService("worker", action)}
      />

      {/* 3. Studio Web Server */}
      <ServiceCard
        displayName="Studio NLE"
        description="Non-linear video editor web client interface"
        service={getService("studio")}
        isActionPending={props.isActionPending}
        onControl={(action) => props.onControlService("studio", action)}
        customAction={{
          label: "View Studio",
          onClick: props.onOpenStudio,
        }}
      />

      {/* 4. Ollama AI Inference */}
      <ServiceCard
        displayName="Ollama Inference"
        description="Local LLM story script synthesis & reasoning engine"
        service={getService("ollama")}
        isActionPending={props.isActionPending}
        onControl={(action) => props.onControlService("ollama", action)}
        customAction={{
          label: "Unload Models",
          onClick: props.onPurgeVram,
        }}
      />
    </div>
  );
}
