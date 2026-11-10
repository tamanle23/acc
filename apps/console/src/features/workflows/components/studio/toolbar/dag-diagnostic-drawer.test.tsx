import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DagDiagnosticDrawer } from './dag-diagnostic-drawer';
import { type DagDiagnosticIssue } from '../utils/validation/dag-semantic-linter';

describe('DagDiagnosticDrawer', () => {
  const sampleIssues: DagDiagnosticIssue[] = [
    {
      id: 'issue-1',
      ruleId: 'MISSING_REQUIRED_INPUT',
      severity: 'error',
      nodeId: 'node-http',
      taskReferenceName: 'fetchData',
      paramKey: 'url',
      message: "Node 'fetchData' is missing required input 'url'.",
      suggestion: "Define 'url' in the node input parameters.",
    },
    {
      id: 'issue-2',
      ruleId: 'CONDITIONAL_BRANCH_NULLABILITY',
      severity: 'warning',
      nodeId: 'node-join',
      taskReferenceName: 'joinTask',
      paramKey: 'rate',
      expression: '${expressRate.output.rate}',
      message: "Expression references conditional task.",
      suggestion: 'Ensure fallback value is present.',
    },
  ];

  it('renders null when isOpen is false', () => {
    const { container } = render(
      <DagDiagnosticDrawer
        isOpen={false}
        onClose={vi.fn()}
        issues={sampleIssues}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders issue counts and allows filtering by severity', () => {
    render(
      <DagDiagnosticDrawer
        isOpen={true}
        onClose={vi.fn()}
        issues={sampleIssues}
      />
    );

    expect(screen.getByText(/DAG Diagnostics \(2\)/)).toBeDefined();
    expect(screen.getByTestId('dag-diagnostic-item-issue-1')).toBeDefined();
    expect(screen.getByTestId('dag-diagnostic-item-issue-2')).toBeDefined();

    // Click Errors filter
    fireEvent.click(screen.getByTestId('dag-diagnostic-tab-errors'));
    expect(screen.getByTestId('dag-diagnostic-item-issue-1')).toBeDefined();
    expect(screen.queryByTestId('dag-diagnostic-item-issue-2')).toBeNull();

    // Click Warnings filter
    fireEvent.click(screen.getByTestId('dag-diagnostic-tab-warnings'));
    expect(screen.queryByTestId('dag-diagnostic-item-issue-1')).toBeNull();
    expect(screen.getByTestId('dag-diagnostic-item-issue-2')).toBeDefined();
  });

  it('triggers onSelectNode when Focus button is clicked', () => {
    const handleSelectNode = vi.fn();
    render(
      <DagDiagnosticDrawer
        isOpen={true}
        onClose={vi.fn()}
        issues={sampleIssues}
        onSelectNode={handleSelectNode}
      />
    );

    const focusBtn = screen.getByTestId('dag-diagnostic-jump-btn-issue-1');
    fireEvent.click(focusBtn);

    expect(handleSelectNode).toHaveBeenCalledWith('node-http');
  });
});
