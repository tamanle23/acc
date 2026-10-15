/**
 * Unified Sandbox Platform - Console Re-export Hub
 * Re-exports everything from @unipost/sandbox so all existing imports, handlers,
 * adapters, and tests in @unipost/console continue working with zero breaking changes.
 */

export * from '@unipost/sandbox';

// Local UI & state extensions
export * from './ui/sandbox-dock';
export * from './store/sandbox-store';
export * from './manager/sandbox-manager';
export * from './manager/sandbox-registry';
export * from './manager/simulation-decorator';
export * from './adapters/axios-sandbox-adapter';
export * from './adapters/fetch-sandbox-adapter';
export * from './handlers/metadata-sandbox-adapter';

// Auto-register console-specific metadataSandboxAdapter into sandboxRegistry
import { sandboxRegistry } from '@unipost/sandbox';
import { metadataSandboxAdapter } from './handlers/metadata-sandbox-adapter';
sandboxRegistry.register(metadataSandboxAdapter);

// Re-export mockMetadataStore for backward compatibility
export { mockMetadataStore } from '@/features/metadata/data/mock-metadata';

// Backward-compatibility aliases for legacy task tests
export {
  workflowExecutionsSandboxHandler as tasksSandboxHandler,
  workflowExecutionsSandboxRepo as tasksSandboxRepo,
} from '@unipost/sandbox';

// Ensure fetch interceptor is attached in development mode
import { attachSandboxFetchInterceptor } from './adapters/fetch-sandbox-adapter';

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  attachSandboxFetchInterceptor();
}
