# Walkthrough 98: Phase 36 - Visual DAG Studio 2.0 (Dual Modes & 23-Node Palette)

## 1. Overview
In Phase 36, we delivered the complete **Visual DAG Studio 2.0** architecture supporting strict dual operational modes:
- **Full Mode (`full` / `designer`)**: Visual drag-and-drop authoring with a 23-node categorized accordion palette, specialized property inspectors, real-time acyclic cycle validation, and backend catalog persistence.
- **Read-Only Mode (`readonly` / `execution`)**: Topology-locked live execution canvas, docked microsecond `TimeTravelScrubber` (Play/Pause/Step/Speed, Live HEAD auto-follow), and slide-over `TaskTelemetryInspector` (runtime resolved inputs/outputs, duration, worker lease ID, retry count, node logs).

## 2. Key Accomplishments

### 2.1 Complete 23-Node Type System & Specular Category Badges (`dag-node.tsx`)
- Fully typed all 23 backend orchestration task types:
  - **Control Flow (9)**: `SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `WAIT`, `DO_WHILE`, `JOIN`, `EXCLUSIVE_JOIN`, `TERMINATE`, `SUB_WORKFLOW`, `START_WORKFLOW`.
  - **Data & Transformation (3)**: `JSON_JQ_TRANSFORM`, `INLINE`, `SET_VARIABLE`.
  - **System Connectors & I/O (5)**: `HTTP`, `JDBC`, `KAFKA_PUBLISH`, `EVENT`, `NOOP`.
  - **Human & Governance (1)**: `HUMAN`.
  - **AI & Emerging Integrations (3)**: `LLM_CHAT_COMPLETE`, `CALL_MCP_TOOL`, `DYNAMIC`.
- Added specialized parameter payloads: `HttpTaskParams`, `JdbcTaskParams`, `JsonJqTaskParams`, `InlineTaskParams`, `LlmTaskParams`, `McpTaskParams`, `HumanTaskParams`, `TerminateTaskParams`, `SubWorkflowTaskParams`, `KafkaTaskParams`.
- Enriched node telemetry metrics: `durationMs`, `attemptNumber`, `workerId`, `leaseId`, `startedAt`, `endedAt`, `error`.
- Rendered execution duration and retry pills directly on the canvas cards with Liquid Glass styling.

### 2.2 23-Node Categorized Accordion Palette with Search (`dag-palette.tsx`)
- Grouped all 23 task types into 5 collapsible categories with icon banners and node count pills.
- Added live real-time search filter query with instant match highlighting.
- Preserved drag-and-drop handles for seamless canvas placement.

### 2.3 Specialized Property Inspector (`dag-property-inspector.tsx`)
- Structured with 5 tabs: **General**, **Config**, **Bindings**, **Policies**, and **Routing**.
- Built tailored configuration sub-forms for high-frequency and domain-specific nodes:
  - `HTTP`: Method, URL, headers, body, timeout, expected status codes.
  - `JDBC`: Datasource ID, SQL query text, parameter bindings.
  - `JSON_JQ`: jq query expression, sample input payload.
  - `INLINE`: Script evaluator type (`javascript`, `groovy`, `mvel`), script code editor.
  - `LLM`: Provider, model, temperature, max tokens, system prompt, user prompt template.
  - `MCP`: Server name, tool name, arguments JSON.
  - `HUMAN`: Assignee, role, instructions, SLA minutes, escalation handler reference.
  - `TERMINATE`: Termination status (`COMPLETED` / `FAILED`), termination reason.
  - `SUB_WORKFLOW`: Workflow key, version, input parameters mapping.
  - `KAFKA`: Topic name, partition key, message payload.

### 2.4 Floating Docked Time-Travel Scrubber (`time-travel-scrubber.tsx`)
- Spans the bottom of the read-only canvas with a Liquid Glass frosted container (`backdrop-blur-xl bg-slate-900/80 border-white/10`).
- Provides controls:
  - Play / Pause toggling.
  - Step Back / Step Forward buttons.
  - Playback Speed selector: `0.5x`, `1x`, `2x`, `5x`.
  - Granular event timeline slider with microsecond precision.
  - Live HEAD pulsing badge and "Resume Live" quick-switch button.

### 2.5 Slide-Over Task Telemetry Inspector (`task-telemetry-inspector.tsx`)
- Dedicated read-only inspector sheet displaying:
  - Execution status badge with duration and timestamps.
  - Worker Lease ID, Worker ID, and retry attempts count.
  - Formatted JSON viewers for resolved inputs and outputs.
  - Error stack trace and failure diagnostic alert.
  - Node-specific execution logs tab.

### 2.6 Visual DAG Studio 2.0 Integration (`visual-dag-studio.tsx`)
- Strict dual operational mode separation via `mode="full"` and `mode="readonly"`.
- Read-only topology lockdown: `nodesConnectable={false}`, `nodesDraggable={false}`, `elementsSelectable={true}`, palette hidden, save/delete toolbar buttons hidden.
- Guarded `setNodes` within `useEffect` with dirty-check diffing to prevent re-render thrashing.
- Synchronized scrubber timeline slider with canvas node execution states.

### 2.7 Canonical Workflow IR Converter (`workflow-ir-converter.ts`)
- Bidirectional conversion between ReactFlow graph representation and backend Workflow IR.
- Full lossless preservation of all 23 task types, specialized parameters, and execution policies.
- Kahn / Tarjan acyclic DAG cycle validation.

## 3. Verification & Testing
- Vitest suite `@acc/console`: `src/features/metadata/components/studio/` passed **6/6 test files, 28/28 tests**.
  - `workflow-ir-converter.test.ts` (6 tests)
  - `dag-palette.test.tsx` (2 tests)
  - `dag-node.test.tsx` (2 tests)
  - `dag-property-inspector.test.tsx` (2 tests)
  - `visual-schema-studio.test.tsx` (8 tests)
  - `visual-dag-studio-modes.test.tsx` (8 tests)
- Vitest suite `@acc/sandbox`: `src/__tests__/sandbox-engine.test.ts` & `src/handlers/data/schema.test.ts` passed **2/2 files, 9/9 tests**.
- TypeScript type checking: `pnpm --filter @acc/console exec tsc --noEmit` exited clean with code 0.
