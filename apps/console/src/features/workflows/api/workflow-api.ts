import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth/api-client';
import type { WorkflowIR } from '../components/studio';
import type { WorkflowDefinitionSummary, WorkflowExecutionSnapshot } from '@acc/client';
import type { ApprovalTask } from '@/core/sandbox/handlers/approvals-sandbox-handler';
import { toast } from 'sonner';
import { type AxiosError } from 'axios';
import { getErrorMessage, type ApiErrorResponse } from '@/core/utils/error-extractor';

export type { WorkflowDefinitionSummary, WorkflowExecutionSnapshot, ApprovalTask };

// 1. Fetch Workflow Definitions
export const useWorkflowDefinitions = () => {
  return useQuery({
    queryKey: ['workflows', 'definitions'],
    queryFn: async (): Promise<WorkflowDefinitionSummary[]> => {
      try {
        const res = await springApiClient.get('/v1/workflow/definitions');
        if (res.status === 200) {
          const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
          return list;
        }
        return [];
      } catch (err) {
        console.warn('Failed to fetch workflow definitions from backend:', err);
        return [];
      }
    },
    staleTime: 60 * 1000,
  });
};

// 2. Fetch Single Workflow Definition by Key
export const useWorkflowDefinition = (workflowKey: string | null) => {
  return useQuery({
    queryKey: ['workflows', 'definition', workflowKey],
    queryFn: async (): Promise<WorkflowDefinitionSummary | null> => {
      if (!workflowKey) return null;
      try {
        const res = await springApiClient.get(`/v1/workflow/definitions/${workflowKey}`);
        if (res.status === 200) {
          return res.data;
        }
        return null;
      } catch (err) {
        console.warn(`Failed to fetch workflow definition ${workflowKey}:`, err);
        return null;
      }
    },
    enabled: Boolean(workflowKey),
  });
};

// 3. Save / Upsert Workflow Definition
export const useSaveWorkflowDefinition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ir: WorkflowIR) => {
      const res = await springApiClient.post('/v1/workflow/definitions', ir);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Workflow "${data.name || data.workflowKey}" saved successfully`);
      queryClient.invalidateQueries({ queryKey: ['workflows', 'definitions'] });
      if (data.workflowKey) {
        queryClient.invalidateQueries({ queryKey: ['workflows', 'definition', data.workflowKey] });
      }
    },
    onError: (err: AxiosError<ApiErrorResponse> | Error) => {
      toast.error(getErrorMessage(err, 'Failed to save workflow definition'));
    },
  });
};

// 4. Toggle Workflow Definition Status
export const useToggleWorkflowStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workflowKey, status }: { workflowKey: string; status: 'ACTIVE' | 'DISABLED' }) => {
      const res = await springApiClient.put(`/v1/workflow/definitions/${workflowKey}`, { status });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Workflow status updated');
      queryClient.invalidateQueries({ queryKey: ['workflows', 'definitions'] });
    },
    onError: (err: AxiosError<ApiErrorResponse> | Error) => {
      toast.error(getErrorMessage(err, 'Failed to toggle status'));
    },
  });
};

// 5. Delete Workflow Definition
export const useDeleteWorkflowDefinition = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workflowKey: string) => {
      const res = await springApiClient.delete(`/v1/workflow/definitions/${workflowKey}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Workflow definition deleted');
      queryClient.invalidateQueries({ queryKey: ['workflows', 'definitions'] });
    },
    onError: (err: AxiosError<ApiErrorResponse> | Error) => {
      toast.error(getErrorMessage(err, 'Failed to delete definition'));
    },
  });
};

// 6. Start Live Workflow Execution
export const useStartWorkflowExecution = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ workflowKey, input }: { workflowKey: string; input?: Record<string, unknown> }) => {
      const res = await springApiClient.post('/v1/workflow/executions', {
        workflowKey,
        input: input || {},
      });
      return res.data as WorkflowExecutionSnapshot;
    },
    onSuccess: (data) => {
      toast.success(`Workflow execution started (${data.workflowId})`);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: AxiosError<ApiErrorResponse> | Error) => {
      toast.error(getErrorMessage(err, 'Failed to start execution'));
    },
  });
};

