export * from './types';
export * from './registry';
export * from './reset-registry';
export * from './simulation';
export * from './store';
export * from './engine';
export * from './jwt';
export * from './adapters/fetch-adapter';
export * from './adapters/axios-adapter';

// Centralized Domain Handlers & Repositories
export * from './handlers/auth-sandbox-handler';
export * from './handlers/users-sandbox-handler';
export * from './handlers/workflow-handler';
export * from './handlers/billing-sandbox-handler';
export * from './handlers/system-sandbox-handler';
export * from './handlers/workspace-sandbox-handler';
export * from './handlers/chats-sandbox-handler';
export * from './handlers/apps-sandbox-handler';
export * from './handlers/widget-handler';
export * from './handlers/dlq-sandbox-handler';

// Auto-register built-in domain handlers into the Unified Registry
import { sandboxRegistry } from './registry';
import { authSandboxHandler } from './handlers/auth-sandbox-handler';
import { usersSandboxHandler } from './handlers/users-sandbox-handler';
import { workflowSandboxHandler } from './handlers/workflow-handler';
import { billingSandboxHandler } from './handlers/billing-sandbox-handler';
import { systemSandboxHandler } from './handlers/system-sandbox-handler';
import { workspaceSandboxHandler } from './handlers/workspace-sandbox-handler';
import { chatsSandboxHandler } from './handlers/chats-sandbox-handler';
import { appsSandboxHandler } from './handlers/apps-sandbox-handler';
import { widgetSandboxHandler } from './handlers/widget-handler';
import { dlqSandboxHandler } from './handlers/dlq-sandbox-handler';

export function registerDefaultSandboxHandlers(): void {
  sandboxRegistry.register(authSandboxHandler);
  sandboxRegistry.register(usersSandboxHandler);
  sandboxRegistry.register(workflowSandboxHandler);
  sandboxRegistry.register(billingSandboxHandler);
  sandboxRegistry.register(systemSandboxHandler);
  sandboxRegistry.register(workspaceSandboxHandler);
  sandboxRegistry.register(chatsSandboxHandler);
  sandboxRegistry.register(appsSandboxHandler);
  sandboxRegistry.register(widgetSandboxHandler);
  sandboxRegistry.register(dlqSandboxHandler);
}

// Auto-register on module load
registerDefaultSandboxHandlers();

