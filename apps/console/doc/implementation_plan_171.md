# Implementation Plan - Iteration 171
# Visual DAG Studio 2.0: Predefined Node Contracts & Schema Inspector

## 1. Overview
In Visual DAG Studio 2.0, every node (both built-in system nodes and worker tasks) must expose its predefined Draft 7 input and output schemas. This enables:
1. Instant display of expected input properties and types when a node is selected.
2. 1-Click Auto-Bind to upstream outputs or workflow inputs.
3. Pre-flight semantic linting against unmapped required fields.
4. Transparent visual display of the active input and output contract schemas with source attribution (`Built-in Contract`, `Worker Fleet`, or `Custom Node Override`).

## 2. Changes
- `apps/console/src/features/workflows/components/studio/utils/contracts/task-contract-registry.ts`:
  - Add `resolveInputSchema(nodeData: DagNodeData, workerDescriptor?: TaskWorkerDescriptor): Record<string, unknown>`.
  - Add `getInputParameters(nodeData: DagNodeData, workerDescriptor?: TaskWorkerDescriptor): ParameterSchema[]`.
  - Add `convertParamsToJsonSchema(params: ParameterSchema[]): Record<string, unknown>`.
- `apps/console/src/features/workflows/components/studio/utils/workflow-ir-converter.ts`:
  - Extend `WorkflowTaskIR` and `DagNodeData` to support `inputSchema?: Record<string, unknown>`.
  - Ensure round-trip serialization between React Flow nodes and `WorkflowTaskIR`.
- `apps/console/src/features/workflows/components/studio/inspectors/dag-property-inspector.tsx`:
  - Replace the worker-only input checklist with a unified contract requirement checklist using `taskContractRegistry.getInputParameters` and `taskContractRegistry.resolveInputSchema`.
  - Add a dedicated **Contract Schemas** section / view displaying both resolved Input and Output Draft 7 schemas.
- `apps/console/src/features/workflows/components/studio/utils/validation/dag-semantic-linter.ts`:
  - Validate required properties against `taskContractRegistry.resolveInputSchema`.

## 3. Verification
- `apps/console/src/features/workflows/components/studio/utils/contracts/task-contract-registry.test.ts`
- `apps/console/src/features/workflows/components/studio/utils/validation/dag-semantic-linter.test.ts`