// 7. Execution Status Polling
export const useWorkflowExecutionStatus = (executionId: string | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['workflows', 'execution', executionId],
    queryFn: async (): Promise<WorkflowExecutionSnapshot | null> => {
      if (!executionId) return null;
      const res = await springApiClient.get(`/v1/workflow/executions/${executionId}`);
      return res.data;
    },
    enabled: Boolean(executionId) && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2000;
      if (['COMPLETED', 'FAILED', 'TERMINATED', 'TIMED_OUT'].includes(data.status)) {
        return false;
      }
      return 1500;
    },
  });
};

// 8. Workflow Definition Versions
export interface WorkflowDefinitionVersionItem {
  definitionId: string;
  tenantId: string;
  workflowKey: string;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';
  name: string;
  description: string;
  definition: Record<string, unknown>;
  publishedAtMs?: number | null;
  publishedBy?: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export const useWorkflowVersions = (workflowKey: string | null) => {
  return useQuery({
    queryKey: ['workflows', 'versions', workflowKey],
    queryFn: async (): Promise<WorkflowDefinitionVersionItem[]> => {
      if (!workflowKey) return [];
      try {
        const res = await springApiClient.get(`/v1/workflow/definitions/${workflowKey}/versions`);
        return Array.isArray(res.data) ? res.data : [];
      } catch (err) {
        console.warn(`Failed to fetch versions for ${workflowKey}:`, err);
        return [];
      }
    },
    enabled: Boolean(workflowKey),
  });
};

export type MigrationTier = 'FULLY_COMPATIBLE' | 'CONDITIONAL_REQUIRES_MANUAL_REVIEW' | 'INCOMPATIBLE_BLOCK';

// 9. Hot Migration Dry Run
export interface MigrationValidationReport {
  compatible: boolean;
  tier?: MigrationTier;
  sourceVersion: string;
  targetVersion: string;
  completedTasksPreserved: string[];
  activeFrontierTasks: string[];
  addedDownstreamTasks: string[];
  removedTasks: string[];
  issues: string[];
  warnings?: string[];
}

export const useMigrationDryRun = () => {
  return useMutation({
    mutationFn: async ({ executionId, targetDefinition }: { executionId: string; targetDefinition: Record<string, unknown> }) => {
      const res = await springApiClient.post(`/v1/workflow/executions/${executionId}/migrate/dry-run`, targetDefinition);
      return res.data as MigrationValidationReport;
    },
  });
};

// 10. Execute Hot Migration
export const useMigrateExecution = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ executionId, targetDefinition }: { executionId: string; targetDefinition: Record<string, unknown> }) => {
      const res = await springApiClient.post(`/v1/workflow/executions/${executionId}/migrate`, targetDefinition);
      return res.data;
    },
    onSuccess: (data, vars) => {
      toast.success(`Execution hot-migrated successfully to v${data.version || 'new'}`);
      queryClient.invalidateQueries({ queryKey: ['workflows', 'execution', vars.executionId] });
      queryClient.invalidateQueries({ queryKey: ['workflows', 'audit', vars.executionId] });
    },
    onError: (err: AxiosError<ApiErrorResponse> | Error) => {
      toast.error(getErrorMessage(err, 'Hot migration failed'));
    },
  });
};

// 11. Audit Ledger & Verification
export interface WorkflowAuditLogRecord {
  sequenceNum: number;
  eventId: string;
  workflowId: string;
  tenantId: string;
  actorId: string;
  action: string;
  payloadSnapshot: Record<string, unknown>;
  prevHash: string;
  currentHash: string;
  createdAtMs: number;
}

export interface AuditVerificationResult {
  verified: boolean;
  totalEvents: number;
  corruptedAtSequence?: number | null;
  details: string;
}

