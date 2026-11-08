import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkflowContractsModal } from './workflow-contracts-modal';
import type { WorkflowIR } from '../utils/workflow-ir-converter';

describe('WorkflowContractsModal Component Unit Tests', () => {
  const sampleIR: WorkflowIR = {
    workflowKey: 'order-fulfillment',
    version: 1,
    name: 'Order Fulfillment',
    inputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        orderId: { type: 'string' },
        amount: { type: 'number' },
      },
      required: ['orderId', 'amount'],
      additionalProperties: false,
    },
    outputSchema: {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties: {
        fulfillmentStatus: { type: 'string' },
        trackingNumber: { type: 'string' },
      },
      required: ['fulfillmentStatus', 'trackingNumber'],
      additionalProperties: false,
    },
    tasks: [
      {
        taskReferenceName: 'workflow_start',
        taskType: 'START_WORKFLOW',
      },
      {
        taskReferenceName: 'workflow_end',
        taskType: 'END_WORKFLOW',
        inputParameters: {
          fulfillmentStatus: '${shipment.output.status}',
          trackingNumber: '${shipment.output.tracking}',
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('renders modal with both input and output contracts and displays satisfied status', () => {
    const handleOpenChange = vi.fn();

    render(
      <WorkflowContractsModal
        open={true}
        onOpenChange={handleOpenChange}
        workflowIR={sampleIR}
      />
    );

    expect(screen.getByTestId('workflow-contracts-modal')).toBeDefined();
    expect(screen.getByText('Workflow I/O Contract Specifications')).toBeDefined();
    expect(screen.getByText('Contracts Satisfied')).toBeDefined();
    expect(screen.getByText('Trigger Ingestion Contract')).toBeDefined();
    expect(screen.getByText('Terminal Exit Contract')).toBeDefined();
    expect(screen.getByText('orderId')).toBeDefined();
    expect(screen.getByText('amount')).toBeDefined();
    expect(screen.getByText('fulfillmentStatus')).toBeDefined();
    expect(screen.getByText('trackingNumber')).toBeDefined();
  });

  it('flags unsatisfied exit fields when End node mapping is incomplete', () => {
    const incompleteIR: WorkflowIR = {
      ...sampleIR,
      tasks: [
        {
          taskReferenceName: 'workflow_start',
          taskType: 'START_WORKFLOW',
        },
        {
          taskReferenceName: 'workflow_end',
          taskType: 'END_WORKFLOW',
          inputParameters: {
            fulfillmentStatus: '${shipment.output.status}',
            // trackingNumber is omitted!
          },
        },
      ],
    };

    render(
      <WorkflowContractsModal
        open={true}
        onOpenChange={vi.fn()}
        workflowIR={incompleteIR}
      />
    );

    expect(screen.getByText(/1 Unsatisfied Exit Fields/i)).toBeDefined();
    expect(screen.getByText('UNMAPPED')).toBeDefined();
  });

  it('navigates to Start Node or End Node when clicking inspection buttons', () => {
    const handleOpenStart = vi.fn();
    const handleOpenEnd = vi.fn();
    const handleOpenChange = vi.fn();

    render(
      <WorkflowContractsModal
        open={true}
        onOpenChange={handleOpenChange}
        workflowIR={sampleIR}
        onOpenStartNode={handleOpenStart}
        onOpenEndNode={handleOpenEnd}
      />
    );

    const startBtn = screen.getByText('Configure in Start Node Inspector');
    fireEvent.click(startBtn);
    expect(handleOpenStart).toHaveBeenCalledTimes(1);

    const endBtn = screen.getByText('Configure in End Node Inspector');
    fireEvent.click(endBtn);
    expect(handleOpenEnd).toHaveBeenCalledTimes(1);
  });
});
