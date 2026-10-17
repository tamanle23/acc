/**
 * Unified Sandbox Platform - Console Re-export Hub
 * Re-exports everything from @unipost/sandbox so all existing imports, handlers,
 * adapters, and tests in @unipost/console continue working with zero breaking changes.
 */

export * from '@unipost/sandbox';

// Local UI & state extensions
export * from './ui/sandbox-dock';
export { useSandboxStore } from './store/sandbox-store';
export { UnifiedSandboxManager, sandboxManager } from './manager/sandbox-manager';
export { attachSandboxAxiosInterceptor } from './adapters/axios-sandbox-adapter';
export { attachSandboxFetchInterceptor } from './adapters/fetch-sandbox-adapter';
export * from './handlers/metadata-sandbox-adapter';

// Auto-register console-specific metadataSandboxAdapter into sandboxRegistry
import { sandboxRegistry } from '@unipost/sandbox';
import { metadataSandboxAdapter } from './handlers/metadata-sandbox-adapter';
import { workerSandboxHandler, workerFleetMockStore } from './handlers/worker-sandbox-handler';
sandboxRegistry.register(metadataSandboxAdapter);
sandboxRegistry.register(workerSandboxHandler);

export { workerFleetMockStore, workerSandboxHandler };

// Re-export mockMetadataStore for backward compatibility
export { mockMetadataStore } from '@/features/metadata/data/mock-metadata';

// Ensure fetch interceptor is attached in development mode
import { attachSandboxFetchInterceptor } from './adapters/fetch-sandbox-adapter';

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  attachSandboxFetchInterceptor();
}
