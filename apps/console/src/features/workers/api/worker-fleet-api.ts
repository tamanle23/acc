import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

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

export function useWorkerFleet(refreshInterval: number = 3000) {
  return useQuery<WorkerFleetResponse>({
    queryKey: WORKER_FLEET_QUERY_KEY,
    queryFn: async () => {
      const response = await axios.get<WorkerFleetResponse>('/api/v1/workflow/workers');
      return response.data;
    },
    refetchInterval: refreshInterval > 0 ? refreshInterval : false,
  });
}

export function useDrainWorker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workerId: string) => {
      const response = await axios.post(`/api/v1/workflow/workers/${encodeURIComponent(workerId)}/drain`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKER_FLEET_QUERY_KEY });
    },
  });
}
