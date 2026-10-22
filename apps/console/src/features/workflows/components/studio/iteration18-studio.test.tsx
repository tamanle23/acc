import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DagPalette } from './palette/dag-palette';
import { DagCanvasEmptyState } from './canvas/dag-canvas-empty-state';
import { VisualDagStudio, BLANK_WORKFLOW_NODES, BLANK_WORKFLOW_EDGES } from './visual-dag-studio';

// Lightweight mock for @xyflow/react to avoid JSDOM layout issues
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: any) => <div data-testid="react-flow-mock">{children}</div>,
  ReactFlowProvider: ({ children }: any) => <div>{children}</div>,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  useReactFlow: () => ({
    screenToFlowPosition: ({ x, y }: any) => ({ x, y }),
  }),
  applyNodeChanges: (_: any, nds: any) => nds,
  applyEdgeChanges: (_: any, eds: any) => eds,
  addEdge: (params: any, eds: any) => [...eds, params],
  SelectionMode: { Partial: 'partial', Full: 'full' },
}));

// Mock router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

// Mock dependencies for react-flow and stream
vi.mock('@/features/workflows/hooks/use-workflow-execution-stream', () => ({
  useWorkflowExecutionStream: () => ({
    logs: [],
    workflowStatus: 'RUNNING',
    snapshot: null,
  }),
}));

