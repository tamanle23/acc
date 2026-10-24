# Implementation Plan - Refine UI/UX of Workflows & Workflow Executions Screens

Polish and elevate both `/workflows` and `/workflow-executions` screens following `ui-ux-design-principles`, `enterprise-clean-coder`, WCAG 2.2 AA accessibility, and Liquid Glass visual aesthetics.

## Objectives
1. **`/workflow-executions` Telemetry Strip**:
   - Add top-level Liquid Glass KPI telemetry cards (Active Executions in Flight, 24h Success Rate %, Avg Duration ms, Blocked Approvals count).
   - Improve active step representation with step numbers and progress indicator.
   - Refine execution drawer and detail visualizer ergonomics with clean breadcrumb and retry / cancel capabilities.

2. **`/workflows` Definitions Catalog Polish**:
   - Remove prototype badge (`POC Faceted Search`) and replace with tenant scope context badge.
   - Add KPI metrics strip (Active Workflows, Draft Versions, Worker Fleet Domains, Pending Approvals).
   - Add direct "View Executions" deep link in the catalog table actions.
   - Add complexity indicators (`nodes count`, `trigger type`) in table columns.

3. **Cross-Screen Linkage**:
   - Filter `/workflow-executions?filter=...` smoothly when navigated from `/workflows`.
   - Ensure breadcrumbs in Studio provide seamless navigation back to catalog or executions.

## Proposed Changes
- `apps/console/src/features/workflow-executions/components/workflow-executions-kpi-bar.tsx`: New component with 4 Liquid Glass metric cards.
- `apps/console/src/features/workflow-executions/index.tsx`: Integrate KPI bar and improve responsive layout.
- `apps/console/src/features/workflows/components/catalog/workflow-catalog-kpi-bar.tsx`: New component with catalog metric cards.
- `apps/console/src/features/workflows/components/catalog/workflow-catalog-columns.tsx`: Add "View Executions" action and complexity tags.
- `apps/console/src/features/workflows/index.tsx`: Clean up header, remove POC badge, integrate KPI bar.
- Update tests for both screens to ensure 100% test pass rate.

## Verification
- `pnpm --filter @unipost/console exec tsc --noEmit`
- `pnpm --filter @unipost/console test -- src/features/workflow-executions src/features/workflows`
