import { useContext } from 'react';
import { useMutation, useQuery, QueryClientContext, QueryClient } from '@tanstack/react-query';
import { springApiClient } from '@/features/spring-auth/api-client';
import { useSandboxStore } from '@/core/sandbox/store/sandbox-store';
import { useMetadataUiStore } from '@/features/metadata/store/use-metadata-ui-store';
import { taskContractRegistry } from '../components/studio/utils/contracts/task-contract-registry';
import { toast } from 'sonner';

const fallbackQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

export interface TaskDefinitionRecord {
  taskDefId: string;
  tenantId: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'ARCHIVED';
  description?: string;
  retryCount?: number;
  retryDelaySeconds?: number;
  backoffRate?: number;
  timeoutSeconds?: number;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  changelogNote?: string;
  publishedAtMs?: number;
  publishedBy?: string;
  createdAtMs: number;
  updatedAtMs: number;
  createdBy?: string;
  isBuiltIn?: boolean;
}

export interface SaveTaskDefinitionInput {
  name: string;
  description?: string;
  retryCount?: number;
  retryDelaySeconds?: number;
  backoffRate?: number;
  timeoutSeconds?: number;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  changelogNote?: string;
}

// 1. Fetch Latest Task Definitions
export const useTaskDefinitions = () => {
  const queryContext = useContext(QueryClientContext);
  const clientToUse = queryContext || fallbackQueryClient;

  const sandboxEnabled = useSandboxStore((s) => s.enabled);
  const sandboxTenantId = useSandboxStore((s) => s.activeTenantId);
  const metadataTenantId = useMetadataUiStore((s) => s.activeTenantId);
  const effectiveTenantId = (sandboxEnabled ? sandboxTenantId : metadataTenantId) || sandboxTenantId || 'tenant-acme';

  return useQuery({
    queryKey: ['workflows', 'task-definitions', effectiveTenantId, sandboxEnabled],
    queryFn: async (): Promise<TaskDefinitionRecord[]> => {
      try {
        const res = await springApiClient.get('/v1/workflow/task-definitions');
        if (res.status === 200) {
          const list = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.body)
              ? res.data.body
              : res.data?.data || [];
          taskContractRegistry.preload(list);
          return list;
        }
        return [];
      } catch (err) {
        console.warn('Failed to fetch task definitions from backend:', err);
        return [];
      }
    },
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  }, clientToUse);
};

// 2. Fetch Version History for a specific Task Definition
export const useTaskDefinitionVersions = (taskName?: string) => {
  const queryContext = useContext(QueryClientContext);
  const clientToUse = queryContext || fallbackQueryClient;

  const sandboxEnabled = useSandboxStore((s) => s.enabled);
  const sandboxTenantId = useSandboxStore((s) => s.activeTenantId);
  const metadataTenantId = useMetadataUiStore((s) => s.activeTenantId);
  const effectiveTenantId = (sandboxEnabled ? sandboxTenantId : metadataTenantId) || sandboxTenantId || 'tenant-acme';

  return useQuery({
    queryKey: ['workflows', 'task-definitions', effectiveTenantId, taskName, 'versions'],
    queryFn: async (): Promise<TaskDefinitionRecord[]> => {
      if (!taskName) return [];
      try {
        const res = await springApiClient.get(`/v1/workflow/task-definitions/${taskName}/versions`);
        if (res.status === 200) {
          const list = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.body)
              ? res.data.body
              : res.data?.data || [];
          taskContractRegistry.preload(list);
          return list;
        }
        return [];
      } catch (err) {
        console.warn(`Failed to fetch version history for task ${taskName}:`, err);
        return [];
      }
    },
    enabled: Boolean(taskName),
    staleTime: 30 * 1000,
  }, clientToUse);
};

// 3. Save or Fork DRAFT Task Definition
export const useSaveTaskDefinitionDraft = () => {
  const queryContext = useContext(QueryClientContext);
  const clientToUse = queryContext || fallbackQueryClient;

  return useMutation({
    mutationFn: async (input: SaveTaskDefinitionInput): Promise<TaskDefinitionRecord> => {
      const res = await springApiClient.post('/v1/workflow/task-definitions', input);
      if (res.status === 200 || res.status === 201) {
        return res.data?.body || res.data;
      }
      throw new Error(`Failed to save task definition draft: HTTP ${res.status}`);
    },
    onSuccess: (data) => {
      clientToUse.invalidateQueries({ queryKey: ['workflows', 'task-definitions'] });
      toast.success(`Draft saved for ${data.name} (v${data.version})`);
    },
    onError: (err: any) => {
      toast.error(`Failed to save draft: ${err.message || err}`);
    },
  }, clientToUse);
};

