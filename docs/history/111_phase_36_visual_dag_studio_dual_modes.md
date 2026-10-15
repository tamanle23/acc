# 111. Phase 36: Visual DAG Studio 2.0 (Dual Modes & 23-Node Palette)

## Problem Statement
In Iteration 5, the visual orchestration tier required an enterprise-grade Visual DAG Studio 2.0 capable of:
1. Supporting the full spectrum of all 23 backend orchestration task node types (categorized with intuitive icons and search filtering).
2. Specialized property inspection for critical task types (HTTP, JDBC, JSON_JQ, INLINE, LLM, MCP, HUMAN, TERMINATE, SUB_WORKFLOW, KAFKA).
3. Operating under two strictly isolated operational modes:
   - **Full Mode (`full` / `designer`)**: Freeform drag-and-drop authoring, dynamic palette, acyclic Kahn/Tarjan validation, and catalog persistence.
   - **Read-Only Mode (`readonly` / `execution`)**: Topology-locked live execution canvas, docked microsecond `TimeTravelScrubber` (Play/Pause/Step/Speed, Live HEAD auto-follow), and slide-over `TaskTelemetryInspector` (runtime resolved inputs/outputs, duration, worker lease ID, retry count, failure stack traces, and node logs).

## Implementation Plan
1. Expand node metadata and type definitions in `dag-node.tsx` to encompass all 23 task types with category icons, specialized param interfaces, and execution telemetry metrics.
2. Build categorized accordion `DagPalette` with search filtering and collapsible groups.
3. Construct specialized configuration sub-forms in `DagPropertyInspector` for high-frequency and domain-specific nodes.
4. Develop docked floating `TimeTravelScrubber` with playback controls, event timeline slider, speed selector, and live HEAD tracking.
5. Create slide-over `TaskTelemetryInspector` displaying runtime metrics, resolved payloads, errors, and task logs.
6. Wire dual modes into `VisualDagStudio`, enforcing topology lockdown (`nodesConnectable={false}`, `nodesDraggable={false}`, `elementsSelectable={true}`) in read-only mode while guarding against re-render infinite loops.
7. Update `workflow-ir-converter.ts` for bidirectional conversion of all 23 node types and their specialized parameters.
8. Align `@unipost/sandbox` simulation handler to generate domain-realistic outputs for all 23 task node types.

## Changes Made
- `apps/console/src/features/metadata/components/studio/dag-node.tsx`:
  - Defined all 23 task types across 5 categories.
  - Added specialized parameter payloads (`HttpTaskParams`, `JdbcTaskParams`, etc.) and telemetry attributes (`durationMs`, `workerId`, `leaseId`, `attemptNumber`, etc.).
  - Added duration and attempt pills to canvas cards.
  - Added index signature to `DagNodeData` to satisfy `Record<string, unknown>` constraint.
- `apps/console/src/features/metadata/components/studio/dag-palette.tsx`:
  - Implemented 5 collapsible categories with search filtering and badges.
- `apps/console/src/features/metadata/components/studio/dag-property-inspector.tsx`:
  - Implemented 5 tabs (General, Config, Bindings, Policies, Routing) and specialized parameter forms for 10 key task types.
- `apps/console/src/features/metadata/components/studio/time-travel-scrubber.tsx`:
  - Created docked floating playback bar with Play/Pause, Step, Speed, slider, and Live indicator.
- `apps/console/src/features/metadata/components/studio/task-telemetry-inspector.tsx`:
  - Implemented slide-over telemetry inspector sheet for read-only execution analysis.
- `apps/console/src/features/metadata/components/studio/visual-dag-studio.tsx`:
  - Integrated dual modes (`mode="full"` vs `mode="readonly"`), topology locking, scrubber controls, and dirty-checked node status updates.
- `apps/console/src/features/metadata/components/studio/workflow-ir-converter.ts` & `test.ts`:
  - Bidirectional serialization/deserialization for all 23 task types.
- `packages/sandbox/src/handlers/workflow-handler.ts`:
  - Simulated domain-realistic execution outputs for all 23 task node types.
- `apps/console/src/features/metadata/components/studio/visual-dag-studio-modes.test.tsx`:
  - Created 8 automated tests asserting full designer authoring and read-only execution with scrubber & telemetry inspection.
- `apps/console/doc/implementation_plan_98.md` & `apps/console/doc/walkthrough_98.md`:
  - Documented implementation plan and walkthrough according to rule SOP.

## Verification
- Vitest `@unipost/console`: `src/features/metadata/components/studio/` passed **6/6 test files, 28/28 tests**.
- Vitest `@unipost/sandbox`: `src/__tests__/sandbox-engine.test.ts` & `src/handlers/data/schema.test.ts` passed **2/2 files, 9/9 tests**.
- TypeScript type check: `pnpm --filter @unipost/console exec tsc --noEmit` passed clean with 0 errors.
