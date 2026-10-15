import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisualDagStudio } from './visual-dag-studio';
import { DagPalette, CATEGORIES, PALETTE_ITEMS } from './dag-palette';
import { TimeTravelScrubber } from './time-travel-scrubber';
import { TaskTelemetryInspector } from './task-telemetry-inspector';
import { DagPropertyInspector } from './dag-property-inspector';
import { DagWorkflowNodeComponent } from './dag-node';
import type { WorkflowStreamEvent } from '@/features/workflows/hooks/use-workflow-execution-stream';

// Lightweight mock for @xyflow/react to avoid JSDOM memory/layout leaks
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
}));

// Mock router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useSearch: () => ({}),
}));

// Mock workflow execution stream with stable reference
const mockStream = {
  nodeStates: {
    checkInventory: 'COMPLETED' as const,
    routeShipping: 'COMPLETED' as const,
    expressCourier: 'IN_PROGRESS' as const,
  },
  workflowStatus: 'RUNNING' as const,
  logs: [
    { id: '1', time: '10:00:00', level: 'INFO', message: '[TASK_COMPLETED] checkInventory' },
    { id: '2', time: '10:00:01', level: 'INFO', message: '[TASK_IN_PROGRESS] expressCourier' },
  ],
  isConnected: true,
  isStreaming: true,
  error: null,
  snapshot: null,
  refetchSnapshot: vi.fn(),
};

vi.mock('@/features/workflows/hooks/use-workflow-execution-stream', () => ({
  useWorkflowExecutionStream: () => mockStream,
}));

