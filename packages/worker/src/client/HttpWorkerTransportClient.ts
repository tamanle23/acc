import { TaskSnapshotDto, WorkerTransportClient } from '../types.js';

export interface HttpWorkerTransportClientOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  fetchFn?: typeof fetch;
}

export class HttpWorkerTransportClient implements WorkerTransportClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly fetch: typeof fetch;

  constructor(options: HttpWorkerTransportClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.headers = {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    };
    this.fetch = options.fetchFn ?? globalThis.fetch;
  }

  async pollBatch(
    tenantId: string,
    taskType: string,
    domain: string,
    batchSize: number,
    workerId: string
  ): Promise<TaskSnapshotDto[]> {
    const url = `${this.baseUrl}/api/v1/workflow/tasks/poll?tenantId=${encodeURIComponent(
      tenantId
    )}&taskType=${encodeURIComponent(taskType)}&domain=${encodeURIComponent(
      domain
    )}&batchSize=${batchSize}&workerId=${encodeURIComponent(workerId)}`;

    const res = await this.fetch(url, {
      method: 'GET',
      headers: this.headers,
    });

    if (!res.ok) {
      if (res.status === 404 || res.status === 204) return [];
      throw new Error(`pollBatch failed with HTTP ${res.status}`);
    }

    return (await res.json()) as TaskSnapshotDto[];
  }

  async reportTaskResult(
    taskId: string,
    workerId: string,
    completed: boolean,
    output: Record<string, unknown>,
    errorMessage?: string,
    callbackAfterSeconds?: number
  ): Promise<void> {
    const url = `${this.baseUrl}/api/v1/workflow/tasks/${encodeURIComponent(taskId)}/result`;
    const body = {
      workerId,
      completed,
      output,
      errorMessage,
      callbackAfterSeconds: callbackAfterSeconds ?? 0,
    };

    const res = await this.fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`reportTaskResult failed with HTTP ${res.status}`);
    }
  }

  async heartbeat(taskId: string, workerId: string): Promise<boolean> {
    const url = `${this.baseUrl}/api/v1/workflow/tasks/${encodeURIComponent(taskId)}/heartbeat`;
    const res = await this.fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ workerId }),
    });

    return res.ok;
  }
}
