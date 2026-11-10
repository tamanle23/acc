import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  VariableBindingPopover,
  getTopologicalAncestors,
  evaluateExpressionPreview,
} from './variable-binding-popover';
import { type Node, type Edge } from '@xyflow/react';
import { type DagNodeData } from './dag-node';

describe('VariableBindingPopover & Expression Autocomplete Engine', () => {
  const sampleNodes: Node<DagNodeData>[] = [
    {
      id: 'node-start',
      type: 'dagNode',
      position: { x: 0, y: 0 },
      data: {
        taskReferenceName: 'start',
        taskType: 'START_WORKFLOW',
        isStartNode: true,
        inputParameters: { orderId: 'ORD-99', customerId: 'CUST-10' },
      },
    },
    {
      id: 'node-fetchUser',
      type: 'dagNode',
      position: { x: 200, y: 0 },
      data: {
        taskReferenceName: 'fetchUser',
        taskType: 'HTTP',
        label: 'Fetch User',
        mockOutputPayload: {
          status: 200,
          body: {
            user: {
              id: 'USR-1',
              email: 'alice@example.com',
            },
          },
        },
      },
    },
    {
      id: 'node-process',
      type: 'dagNode',
      position: { x: 400, y: 0 },
      data: {
        taskReferenceName: 'processOrder',
        taskType: 'SIMPLE',
        label: 'Process Order',
      },
    },
    {
      id: 'node-downstream',
      type: 'dagNode',
      position: { x: 600, y: 0 },
      data: {
        taskReferenceName: 'sendNotification',
        taskType: 'HTTP',
        label: 'Send Notification',
      },
    },
  ];

  const sampleEdges: Edge[] = [
    { id: 'e1', source: 'node-start', target: 'node-fetchUser' },
    { id: 'e2', source: 'node-fetchUser', target: 'node-process' },
    { id: 'e3', source: 'node-process', target: 'node-downstream' },
  ];

  describe('getTopologicalAncestors', () => {
    it('returns only valid upstream ancestors for node-process', () => {
      const ancestors = getTopologicalAncestors('node-process', sampleNodes, sampleEdges);
      const ancestorRefs = ancestors.map((n) => n.data.taskReferenceName);

      expect(ancestorRefs).toContain('start');
      expect(ancestorRefs).toContain('fetchUser');
      expect(ancestorRefs).not.toContain('processOrder'); // Self excluded
      expect(ancestorRefs).not.toContain('sendNotification'); // Downstream excluded
    });

    it('isolates concurrent branches in a parallel FORK_JOIN', () => {
      const forkNodes: Node<DagNodeData>[] = [
        { id: 'start', type: 'dagNode', position: { x: 0, y: 0 }, data: { taskReferenceName: 'start', taskType: 'START_WORKFLOW' } },
        { id: 'fork', type: 'dagNode', position: { x: 100, y: 0 }, data: { taskReferenceName: 'fork', taskType: 'FORK_JOIN' } },
        { id: 'b1', type: 'dagNode', position: { x: 200, y: -50 }, data: { taskReferenceName: 'branch1', taskType: 'SIMPLE' } },
        { id: 'b2', type: 'dagNode', position: { x: 200, y: 50 }, data: { taskReferenceName: 'branch2', taskType: 'SIMPLE' } },
      ];
      const forkEdges: Edge[] = [
        { id: 'e1', source: 'start', target: 'fork' },
        { id: 'e2', source: 'fork', target: 'b1' },
        { id: 'e3', source: 'fork', target: 'b2' },
      ];

      // branch2 ancestors should NOT include sibling branch1
      const b2Ancestors = getTopologicalAncestors('b2', forkNodes, forkEdges).map((n) => n.data.taskReferenceName);
      expect(b2Ancestors).toContain('fork');
      expect(b2Ancestors).toContain('start');
      expect(b2Ancestors).not.toContain('branch1');
    });
  });

  describe('evaluateExpressionPreview', () => {
    const ancestors = getTopologicalAncestors('node-process', sampleNodes, sampleEdges);

    it('evaluates workflow.input references to sample values', () => {
      const result = evaluateExpressionPreview('${workflow.input.customerId}', ancestors);
      expect(result.isValid).toBe(true);
      expect(result.evaluatedValue).toBe('CUST-10');
    });

    it('evaluates nested upstream task output references to mock values', () => {
      const result = evaluateExpressionPreview('${fetchUser.output.body.user.email}', ancestors);
      expect(result.isValid).toBe(true);
      expect(result.evaluatedValue).toBe('alice@example.com');
    });

    it('flags error if referencing a non-ancestor task', () => {
      const result = evaluateExpressionPreview('${sendNotification.output.status}', ancestors);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('is not an upstream dependency');
    });
  });

  describe('VariableBindingPopover UI Component', () => {
    it('renders trigger button and opens schema tree when clicked', () => {
      const onSelect = vi.fn();
      render(
        <VariableBindingPopover
          currentNodeId="node-process"
          nodes={sampleNodes}
          edges={sampleEdges}
          onSelectVariable={onSelect}
        />
      );

      const trigger = screen.getByTestId('variable-binding-picker-trigger');
      expect(trigger).toBeDefined();

      fireEvent.click(trigger);

      // Popover content should be visible
      expect(screen.getByTestId('variable-binding-popover-content')).toBeDefined();
      expect(screen.getByText('workflow.input')).toBeDefined();
      expect(screen.getAllByText('orderId').length).toBeGreaterThan(0);
      expect(screen.getByText('Fetch User')).toBeDefined();
    });
  });
});
