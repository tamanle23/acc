# [188] Visual DAG Studio — Execution Drawer Console & Terminal Telemetry Viewer

## Problem
In Workflow Execution Mode, users lacked an integrated real-time execution deck directly inside the Studio viewport:
1. Log telemetry was previously isolated in the right-side sheet, preventing users from seeing global streaming logs alongside the canvas.
2. The log stream lacked interactive terminal capabilities (no live follow/auto-scroll, no regex/substring filtering, no log-level chips, and no 1-click log line copying).
3. There was no clean coordination between selecting a DAG node on canvas and filtering the live log stream to that specific task reference.
4. The execution deck was not docked cleanly within the DAG canvas viewport without colliding with the Time Travel Scrubber.

## Solution & Architecture
Implemented **Workstream 4: Execution Drawer Console & Terminal Telemetry Viewer** following Liquid Glass design tokens and WCAG 2.2 AA standards:
1. **Collapsible Bottom Dock Console (`ExecutionRunDrawer`)**:
   - Docks within the canvas viewport in **Execution Mode** (`isExecutionMode = true`).
   - Sits stacked cleanly above the `TimeTravelScrubber` (`bottom-20`), with smooth transitions between compact status bar (`h-12`) and expanded deck (`h-72`).
   - Liquid Glass surface (`backdrop-blur-2xl bg-white/90 dark:bg-slate-900/90 border border-white/30 dark:border-white/10 shadow-2xl rounded-2xl`).
   - Accessible keyboard toggle with `ChevronUp`/`ChevronDown` indicators.

2. **Interactive Terminal Log Viewer (`Logs` tab)**:
   - **Regex & Substring Filter**: Instant search input filtering across timestamps, log levels, task references, worker IDs, and log messages.
   - **Log-Level Filter Chips**: Multi-level toggle pills (`ALL`, `INFO`, `SUCCESS`, `WARN`, `ERROR`) showing live item counts.
   - **Task Step Filter Dropdown**: Allows focusing on a single task step or viewing all workflow-level events.
   - **Live Auto-Scroll Lock**: Auto-scrolls to follow new incoming stream entries, with visual bounce indicator and easy pause.
   - **1-Click Copy**: Copy individual log lines on hover, or 1-click copy for the entire filtered log buffer.
   - High-contrast, WCAG AA accessible syntax highlighting in a dark terminal window (`bg-slate-950`).

3. **Bi-directional Canvas & Drawer Coordination**:
   - Selecting a task node on the DAG canvas automatically synchronizes the drawer's task filter to that task reference.
   - Selecting a task from the drawer's `log-task-filter-select` dropdown highlights the corresponding node on the DAG canvas.
   - Clearing the filter chip (`×`) resets the view to global execution logs.

4. **Integrated Analytics & Inspection Tabs**:
   - `Tasks / Timeline`: Interactive grid of task dispatch states (`COMPLETED`, `IN_PROGRESS`, `FAILED`, `PENDING`).
   - `Payload`: Side-by-side inspection of workflow input and output JSON payloads.
   - `Diff`: Visual variable diffing via `PayloadDiffViewer`.
   - `Diagnostics`: Channel status (Live SSE vs. Polling Fallback), connection lifecycle state, retry attempts, and active stream warnings.

## Verification
- **TypeScript**: `pnpm --filter @acc/console exec tsc --noEmit` passed with 0 errors.
- **Unit & Integration Tests**:
  - `execution-run-drawer.test.tsx` (5/5 passed).
  - Full workflow test suite: 20 test files, 89 passed (`pnpm --filter @acc/console test -- src/features/workflows`).
