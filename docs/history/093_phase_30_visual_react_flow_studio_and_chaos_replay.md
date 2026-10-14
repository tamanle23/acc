# History 093: Visual React Flow Studio, Unified Sandbox Simulator & Chaos Replay Suite (Phase 30)

## Problem
Phase 30 of Workstream 6 requires completing the end-to-end integration of the Conductor-style workflow orchestration engine: visual canvas representation for all node types in `@unipost/console`, simulated workflow execution in the Unified Sandbox Platform, and rigorous deterministic verification via Golden Trace replays and multi-threaded chaos testing.

## Plan
1. Authored visual workflow studio components in `@unipost/console`:
   - `conductor-node.tsx`: React Flow custom node with Liquid Glass tokens and execution badges.
   - `conductor-workflow-studio.tsx`: Interactive canvas with playback simulation and controls.
   - `conductor-node.test.tsx`: Component tests.
2. Built Unified Sandbox simulation in `@unipost/sandbox` & `@unipost/console`:
   - `workflow-handler.ts`: In-memory workflow execution, lease assignment, and task result handler.
   - Registered in `sandboxRegistry`.
3. Created chaos verification suite in `apps/backend/workflow-engine`:
   - `GoldenTraceReplayTest.java`: Deterministic decision replay verification.
   - `ChaosWorkflowIntegrationTest.java`: 100 concurrent workflow executions with 20% random worker crashes and lease recovery.

## Changes
- `apps/console/src/features/metadata/components/studio/conductor-node.tsx`
- `apps/console/src/features/metadata/components/studio/conductor-workflow-studio.tsx`
- `apps/console/src/features/metadata/components/studio/conductor-node.test.tsx`
- `apps/console/src/features/metadata/components/studio/index.ts`
- `apps/console/src/core/sandbox/index.ts`
- `packages/sandbox/src/handlers/workflow-handler.ts`
- `packages/sandbox/src/index.ts`
- `apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/decider/strategy/SwitchNodeStrategy.java`
- `apps/backend/workflow-engine/src/test/java/com/unipost/workflow/core/GoldenTraceReplayTest.java`
- `apps/backend/workflow-engine/src/test/java/com/unipost/workflow/application/ChaosWorkflowIntegrationTest.java`
- `apps/console/doc/implementation_plan_92.md`
- `apps/console/doc/walkthrough_92.md`

## Verification
- `mvn test -pl workflow-engine`: 27/27 tests pass.
- `pnpm --filter @unipost/console test src/features/metadata/components/studio/conductor-node.test.tsx`: 2/2 tests pass.
- `pnpm --filter @unipost/sandbox test`: 5/5 tests pass.
- `pnpm --filter @unipost/worker test`: 5/5 tests pass.
