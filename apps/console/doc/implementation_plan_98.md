# Implementation Plan - Visual DAG Studio 2.0 (Dual Modes: Full Authoring & Read-Only Live / Back-Test)

## 1. Context & Objectives
Visual DAG Studio 2.0 in `@unipost/console` requires two distinct, strictly isolated operational modes:
1. **Full Mode (`full` / `designer`)**: Workflow definition authoring with a 23-node categorized accordion palette (Control Flow, Data & Transform, Connectors & I/O, Human & Governance, AI & Emerging), specialized Property Inspector forms (HTTP, SQL, JQ, LLM, Inline, Kafka, MCP, Human, Terminate, SubWorkflow), Kahn/Tarjan acyclic graph topology validator, and backend save mutations.
2. **Read-Only Mode (`readonly` / `execution`)**: Topology-locked interactive visualizer for live SSE execution monitoring and historical time-travel back-testing with a docked bottom playback scrubber (Play/Pause/Step/Speed, Live HEAD auto-follow) and a slide-over task telemetry inspector (runtime payloads, worker lease, duration, logs).

## 2. Core Architecture & Invariants
- **Strict Context Isolation**: No direct mode-switching buttons in canvas; Read-Only mode is strictly bound to execution views (`/tasks`, modals), while Full Mode is accessed via the Workflow Catalog (`/workflows`) designer.
- **Topology Lock in Read-Only Mode**: `nodesConnectable={false}`, `nodesDraggable={false}`, `elementsSelectable={true}`, palette hidden, delete/save buttons hidden.
- **Auto-Follow Live HEAD with Pause-to-Scrub**: While an execution is running, the canvas automatically follows real-time events at HEAD. Dragging the scrubber or hitting Pause detaches from live updates into Time-Travel replay mode; a "Resume Live" badge snaps back to real-time. For completed executions, it loads the full event history ready for scrubbing.
- **Specialized Inspectors**: Tailored sub-forms for specialized node types (HTTP, JDBC, JSON_JQ_TRANSFORM, INLINE, LLM_CHAT_COMPLETE, CALL_MCP_TOOL, HUMAN, TERMINATE).
- **Zero Synthetic Stubs**: Integration with actual backend APIs and `@unipost/sandbox` mock decider.

## 3. Implementation Steps
- **Step 1**: Expand `DagNodeType` in `dag-node.tsx` to all 23 backend task types with dedicated category icons and badges.
- **Step 2**: Reorganize `dag-palette.tsx` into 5 collapsible categories with search filtering and default payloads.
- **Step 3**: Implement specialized property forms in `dag-property-inspector.tsx`.
- **Step 4**: Build `time-travel-scrubber.tsx` for playback control and timeline event scrubbing.
- **Step 5**: Build `task-telemetry-inspector.tsx` for read-only runtime payload and worker log inspection.
- **Step 6**: Wire modes and state synchronization in `visual-dag-studio.tsx`.
- **Step 7**: Update `workflow-ir-converter.ts` for all 23 node types.
- **Step 8**: Unit testing and automated verification.
