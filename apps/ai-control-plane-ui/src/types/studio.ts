import type {
  ModalityFamily,
  OutputModality,
} from "@ai-monorepo/ai-control-plane-sdk";

export type StudioWorkspaceId = "pipelines" | "hf" | "env" | "telemetry" | "sdk";

export type Cell4Mode = "dag" | "ledger" | "arena";

export type ExecutionStatus = "idle" | "executing" | "streaming" | "error";

export interface LifecycleNotice {
  type: "success" | "warning" | "info";
  message: string;
}

export interface UnifiedSessionRunRecord {
  id: string;
  timestamp: string;
  engineId: string;
  displayName: string;
  family: ModalityFamily;
  pipelineType: string;
  modality: OutputModality;
  inputSnippet: string;
  rawInput: string;
  parameters: Record<string, any>;
  output: any;
  audioUrl?: string;
  voice?: string;
  durationSeconds?: number;
  executionTarget: string;
  roundtripMs: number;
  requestId: string;
  payloadSha256: string;
}

export interface StreamTelemetry {
  ttfaMs: number | null;
  chunksReceived: number;
  bytesStreamed: number;
  payloadSha256: string;
}