vi.mock('@/features/workflows/api/workflow-api', () => ({
  useSaveWorkflowDefinition: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useWorkflowDefinition: () => ({ data: null }),
  useWorkflowVersions: () => ({ data: [] }),
  useUpdateWorkflowBreakpoints: () => ({ mutate: vi.fn() }),
  usePauseWorkflowExecution: () => ({ mutate: vi.fn() }),
  useResumeWorkflowExecution: () => ({ mutate: vi.fn() }),
  useStepOverWorkflowExecution: () => ({ mutate: vi.fn(), isPending: false }),
  useRerunWorkflowTask: () => ({ mutate: vi.fn(), isPending: false }),
  useSimulateWorkflowDefinition: () => ({ mutate: vi.fn(), isPending: false }),
  useMigrationDryRun: () => ({ mutate: vi.fn(), isPending: false }),
  useMigrateExecution: () => ({ mutate: vi.fn(), isPending: false }),
  useVerifyAuditLedger: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/features/workers/api/worker-fleet-api', () => ({
  useWorkerCatalog: () => ({ data: [], isLoading: false }),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('Iteration 18: Visual DAG Studio Layout & UI/UX Overhaul', () => {
  describe('1. Segmented Floating Command Bar', () => {
    it('renders 3 distinct floating clusters across top of canvas in full mode', () => {
      renderWithProviders(<VisualDagStudio mode="full" workflowKey="order-fulfillment" />);

      // Cluster 1: Left (Identity & Context)
      const leftCluster = screen.getByTestId('dag-toolbar-left-cluster');
      expect(leftCluster).toBeDefined();
      expect(leftCluster.textContent).toContain('Visual DAG Studio 2.0');
      expect(leftCluster.textContent).toContain('Full Authoring');
      expect(leftCluster.textContent).toContain('order-fulfillment');

      // Cluster 2: Center (Canvas Ergonomics)
      const centerCluster = screen.getByTestId('dag-toolbar-center-cluster');
      expect(centerCluster).toBeDefined();
      expect(screen.getByTestId('dag-auto-layout-btn')).toBeDefined();
      expect(screen.getByTestId('dag-snap-grid-btn')).toBeDefined();
      expect(screen.getByTestId('dag-edge-routing-btn')).toBeDefined();
      expect(screen.getByTitle('Undo (Cmd+Z)')).toBeDefined();
      expect(screen.getByTitle('Redo (Cmd+Y)')).toBeDefined();

      // Cluster 3: Right (Workflow Actions & CTAs)
      const rightCluster = screen.getByTestId('dag-toolbar-right-cluster');
      expect(rightCluster).toBeDefined();
      expect(screen.getByRole('button', { name: /^Palette$/i })).toBeDefined();
      expect(screen.getByTestId('dag-new-blank-btn')).toBeDefined();
      expect(screen.getByRole('button', { name: /Validate DAG/i })).toBeDefined();
      expect(screen.getByTestId('dag-dry-run-btn')).toBeDefined();
      expect(screen.getByTestId('dag-ir-dropdown-btn')).toBeDefined();
      expect(screen.getByTestId('dag-fullscreen-btn')).toBeDefined();
      expect(screen.getByTestId('dag-save-btn')).toBeDefined();
    });

    it('toggles Fullscreen mode with button and exits on Escape key', () => {
      const { container } = renderWithProviders(<VisualDagStudio mode="full" />);

      const fullscreenBtn = screen.getByTestId('dag-fullscreen-btn');
      const studioRoot = container.querySelector('.relative.w-full') as HTMLElement;
      expect(studioRoot.classList.contains('h-[650px]')).toBe(true);

      // Enter fullscreen
      fireEvent.click(fullscreenBtn);
      expect(studioRoot.classList.contains('fixed')).toBe(true);
      expect(studioRoot.classList.contains('inset-0')).toBe(true);
      expect(studioRoot.classList.contains('z-50')).toBe(true);

      // Exit fullscreen with Escape key
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(studioRoot.classList.contains('h-[650px]')).toBe(true);
      expect(studioRoot.classList.contains('fixed')).toBe(false);
    });
  });

  describe('2. Contextual Floating Execution Debugger Sub-Pill', () => {
    it('renders amber debugger sub-pill floating beneath top bar in execution mode', () => {
      renderWithProviders(
        <VisualDagStudio
          mode="execution"
          executionId="exec-12345"
          workflowKey="order-fulfillment"
        />
      );

      const debuggerPill = screen.getByTestId('dag-execution-debugger-subpill');
      expect(debuggerPill).toBeDefined();
      expect(debuggerPill.textContent?.toLowerCase()).toContain('debugger');
      expect(screen.getByTestId('debugger-pause-btn')).toBeDefined();
      expect(screen.getByTestId('debugger-step-btn')).toBeDefined();
      expect(screen.getByTestId('debugger-resume-btn')).toBeDefined();
      expect(screen.getByTestId('debugger-variable-watch-btn')).toBeDefined();
    });

    it('does not render debugger sub-pill in authoring mode', () => {
      renderWithProviders(<VisualDagStudio mode="full" />);
      expect(screen.queryByTestId('dag-execution-debugger-subpill')).toBeNull();
    });
  });

  describe('3. Collapsible Node Palette with Slim Rail Mode', () => {
    it('toggles between full categorized accordion and slim icon rail', () => {
      render(<DagPalette />);

      // Initially expanded: header texts visible
      expect(screen.getByText('Node Palette')).toBeDefined();
      expect(screen.getByText('Control Flow')).toBeDefined();
      expect(screen.getByPlaceholderText('Filter nodes...')).toBeDefined();

      // Click collapse button
      const collapseBtn = screen.getByTestId('dag-palette-collapse-toggle-btn');
      fireEvent.click(collapseBtn);

      // In slim rail mode: header text and category headers are collapsed
      expect(screen.queryByText('Node Palette')).toBeNull();
      expect(screen.queryByPlaceholderText('Filter nodes...')).toBeNull();
      expect(screen.getByTestId('dag-palette-rail')).toBeDefined();

      // Click expand button to expand back
      const expandBtn = screen.getByTestId('dag-palette-collapse-toggle-btn');
      fireEvent.click(expandBtn);
      expect(screen.getByText('Node Palette')).toBeDefined();
    });

    it('supports defaultCollapsed prop to start in slim rail mode on small viewports', () => {
      render(<DagPalette defaultCollapsed={true} />);

      // Starts directly in collapsed rail mode
      expect(screen.queryByText('Node Palette')).toBeNull();
      expect(screen.getByTestId('dag-palette-rail')).toBeDefined();
      expect(screen.getByTestId('dag-palette-collapse-toggle-btn')).toBeDefined();
    });
  });

  describe('4. Blank Canvas Onboarding Helper Prompt', () => {
    it('renders DagCanvasEmptyState when canvas is blank with only START and END', () => {
      renderWithProviders(
        <VisualDagStudio
          mode="full"
          initialNodes={BLANK_WORKFLOW_NODES}
          initialEdges={BLANK_WORKFLOW_EDGES}
        />
      );

      const emptyPrompt = screen.getByTestId('dag-canvas-empty-state');
      expect(emptyPrompt).toBeDefined();
      expect(screen.getByText('Start Building Your Workflow')).toBeDefined();
      expect(screen.getByTestId('empty-state-add-simple-btn')).toBeDefined();
      expect(screen.getByTestId('empty-state-add-http-btn')).toBeDefined();
      expect(screen.getByTestId('empty-state-open-palette-btn')).toBeDefined();
    });

    it('inserts a starter Simple Task and dismisses empty prompt upon click', () => {
      renderWithProviders(
        <VisualDagStudio
          mode="full"
          initialNodes={BLANK_WORKFLOW_NODES}
          initialEdges={BLANK_WORKFLOW_EDGES}
        />
      );

      expect(screen.getByTestId('dag-canvas-empty-state')).toBeDefined();

      const addSimpleBtn = screen.getByTestId('empty-state-add-simple-btn');
      fireEvent.click(addSimpleBtn);

      // Empty prompt automatically dismisses
      expect(screen.queryByTestId('dag-canvas-empty-state')).toBeNull();
    });
  });

  describe('5. Responsive Layout Adaptations', () => {
    it('renders responsive toolbar elements with proper aria-labels on compact screens', () => {
      renderWithProviders(<VisualDagStudio mode="full" />);

      const autoLayoutBtn = screen.getByTestId('dag-auto-layout-btn');
      expect(autoLayoutBtn.getAttribute('aria-label')).toBe('Topological Auto-Layout');

      const snapBtn = screen.getByTestId('dag-snap-grid-btn');
      expect(snapBtn.getAttribute('aria-label')).toContain('Snap to Grid');

      const edgeBtn = screen.getByTestId('dag-edge-routing-btn');
      expect(edgeBtn.getAttribute('aria-label')).toContain('Edge Routing');

      const saveBtn = screen.getByTestId('dag-save-btn');
      expect(saveBtn).toBeDefined();
      expect(saveBtn.textContent).toContain('Save');
    });
  });
});
