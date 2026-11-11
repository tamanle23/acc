import { useContext } from 'react';
import { useMutation, useQuery, QueryClientContext, QueryClient } from '@tanstack/react-query';
import { httpTaskDefinitionGateway } from '../infrastructure/adapters/http-task-def-gateway.adapter';
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

// 1. Fetch Latest Task Definitions via Driven Gateway
export const useTaskDefinitions = () => {
  const queryContext = useContext(QueryClientContext);
  const clientToUse = queryContext || fallbackQueryClient;

  return useQuery({
    queryKey: ['workflows', 'task-definitions'],
    queryFn: async ({ signal }): Promise<TaskDefinitionRecord[]> => {
      return await httpTaskDefinitionGateway.listLatest({ signal });
    },
    staleTime: 30 * 1000,
    refetchOnMount: 'always',
  }, clientToUse);
};

// 2. Fetch Version History for a specific Task Definition
export const useTaskDefinitionVersions = (taskName?: string) => {
  const queryContext = useContext(QueryClientContext);
  const clientToUse = queryContext || fallbackQueryClient;

  return useQuery({
    queryKey: ['workflows', 'task-definitions', taskName, 'versions'],
    queryFn: async ({ signal }): Promise<TaskDefinitionRecord[]> => {
      if (!taskName) return [];
      return await httpTaskDefinitionGateway.getVersions(taskName, { signal });
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
      return await httpTaskDefinitionGateway.saveDraft(input);
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
      return await httpTaskDefinitionGateway.publishVersion(name, version);
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
      const versions = await httpTaskDefinitionGateway.getVersions(taskDefName);
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
      return await httpTaskDefinitionGateway.deleteDraftVersion(name, version);
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
