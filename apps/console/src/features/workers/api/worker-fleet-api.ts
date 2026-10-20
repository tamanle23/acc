import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth/api-client';

export interface TaskWorkerDescriptor {
  taskName: string;
  domain: string;
  description: string;
  maxConcurrency: number;
  timeoutSeconds: number;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface WorkerTelemetry {
  workerId: string;
  hostIp: string;
  runtime: 'JAVA_VIRTUAL_THREADS' | 'NODEJS_WORKER';
  pollDomains: string[];
  concurrencyLimit: number;
  activeLeases: number;
  tasksCompletedCount: number;
  errorCount: number;
  uptimeSeconds: number;
  lastHeartbeatEpochMs: number;
  status: 'HEALTHY' | 'DEGRADED' | 'OFFLINE' | 'DRAINING';
  capabilities?: TaskWorkerDescriptor[];
}

export interface WorkerFleetSummary {
  totalWorkers: number;
  activeLeases: number;
  totalCompletedTasks: number;
  healthyCount: number;
  degradedCount: number;
  offlineCount: number;
  drainingCount: number;
  tasksPerSecond: number;
}

export interface WorkerFleetResponse {
  summary: WorkerFleetSummary;
  workers: WorkerTelemetry[];
}

export const WORKER_FLEET_QUERY_KEY = ['workflow', 'workers'];
export const WORKER_CATALOG_QUERY_KEY = ['workflow', 'workers', 'catalog'];

export function useWorkerFleet(refreshInterval: number = 3000) {
  return useQuery<WorkerFleetResponse>({
    queryKey: WORKER_FLEET_QUERY_KEY,
    queryFn: async () => {
      const response = await springApiClient.get<WorkerFleetResponse>('/v1/workflow/workers');
      return response.data;
    },
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
  });
}

export function useWorkerCatalog() {
  return useQuery<TaskWorkerDescriptor[]>({
    queryKey: WORKER_CATALOG_QUERY_KEY,
    queryFn: async () => {
      try {
        const response = await springApiClient.get<TaskWorkerDescriptor[]>('/v1/workflow/workers/catalog');
        return Array.isArray(response.data) ? response.data : [];
      } catch {
        return [];
      }
    },
    staleTime: 30000,
  });
}

export function useDrainWorker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workerId: string) => {
      const response = await springApiClient.post(`/v1/workflow/workers/${encodeURIComponent(workerId)}/drain`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKER_FLEET_QUERY_KEY });
    },
  });
}
