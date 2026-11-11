import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import type {
  UnifiedSessionRunRecord,
  ExecutionStatus,
  StreamTelemetry,
} from "@/types/studio";
import type { PipelineCategoryId } from "@ai-monorepo/ai-control-plane-sdk";

export const [studioState, setStudioState] = createStore({
  pipelineCategory: "all" as "all" | PipelineCategoryId,
  params: {} as Record<string, Record<string, any>>,
  inputs: {} as Record<string, any>,
  activeRuns: [] as UnifiedSessionRunRecord[],
  activeOutputs: {} as Record<string, any>,
  executionStatus: "idle" as ExecutionStatus,
  sidebarExpanded: false,
  commandPaletteOpen: false,
  activeAudioUrl: null as string | null,
  activeAudioRecord: null as UnifiedSessionRunRecord | null,
  streamTelemetry: null as StreamTelemetry | null,
});

export const [activeTab, setActiveTab] = createSignal<string>("pipelines");

export function appendSessionRun(run: UnifiedSessionRunRecord) {
  setStudioState("activeRuns", (prev) => [run, ...prev].slice(0, 50));
  setStudioState("activeOutputs", run.engineId, run.output);
  if (run.audioUrl) {
    setStudioState("activeAudioUrl", run.audioUrl);
    setStudioState("activeAudioRecord", run);
  }
}

export function setEngineParam(engineId: string, paramKey: string, value: any) {
  setStudioState("params", engineId, paramKey, value);
}

export function setEngineInput(engineId: string, input: any) {
  setStudioState("inputs", engineId, input);
}
