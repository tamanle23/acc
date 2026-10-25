# Implementation Plan 144 - Visual DAG Studio Professional-Grade Layout & UI/UX Overhaul

## Goal Description
Enhance [`visual-dag-studio.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx) and its surrounding components into an enterprise, professional-grade visual workflow orchestration IDE following the design alignment concluded in our `/grill-me` session.

---

## Aligned Decisions & Architectural Invariants

1. **Segmented Floating Command Bar**:
   - Split the top toolbar into 3 floating Liquid Glass pill clusters across the top of the canvas:
     - **Left (Identity & Mode)**: Studio Title, Version/Mode Badge (Authoring / Execution / Read-Only), Workflow Key indicator.
     - **Center (Ergonomics & Canvas Tools)**: Topological Auto-Layout, Snap-to-Grid toggle (16px), Edge Routing toggle (Curves vs Orthogonal), Undo/Redo pair.
     - **Right (Actions & CTAs)**: Node Palette toggle, Validate DAG, Dry-Run simulation, Export/Import IR dropdown menu, 1-click Fullscreen toggle, and primary Save DAG CTA.
2. **Contextual Floating Sub-Pill for Execution / Debugger**:
   - When in execution mode or when breakpoints exist, render a dedicated amber Liquid Glass sub-pill floating directly beneath the center/left toolbar containing Pause, Step Over, Resume, Breakpoint counter, and Live Variable Watch drawer trigger.
3. **Collapsible Node Palette (`DagPalette`) with Slim Rail Mode**:
   - Keep the palette snapped beneath the left toolbar cluster with dynamic `maxHeight` bounding (avoiding React Flow panel collision).
   - Add a collapse toggle button in the palette header so users can toggle between the full 23-node categorized drawer and a sleek slim icon rail (48px wide) to maximize canvas authoring space.
4. **Starter Onboarding Liquid Glass Prompt**:
   - When a workflow is blank (only START and END connected by a single edge), display a gentle frosted helper card centered on the canvas with 1-click starter actions: "Add Simple Task", "Add HTTP Connector", "Open Palette", or "Dismiss".
5. **1-Click Fullscreen Canvas**:
   - Provide a Fullscreen toggle button (`Maximize2` / `Minimize2`) with browser Fullscreen API and fallback `fixed inset-0 z-50` styling, including `Escape` key listener.
6. **5-State Matrix & WCAG 2.2 AA Compliance**:
   - Contrast calibration across all glass layers, keyboard focus rings (`focus-visible:ring-2`), and polite ARIA live regions.

---

## Detailed Component Changes

### 1. `apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx`
- Refactor the single header toolbar into three segmented pill clusters (`left`, `center`, `right`) floating at `top-4` with backdrop blur, specular borders, and elevation shadows.
- Add dedicated execution debugger floating sub-pill beneath the main bar.
- Add consolidated Export / Import IR dropdown menu (`DropdownMenu`).
- Implement 1-click Fullscreen canvas mode (`isFullscreen` state, `Maximize2` / `Minimize2` toggle, `Escape` key handler).
- Integrate blank workflow starter prompt (`DagCanvasEmptyState`).
- Accept `className?: string` on `VisualDagStudioProps` to allow flexible container heights (`h-full` or custom height).

### 2. `apps/console/src/features/workflows/components/studio/dag-palette.tsx`
- Add collapsible slim-rail mode (`isCollapsed` state with `ChevronLeft` / `ChevronRight` toggle).
- Add quick `Expand All` / `Collapse All` categories action.
- Add keyboard focus rings on draggable node items (`focus-visible:ring-2 focus-visible:ring-primary`).

### 3. `apps/console/src/features/workflows/components/studio/dag-canvas-empty-state.tsx` [NEW]
- Create the starter prompt component rendered only when `isWorkflowBlank` is true, providing quick starter task insertions and dismissing once any intermediate task node is placed.

---

## Verification Plan

### Automated Tests
```bash
# 1. Studio test suite (including new layout and empty state tests)
pnpm --filter @acc/console test -- src/features/workflows/components/studio/

# 2. Type check
pnpm --filter @acc/console exec tsc --noEmit

# 3. Full console test suite
pnpm --filter @acc/console test:run
```

### Manual Verification
1. Verify 3 segmented floating pills on top of the canvas at various viewport widths.
2. Toggle Fullscreen mode and test with `Escape`.
3. Toggle Palette between full card and slim rail mode.
4. Test blank canvas onboarding prompt on a new blank workflow.
5. Trigger execution mode and test floating debugger sub-pill.
