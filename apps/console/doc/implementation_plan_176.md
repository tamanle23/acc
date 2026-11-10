# Console Implementation Plan - Iteration 176
# Frontend Hexagonal Seams: Driven Gateway Ports, Zero Sandbox Leakage, and Clean Hooks

**Companion Master Plan:** [`docs/iterations/master_implementation_plan_iteration_87.md`](file:///c:/Users/Admin/workspace/git/acc/docs/iterations/master_implementation_plan_iteration_87.md)  
**Target Module:** `@acc/console` ([`apps/console/src/features/workflows`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows))

---

## 1. Executive Summary

This companion plan details the Console UI changes for Iteration 87. It introduces **Frontend Hexagonal Architecture** by establishing clean Secondary Ports (`WorkflowGatewayPort`, `TaskDefinitionGatewayPort`) and separating UI components from Axios transport dependencies.

In strict compliance with `.agents/rules/02-unified-sandbox.md`, **all sandbox and mock checks are completely removed from production gateway hooks and components**. In development mode, the Unified Sandbox operates transparently via network interceptors in `packages/sandbox`, strictly stripped in production builds via `import.meta.env.DEV`.

---

## 2. Technical Details & Component Signatures

### 2.1 Driven Port Declarations
- **File**: `apps/console/src/features/workflows/application/ports/workflow-gateway.port.ts`
  - Defines the pure asynchronous contract for workflow definition and execution lifecycle:
    ```typescript
    export interface WorkflowGatewayPort {
      getDefinitions(): Promise<WorkflowDefinitionSummary[]>;
      getDefinition(key: string): Promise<WorkflowDefinitionSummary | null>;
      saveDefinition(ir: WorkflowIR): Promise<WorkflowDefinitionSummary>;
      startExecution(command: StartExecutionCommand): Promise<WorkflowExecutionSnapshot>;
    }
    ```
- **File**: `apps/console/src/features/workflows/application/ports/task-definition-gateway.port.ts`
  - Defines contract for Task Definitions:
    ```typescript
    export interface TaskDefinitionGatewayPort {
      listLatest(): Promise<TaskDefinitionRecord[]>;
      getByName(name: string): Promise<TaskDefinitionRecord | null>;
      saveDraft(name: string, input: SaveTaskDefinitionInput): Promise<TaskDefinitionRecord>;
      promoteToActive(name: string, version: number): Promise<TaskDefinitionRecord>;
    }
    ```

### 2.2 Pure Production Infrastructure Adapter (Zero Sandbox Imports)
- **File**: `apps/console/src/features/workflows/infrastructure/adapters/http-task-def-gateway.adapter.ts`
  - Implements `TaskDefinitionGatewayPort` using `springApiClient`.
  - Zero imports from `useSandboxStore` or mock handlers.
  - Automatically benefits from `springApiClient`'s tenant header injection and dev-only sandbox interception.
- **File**: `apps/console/src/features/workflows/infrastructure/adapters/http-workflow-gateway.adapter.ts`
  - Implements `WorkflowGatewayPort` using `springApiClient`.

### 2.3 Clean Use-Case Hooks
- **File**: `apps/console/src/features/workflows/application/use-cases/use-task-definitions.ts`
  - Clean hook consuming `httpTaskDefinitionGateway.listLatest()`.
- **File**: `apps/console/src/features/workflows/application/use-cases/use-save-task-definition.ts`
  - Clean mutation hook consuming `httpTaskDefinitionGateway.saveDraft()`.
- **File**: `apps/console/src/features/workflows/api/task-definition-api.ts` & `workflow-api.ts`
  - Refactored to re-export the clean use-case hooks, providing 100% backward compatibility for existing table and studio components.

---

## 3. Verification Commands
```bash
# 1. Run unit tests for Gateway Ports and Adapters
pnpm --filter @acc/console test run src/features/workflows/application/__tests__/task-definition-gateway.test.ts

# 2. Verify all workflow studio test suites pass
pnpm --filter @acc/console test run src/features/workflows

# 3. Type-check entire console application
pnpm --filter @acc/console exec tsc -b --noEmit
```
