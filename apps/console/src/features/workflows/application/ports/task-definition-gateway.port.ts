import type { TaskDefinitionRecord, SaveTaskDefinitionInput } from '../../api/task-definition-api';

export interface RequestOptions {
  signal?: AbortSignal; // WinterTC ECMA-429 standard cancellation
}

/**
 * Driven Gateway Port (SPI) for Task Definitions.
 * Runtime-agnostic, zero Axios or React dependencies.
 */
export interface TaskDefinitionGatewayPort {
  listLatest(options?: RequestOptions): Promise<TaskDefinitionRecord[]>;
  getVersions(taskName: string, options?: RequestOptions): Promise<TaskDefinitionRecord[]>;
  saveDraft(input: SaveTaskDefinitionInput, options?: RequestOptions): Promise<TaskDefinitionRecord>;
  publishVersion(taskName: string, version: number, options?: RequestOptions): Promise<TaskDefinitionRecord>;
  deleteDraftVersion(taskName: string, version: number, options?: RequestOptions): Promise<boolean>;
}
