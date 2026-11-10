import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DagHeaderCommandBar } from './dag-header-command-bar';

describe('DagHeaderCommandBar', () => {
  const baseProps = {
    workflowVersions: [{ version: 1, status: 'ACTIVE' }],
    diffTargetVersion: null,
    onDiffVersionChange: vi.fn(),
    isExecutionMode: false,
    undoDisabled: false,
    redoDisabled: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onAutoLayout: vi.fn(),
    isSnapToGrid: true,
    onToggleSnapToGrid: vi.fn(),
    edgeRoutingMode: 'bezier' as const,
    onToggleEdgeRouting: vi.fn(),
    activeViewTab: 'graph' as const,
    onChangeViewTab: vi.fn(),
    showPalette: true,
    onTogglePalette: vi.fn(),
    onNewBlank: vi.fn(),
    onValidateDag: vi.fn(),
    validationErrorsCount: 0,
    onDryRun: vi.fn(),
    onExportJson: vi.fn(),
    onOpenImportDialog: vi.fn(),
    onResetInitial: vi.fn(),
    onClearSelected: vi.fn(),
    hasSelectedNodes: false,
    isFullscreen: false,
    onToggleFullscreen: vi.fn(),
    onSave: vi.fn(),
    isSaving: false,
  };

  it('renders data lineage, view density, search and diagnostic controls when provided', () => {
    const handleToggleLineage = vi.fn();
    const handleChangeDensity = vi.fn();
    const handleToggleSearch = vi.fn();
    const handleOpenDiagnostics = vi.fn();

    render(
      <DagHeaderCommandBar
        {...baseProps}
        showDataLineage={false}
        onToggleDataLineage={handleToggleLineage}
        viewDensity="standard"
        onChangeViewDensity={handleChangeDensity}
        onToggleSearch={handleToggleSearch}
        onOpenDiagnostics={handleOpenDiagnostics}
        diagnosticIssuesCount={2}
      />
    );

    const lineageBtn = screen.getByTestId('dag-data-lineage-btn');
    expect(lineageBtn).toBeDefined();
    fireEvent.click(lineageBtn);
    expect(handleToggleLineage).toHaveBeenCalled();

    const densityBtn = screen.getByTestId('dag-view-density-btn');
    expect(densityBtn).toBeDefined();

    const findBtn = screen.getByTestId('dag-find-nodes-btn');
    expect(findBtn).toBeDefined();
    fireEvent.click(findBtn);
    expect(handleToggleSearch).toHaveBeenCalled();

    const diagBtn = screen.getByTestId('dag-diagnostics-pill-btn');
    expect(diagBtn).toBeDefined();
    expect(diagBtn.textContent).toContain('2 Issues');
    fireEvent.click(diagBtn);
    expect(handleOpenDiagnostics).toHaveBeenCalled();
  });
});