export const useWorkflowAuditLedger = (executionId: string | null) => {
  return useQuery({
    queryKey: ['workflows', 'audit', executionId],
    queryFn: async (): Promise<WorkflowAuditLogRecord[]> => {
      if (!executionId) return [];
      try {
        const res = await springApiClient.get(`/v1/workflow/executions/${executionId}/audit`);
        return Array.isArray(res.data) ? res.data : [];
      } catch (err) {
        console.warn(`Failed to fetch audit ledger for ${executionId}:`, err);
        return [];
      }
    },
    enabled: Boolean(executionId),
  });
};

export const useVerifyAuditLedger = (executionId: string | null) => {
  return useQuery({
    queryKey: ['workflows', 'audit', 'verify', executionId],
    queryFn: async (): Promise<AuditVerificationResult | null> => {
      if (!executionId) return null;
      try {
        const res = await springApiClient.get(`/v1/workflow/executions/${executionId}/audit/verify`);
        return res.data;
      } catch (err) {
        console.warn(`Failed to verify audit ledger for ${executionId}:`, err);
        return null;
      }
    },
    enabled: Boolean(executionId),
  });
};

// 12. Fleet / Batch Hot Migration
export interface FleetExecutionPreviewItem {
  workflowId: string;
  currentVersion: number;
  status: string;
  tier: MigrationTier;
  compatible: boolean;
  completedTasks: string[];
  activeTasks: string[];
  warnings: string[];
  issues: string[];
}

export interface FleetMigrationPreview {
  workflowKey: string;
  targetVersion: number;
  summary: {
    total: number;
    fullyCompatible: number;
    requiresReview: number;
    incompatible: number;
  };
  items: FleetExecutionPreviewItem[];
}

export interface FleetBatchMigrateResult {
  workflowKey: string;
  targetVersion: number;
  migrated: number;
  failed: number;
  results: Array<{ workflowId: string; success: boolean; error?: string }>;
}

export const useFleetMigrationPreview = (workflowKey: string | null, targetVersion: number | null) => {
  return useQuery({
    queryKey: ['workflows', 'fleet-migration-preview', workflowKey, targetVersion],
    queryFn: async (): Promise<FleetMigrationPreview | null> => {
      if (!workflowKey || !targetVersion) return null;
      const res = await springApiClient.post(`/v1/workflow/definitions/${workflowKey}/migration-preview`, {
        targetVersion,
      });
      return res.data;
    },
    enabled: Boolean(workflowKey && targetVersion),
  });
};

export const useFleetBatchMigrate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      workflowKey,
      targetVersion,
      executionIds,
      autoMigrateCompatibleOnly,
    }: {
      workflowKey: string;
      targetVersion: number;
      executionIds?: string[];
      autoMigrateCompatibleOnly?: boolean;
    }) => {
      const res = await springApiClient.post(`/v1/workflow/definitions/${workflowKey}/batch-migrate`, {
        targetVersion,
        executionIds,
        autoMigrateCompatibleOnly,
      });
      return res.data as FleetBatchMigrateResult;
    },
    onSuccess: (data) => {
      toast.success(`Batch migrated ${data.migrated} executions to v${data.targetVersion}`);
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-executions'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: AxiosError<ApiErrorResponse> | Error) => {
      toast.error(getErrorMessage(err, 'Batch migration failed'));
    },
  });
};

// 12. Fetch Human-in-the-Loop Approval Tasks
export const useApprovalTasks = (status?: string) => {
  return useQuery({
    queryKey: ['workflows', 'approvals', status],
    queryFn: async (): Promise<ApprovalTask[]> => {
      try {
        const res = await springApiClient.get('/v1/workflows/approvals', {
          params: status ? { status } : undefined,
        });
        if (res.status === 200) {
          return Array.isArray(res.data) ? res.data : res.data?.data || [];
        }
        return [];
      } catch {
        return [];
      }
    },
    staleTime: 30 * 1000,
  });
};

