# 094. Standalone First-Class Route for Visual Conductor Workflow Studio

## 1. Problem Statement
In Phase 30, the `ConductorWorkflowStudio` component was initially embedded into `VisualSchemaStudio` under `Metadata` $\to$ `Entity Models` $\to$ `Visual Studio` $\to$ `Conductor DAG Studio`. However, Distributed Conductor Workflow Orchestration is fundamentally a cluster-level orchestration platform (task queues, saga rollbacks, worker polling, and topological DAG pipelines) rather than a field or attribute on an entity schema. Tucking it inside the metadata builder made it difficult to access and conflated metadata schema design with workflow execution.

## 2. Plan
1. Create a dedicated feature component `apps/console/src/features/workflows/index.tsx` (`WorkflowsFeature`) presenting a full-bleed Liquid Glass studio canvas.
2. Create TanStack Route `apps/console/src/routes/_authenticated/workflows/index.tsx` at `/workflows`.
3. Register the `/workflows` route in `apps/console/src/components/layout/data/sidebar-data.ts` under the **Workspace** navigation group with the `Workflow` Lucide icon.
4. Synchronize i18n locales (`en` and `vi`) with `sidebar.items.workflows` and descriptive keys in `console.json`.
5. Update `apps/console/ROUTE.md` route registry table.
6. Correct the TypeScript signature of `workflowSandboxHandler` in `@unipost/sandbox` to conform to `SandboxRouteHandler` and `SandboxRouteMatcherContext`.

## 3. Changes Made
- `apps/console/src/features/workflows/index.tsx`: Authored `WorkflowsFeature` with sticky header, operational telemetry header, and full-bleed `ConductorWorkflowStudio`.
- `apps/console/src/routes/_authenticated/workflows/index.tsx`: Created TanStack route bound to `WorkflowsFeature`.
- `apps/console/src/components/layout/data/sidebar-data.ts`: Added `{ title: t('sidebar.items.workflows', 'Workflows'), url: '/workflows', icon: Workflow }`.
- `apps/console/src/locales/en/console.json` & `vi/console.json`: Added `workflows` entry in `sidebar.items` and page title/description.
- `apps/console/ROUTE.md`: Updated route matrix.
- `packages/sandbox/src/handlers/workflow-handler.ts`: Aligned matcher and handler types with core sandbox contracts.

## 4. Verification
- `pnpm --filter @unipost/sandbox test`: All 5 tests passed.
- `pnpm --filter @unipost/console test src/features/metadata/components/studio`: 10/10 tests passed.
- All locales and route registries verified.
