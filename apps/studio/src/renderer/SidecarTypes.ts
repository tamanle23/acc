import type { ResolvedTrack, ResolvedSequence, ModifierNode, AssetDefinition } from '@acc/ir';

export type TaskType = 'EXECUTE_MODIFIER' | 'WARMUP' | 'RESET' | 'CANCEL_TASK';

export type SidecarTargetEntity = ResolvedTrack | ResolvedSequence;

export interface ExecuteModifierPayload {
  taskId: string;
  targetType: 'track' | 'sequence';
  targetId: string;
  targetEntity: SidecarTargetEntity;
  rawEntity?: unknown;
  modifier: ModifierNode;
  assets?: Record<string, AssetDefinition | { src: string; type?: string }>;
  fps: number;
  canvas: { width: number; height: number };
}

export function isResolvedTrack(entity: SidecarTargetEntity | unknown): entity is ResolvedTrack {
  return typeof entity === 'object' && entity !== null && 'sequences' in entity && Array.isArray((entity as ResolvedTrack).sequences);
}

export function isResolvedSequence(entity: SidecarTargetEntity | unknown): entity is ResolvedSequence {
  return typeof entity === 'object' && entity !== null && 'startFrame' in entity && 'durationFrames' in entity;
}

export type SidecarMessage =
  | { type: 'WARMUP' }
  | { type: 'EXECUTE_MODIFIER'; payload: ExecuteModifierPayload }
  | { type: 'CANCEL_TASK'; taskId: string; targetId?: string }
  | { type: 'RESET' };

export type SidecarResponse =
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

// Backward-compatible aliases for existing callers
export type WorkerMessage = SidecarMessage;
export type WorkerResponse = SidecarResponse;