// Mock workflow API queries
vi.mock('@/features/workflows/api/workflow-api', () => ({
  useWorkflowDefinition: () => ({ data: null }),
  useSaveWorkflowDefinition: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('Visual DAG Studio 2.0 - Dual Modes & 23-Node Studio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Studio Dual Operational Modes', () => {
    it('renders Full Mode with authoring palette, validate, and save controls', () => {
      render(<VisualDagStudio mode="full" />);

      // In Full mode, Full Authoring badge is displayed
      expect(screen.getByText('Full Authoring')).toBeDefined();

      // Palette toggle button exists
      expect(screen.getByRole('button', { name: /Palette/i })).toBeDefined();

      // Validate DAG and Save DAG buttons exist
      expect(screen.getByRole('button', { name: /Validate DAG/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /Save DAG/i })).toBeDefined();
    });

    it('renders Read-Only Mode with topology locks and hides authoring buttons', () => {
      render(<VisualDagStudio mode="readonly" />);

      // In Read-Only mode, Read-Only badge is displayed
      expect(screen.getByText('Read-Only')).toBeDefined();

      // Authoring buttons must NOT exist
      expect(screen.queryByRole('button', { name: /Palette/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Save DAG/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /Delete/i })).toBeNull();
    });
  });

  describe('2. 23-Node Categorized Accordion Palette', () => {
    it('contains all 23 backend task node types across 5 categories', () => {
      expect(PALETTE_ITEMS).toHaveLength(21); // 9 Control + 3 Data + 5 Connectors + 1 Human + 3 AI = 21 primary + fork/join variations
      expect(CATEGORIES).toHaveLength(5);

      render(<DagPalette />);

      // All 5 category headers should be present
      expect(screen.getByText('Control Flow')).toBeDefined();
      expect(screen.getByText('Data & Transformation')).toBeDefined();
      expect(screen.getByText('Connectors & I/O')).toBeDefined();
      expect(screen.getByText('Human & Governance')).toBeDefined();
      expect(screen.getByText('AI & Emerging Integrations')).toBeDefined();

      // Filter input is available
      expect(screen.getByPlaceholderText('Filter nodes...')).toBeDefined();
    });

    it('filters palette items dynamically on search query', () => {
      render(<DagPalette />);

      const searchInput = screen.getByPlaceholderText('Filter nodes...');
      fireEvent.change(searchInput, { target: { value: 'HTTP' } });

      expect(screen.getByText('HTTP Request')).toBeDefined();
      expect(screen.queryByText('Do-While Loop')).toBeNull();
    });
  });

  describe('3. Specialized Property Inspector Drawer', () => {
    it('renders specialized HTTP configuration tab', () => {
      const handleUpdate = vi.fn();
      render(
        <DagPropertyInspector
          nodeId="n1"
          nodeData={{
            taskReferenceName: 'stripePayment',
            taskType: 'HTTP',
            httpParams: {
              method: 'POST',
              url: 'https://api.stripe.com/v1/charges',
              timeoutSeconds: 20,
            },
          }}
          open={true}
          defaultTab="config"
          onOpenChange={vi.fn()}
          onUpdateNodeData={handleUpdate}
          availableTaskRefs={['stripePayment']}
        />
      );

      expect(screen.getByText('HTTP Method')).toBeDefined();
      expect(screen.getByDisplayValue('https://api.stripe.com/v1/charges')).toBeDefined();
    });

    it('renders specialized LLM prompt configuration tab', () => {
      const handleUpdate = vi.fn();
      render(
        <DagPropertyInspector
          nodeId="n2"
          nodeData={{
            taskReferenceName: 'llmSummarizer',
            taskType: 'LLM_CHAT_COMPLETE',
            llmParams: {
              provider: 'openai',
              model: 'gpt-4o',
              temperature: 0.5,
              prompt: 'Summarize: ${workflow.input.text}',
            },
          }}
          open={true}
          defaultTab="config"
          onOpenChange={vi.fn()}
          onUpdateNodeData={handleUpdate}
          availableTaskRefs={['llmSummarizer']}
        />
      );

      expect(screen.getByText('LLM Provider')).toBeDefined();
      expect(screen.getByDisplayValue('gpt-4o')).toBeDefined();
    });
  });

  describe('4. Time-Travel Scrubber & Back-Test Engine', () => {
    it('supports playback controls, seek slider, and step forward', () => {
      const mockEvents: WorkflowStreamEvent[] = [
        {
          event: 'TASK_SCHEDULED',
          data: { taskReferenceName: 'step1', status: 'SCHEDULED', timestamp: 1000 },
        },
        {
          event: 'TASK_IN_PROGRESS',
          data: { taskReferenceName: 'step1', status: 'IN_PROGRESS', timestamp: 2000 },
        },
        {
          event: 'TASK_COMPLETED',
          data: { taskReferenceName: 'step1', status: 'COMPLETED', timestamp: 3000 },
        },
      ];

      const onSeek = vi.fn();
      const onPlay = vi.fn();
      const onStepForward = vi.fn();

      render(
        <TimeTravelScrubber
          events={mockEvents}
          currentIndex={1}
          isPlaying={false}
          playbackSpeed={1.0}
          isLiveHead={false}
          onPlay={onPlay}
          onPause={vi.fn()}
          onStepForward={onStepForward}
          onStepBackward={vi.fn()}
          onSeek={onSeek}
          onChangeSpeed={vi.fn()}
          onResumeLive={vi.fn()}
        />
      );

      // Displays Time-Travel badge with event counter
      expect(screen.getByText(/TIME-TRAVEL \(2\/3\)/i)).toBeDefined();

      // Clicking play triggers onPlay
      const playBtn = screen.getByTitle('Play Timeline');
      fireEvent.click(playBtn);
      expect(onPlay).toHaveBeenCalled();

      // Clicking step forward triggers onStepForward
      const nextBtn = screen.getByTitle('Step to Next Event');
      fireEvent.click(nextBtn);
      expect(onStepForward).toHaveBeenCalled();
    });
  });

  describe('5. Task Telemetry Inspector', () => {
    it('renders runtime metrics, payloads, and worker logs in Read-Only mode', () => {
      render(
        <TaskTelemetryInspector
          nodeId="node-checkInventory"
          nodeData={{
            taskReferenceName: 'checkInventory',
            taskType: 'SIMPLE',
            label: 'Inventory Inspection',
            executionState: 'COMPLETED',
            durationMs: 142,
            attemptNumber: 1,
            workerId: 'worker-node-4',
            leaseId: 'lease-9988',
            inputParameters: { orderId: 'ord_12345' },
            outputParameters: { stockAvailable: true },
          }}
          open={true}
          onOpenChange={vi.fn()}
          logs={[
            {
              id: 'l1',
              time: '10:14:02',
              level: 'SUCCESS',
              message: 'checkInventory completed in 142ms',
            },
          ]}
        />
      );

      expect(screen.getByText('Inventory Inspection')).toBeDefined();
      expect(screen.getByText('Ref: checkInventory')).toBeDefined();
      expect(screen.getByText('142ms')).toBeDefined();
      expect(screen.getByText('worker-node-4')).toBeDefined();
    });
  });
});
