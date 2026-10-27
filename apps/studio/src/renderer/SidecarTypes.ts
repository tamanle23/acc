export type SidecarTaskType = 'EXECUTE_MODIFIER' | 'WARMUP' | 'RESET' | 'CANCEL_TASK';

export interface ExecuteModifierPayload {
  taskId: string;
  targetType: 'track' | 'sequence';
  targetId: string;
  targetEntity: Record<string, unknown>;
  modifier: {
    type: string;
    params: Record<string, unknown>;
  };
  assets?: Record<string, { src: string; type?: string }>;
  fps: number;
  canvas: { width: number; height: number };
}

export type SidecarWorkerMessage =
  | { type: 'WARMUP' }
  | { type: 'EXECUTE_MODIFIER'; payload: ExecuteModifierPayload }
  | { type: 'CANCEL_TASK'; taskId: string; targetId?: string }
  | { type: 'RESET' };

export type SidecarWorkerResponse =
  | { type: 'WARMED_UP' }
  | {
      type: 'MODIFIER_EXECUTED';
      taskId: string;
      targetId: string;
      modifierType: string;
      state?: Record<string, unknown>;
    }
  | { type: 'TASK_CANCELED'; taskId: string; targetId?: string }
  | { type: 'ERROR'; taskId?: string; targetId?: string; error: string };