// 13. Resolve Human-in-the-Loop Approval Task
export const useResolveApprovalTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      action,
      rationale,
    }: {
      taskId: string;
      action: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED';
      rationale?: string;
    }): Promise<ApprovalTask> => {
      const res = await springApiClient.post(
        `/v1/workflows/approvals/${encodeURIComponent(taskId)}/resolve`,
        { action, rationale }
      );
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Approval task ${data.id} updated: ${data.status}`);
      queryClient.invalidateQueries({ queryKey: ['workflows', 'approvals'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data
          ?.error ||
        (err as Error)?.message ||
        'Failed to resolve approval task';
      toast.error(msg);
    },
  });
};

// 14. Workflow Visual Debugger Hooks (Phase 7)
export const useUpdateWorkflowBreakpoints = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      executionId,
      breakpoints,
    }: {
      executionId: string;
      breakpoints: string[];
    }) => {
      const res = await springApiClient.post(
        `/v1/workflow/executions/${encodeURIComponent(executionId)}/breakpoints`,
        { breakpoints }
      );
      return res.data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['workflows', 'execution', vars.executionId] });
    },
  });
};

export const usePauseWorkflowExecution = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (executionId: string) => {
      const res = await springApiClient.post(
        `/v1/workflow/executions/${encodeURIComponent(executionId)}/pause`
      );
      return res.data as WorkflowExecutionSnapshot;
    },
    onSuccess: (_data, executionId) => {
      toast.info('Workflow execution paused at breakpoint');
      queryClient.invalidateQueries({ queryKey: ['workflows', 'execution', executionId] });
    },
  });
};

export const useResumeWorkflowExecution = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (executionId: string) => {
      const res = await springApiClient.post(
        `/v1/workflow/executions/${encodeURIComponent(executionId)}/resume`
      );
      return res.data as WorkflowExecutionSnapshot;
    },
    onSuccess: (_data, executionId) => {
      toast.success('Workflow execution resumed');
      queryClient.invalidateQueries({ queryKey: ['workflows', 'execution', executionId] });
    },
  });
};

export const useStepOverWorkflowExecution = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (executionId: string) => {
      const res = await springApiClient.post(
        `/v1/workflow/executions/${encodeURIComponent(executionId)}/step`
      );
      return res.data as WorkflowExecutionSnapshot;
    },
    onSuccess: (_data, executionId) => {
      toast.success('Stepped over next frontier task');
      queryClient.invalidateQueries({ queryKey: ['workflows', 'execution', executionId] });
    },
  });
};

export const useRerunWorkflowTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      executionId,
      taskReferenceName,
      overrideInput,
    }: {
      executionId: string;
      taskReferenceName: string;
      overrideInput: Record<string, unknown>;
    }) => {
      const res = await springApiClient.post(
        `/v1/workflow/executions/${encodeURIComponent(executionId)}/tasks/${encodeURIComponent(taskReferenceName)}/rerun`,
        overrideInput
      );
      return res.data as WorkflowExecutionSnapshot;
    },
    onSuccess: (_data, vars) => {
      toast.success(`Re-running task "${vars.taskReferenceName}" with overridden input`);
      queryClient.invalidateQueries({ queryKey: ['workflows', 'execution', vars.executionId] });
    },
  });
};

export const useReplayWorkflowTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      executionId,
      taskId,
      overrideInput,
    }: {
      executionId: string;
      taskId: string;
      overrideInput: Record<string, unknown>;
    }) => {
      const res = await springApiClient.post(
        `/v1/workflow/executions/${encodeURIComponent(executionId)}/tasks/${encodeURIComponent(taskId)}/replay`,
        overrideInput
      );
      return res.data as WorkflowExecutionSnapshot;
    },
    onSuccess: (_data, vars) => {
      toast.success(`Repaired & replayed task "${vars.taskId}" from DLQ`);
      queryClient.invalidateQueries({ queryKey: ['workflows', 'execution', vars.executionId] });
      queryClient.invalidateQueries({ queryKey: ['dlq'] });
    },
  });
};

export const useSimulateWorkflowDefinition = () => {
  return useMutation({
    mutationFn: async ({
      definition,
      inputParameters,
    }: {
      definition: WorkflowIR;
      inputParameters?: Record<string, unknown>;
    }) => {
      const res = await springApiClient.post('/v1/workflow/definitions/simulate', {
        definition,
        inputParameters: inputParameters || {},
      });
      return res.data as WorkflowExecutionSnapshot;
    },
  });
};