// 4. Publish DRAFT Task Definition to ACTIVE
export const usePublishTaskDefinition = () => {
  const queryContext = useContext(QueryClientContext);
  const clientToUse = queryContext || fallbackQueryClient;

  return useMutation({
    mutationFn: async ({ name, version }: { name: string; version: number }): Promise<TaskDefinitionRecord> => {
      const res = await springApiClient.post(`/v1/workflow/task-definitions/${name}/versions/${version}/publish`, {});
      if (res.status === 200) {
        return res.data?.body || res.data;
      }
      throw new Error(`Failed to publish task definition: HTTP ${res.status}`);
    },
    onSuccess: (data) => {
      clientToUse.invalidateQueries({ queryKey: ['workflows', 'task-definitions'] });
      clientToUse.invalidateQueries({ queryKey: ['tasks', 'contracts'] });
      toast.success(`Published ${data.name} v${data.version} to ACTIVE`);
    },
    onError: (err: any) => {
      toast.error(`Failed to publish version: ${err.message || err}`);
    },
  }, clientToUse);
};

// 5. In-Canvas Upgrade Node Task Definition Mutation
export const useUpgradeNodeTaskDef = () => {
  const queryContext = useContext(QueryClientContext);
  const clientToUse = queryContext || fallbackQueryClient;

  return useMutation({
    mutationFn: async ({
      nodeId,
      taskDefName,
      targetVersion,
    }: {
      nodeId: string;
      taskDefName: string;
      targetVersion: number;
    }) => {
      const res = await springApiClient.get(`/v1/workflow/task-definitions/${taskDefName}/versions`);
      const versions: TaskDefinitionRecord[] = Array.isArray(res.data) ? res.data : res.data?.body || [];
      const targetRecord = versions.find((v) => v.version === targetVersion);
      if (!targetRecord) {
        throw new Error(`Target task definition version ${targetVersion} not found for ${taskDefName}`);
      }
      return { nodeId, targetRecord };
    },
    onSuccess: ({ nodeId, targetRecord }) => {
      toast.success(`Node ${nodeId} upgraded to ${targetRecord.name} v${targetRecord.version}`);
    },
    onError: (err: any) => {
      toast.error(`Failed to upgrade task definition: ${err.message || err}`);
    },
  }, clientToUse);
};

// 6. Delete DRAFT Task Definition
export const useDeleteTaskDefinitionDraft = () => {
  const queryContext = useContext(QueryClientContext);
  const clientToUse = queryContext || fallbackQueryClient;

  return useMutation({
    mutationFn: async ({ name, version }: { name: string; version: number }): Promise<boolean> => {
      const res = await springApiClient.delete(`/v1/workflow/task-definitions/${name}/versions/${version}`);
      if (res.status === 200 || res.status === 204) {
        return true;
      }
      throw new Error(`Failed to delete draft: HTTP ${res.status}`);
    },
    onSuccess: (_, { name, version }) => {
      clientToUse.invalidateQueries({ queryKey: ['workflows', 'task-definitions'] });
      toast.success(`Deleted draft for ${name} v${version}`);
    },
    onError: (err: any) => {
      toast.error(`Failed to delete draft: ${err.message || err}`);
    },
  }, clientToUse);
};

// 7. Deterministic Category Resolver for Tasks
export const resolveTaskCategory = (taskName?: string): 'COMMERCE' | 'AI' | 'CONTENT' | 'SYSTEM' | 'CUSTOM' => {
  if (!taskName) return 'CUSTOM';
  if (taskContractRegistry.isBuiltIn(taskName)) {
    const upper = taskName.toUpperCase();
    if (upper === 'LLM_CHAT_COMPLETE' || upper === 'CALL_MCP_TOOL' || upper === 'DYNAMIC') {
      return 'AI';
    }
    return 'SYSTEM';
  }
  const lower = taskName.toLowerCase();
  if (lower.includes('order') || lower.includes('payment') || lower.includes('courier') || lower.includes('inventory')) {
    return 'COMMERCE';
  }
  if (lower.includes('ai') || lower.includes('prompt') || lower.includes('llm') || lower.includes('model') || lower.includes('embed')) {
    return 'AI';
  }
  if (lower.includes('cms') || lower.includes('article') || lower.includes('media') || lower.includes('publish')) {
    return 'CONTENT';
  }
  if (lower.includes('system') || lower.includes('validate') || lower.includes('sync')) {
    return 'SYSTEM';
  }
  return 'CUSTOM';
};
