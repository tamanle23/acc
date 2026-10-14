export * from './types';
export * from './store/sandbox-store';
export * from './manager/sandbox-registry';
export * from './manager/sandbox-manager';
export * from './manager/simulation-decorator';

// Handlers & Adapters
export * from './handlers/auth-sandbox-handler';
export * from './handlers/metadata-sandbox-adapter';
export * from './handlers/users-sandbox-handler';
export * from './handlers/tasks-sandbox-handler';
export * from './handlers/billing-sandbox-handler';
export * from './handlers/system-sandbox-handler';
export * from './handlers/workspace-sandbox-handler';
export * from './handlers/chats-sandbox-handler';
export * from './handlers/apps-sandbox-handler';
export * from './adapters/axios-sandbox-adapter';
export * from './adapters/fetch-sandbox-adapter';

// Auto-register built-in domain handlers into the Unified Registry
import { sandboxRegistry } from './manager/sandbox-registry';
import { authSandboxHandler } from './handlers/auth-sandbox-handler';
import { metadataSandboxAdapter } from './handlers/metadata-sandbox-adapter';
import { usersSandboxHandler } from './handlers/users-sandbox-handler';
import { tasksSandboxHandler } from './handlers/tasks-sandbox-handler';
import { billingSandboxHandler } from './handlers/billing-sandbox-handler';
import { systemSandboxHandler } from './handlers/system-sandbox-handler';
import { workspaceSandboxHandler } from './handlers/workspace-sandbox-handler';
import { chatsSandboxHandler } from './handlers/chats-sandbox-handler';
import { appsSandboxHandler } from './handlers/apps-sandbox-handler';
import { widgetSandboxHandler, workflowSandboxHandler } from '@unipost/sandbox';
import { attachSandboxFetchInterceptor } from './adapters/fetch-sandbox-adapter';

sandboxRegistry.register(authSandboxHandler);
sandboxRegistry.register(metadataSandboxAdapter);
sandboxRegistry.register(usersSandboxHandler);
sandboxRegistry.register(tasksSandboxHandler);
sandboxRegistry.register(billingSandboxHandler);
sandboxRegistry.register(systemSandboxHandler);
sandboxRegistry.register(workspaceSandboxHandler);
sandboxRegistry.register(chatsSandboxHandler);
sandboxRegistry.register(appsSandboxHandler);
sandboxRegistry.register(widgetSandboxHandler);
sandboxRegistry.register(workflowSandboxHandler);

// Attach fetch interceptor in development
attachSandboxFetchInterceptor();
