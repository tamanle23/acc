/**
 * Unified Sandbox Platform - Console Re-export Hub
 * Re-exports everything from @acc/sandbox so all existing imports, handlers,
 * adapters, and tests in @acc/console continue working with zero breaking changes.
 */

export * from '@acc/sandbox';

// Local UI & state extensions
export * from './ui/sandbox-dock';
export { useSandboxStore } from './store/sandbox-store';
export { UnifiedSandboxManager, sandboxManager } from './manager/sandbox-manager';
export { attachSandboxAxiosInterceptor } from './adapters/axios-sandbox-adapter';
export { attachSandboxFetchInterceptor } from './adapters/fetch-sandbox-adapter';
export * from './handlers/metadata-sandbox-adapter';

// Auto-register console-specific metadataSandboxAdapter into sandboxRegistry
import { sandboxRegistry } from '@acc/sandbox';
import { metadataSandboxAdapter } from './handlers/metadata-sandbox-adapter';
import { workerSandboxHandler, workerFleetMockStore } from './handlers/worker-sandbox-handler';
import { approvalsSandboxHandler, approvalTaskMockStore } from './handlers/approvals-sandbox-handler';
import { systemSandboxHandler, mockFleetStore } from './handlers/system-sandbox-handler';
sandboxRegistry.register(metadataSandboxAdapter);
sandboxRegistry.register(workerSandboxHandler);
sandboxRegistry.register(approvalsSandboxHandler);
sandboxRegistry.register(systemSandboxHandler);

export { workerFleetMockStore, workerSandboxHandler, approvalTaskMockStore, approvalsSandboxHandler, systemSandboxHandler, mockFleetStore };

// Re-export mockMetadataStore for backward compatibility
export { mockMetadataStore } from '@/features/metadata/data/mock-metadata';

import axios from 'axios';
import { attachSandboxFetchInterceptor } from './adapters/fetch-sandbox-adapter';
import { attachSandboxAxiosInterceptor } from './adapters/axios-sandbox-adapter';
import { workflowSimulationEngine } from '@/features/workflows/sandbox/workflow-simulation-engine';
export { workflowSimulationEngine };

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  attachSandboxFetchInterceptor();
  attachSandboxAxiosInterceptor(axios);
  workflowSimulationEngine.installInterceptor();
}
