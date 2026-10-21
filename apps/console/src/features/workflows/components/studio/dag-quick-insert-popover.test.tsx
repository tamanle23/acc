import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DagQuickInsertPopover } from './dag-quick-insert-popover';

describe('DagQuickInsertPopover Component Unit Tests', () => {
  it('renders popover with search input, categories, and full node items list', () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <DagQuickInsertPopover
        position={{ x: 200, y: 200 }}
        onSelectNodeType={handleSelect}
        onClose={handleClose}
      />
    );

    expect(screen.getByText('Insert Task Node')).toBeDefined();
    expect(screen.getByPlaceholderText('Search 23 task node types...')).toBeDefined();
    expect(screen.getByText('All (23)')).toBeDefined();

    // Default first item (SIMPLE) is present
    expect(screen.getByText('Simple Task')).toBeDefined();
    // FORK_JOIN is present
    expect(screen.getByText('Fork (Parallel Split)')).toBeDefined();
  });

  it('filters items dynamically when search query is typed', () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <DagQuickInsertPopover
        position={{ x: 200, y: 200 }}
        onSelectNodeType={handleSelect}
        onClose={handleClose}
      />
    );

    const input = screen.getByTestId('dag-quick-insert-search-input');
    fireEvent.change(input, { target: { value: 'Switch' } });

    expect(screen.getByText('Switch Node')).toBeDefined();
    expect(screen.queryByText('Simple Task')).toBeNull();
  });

  it('filters items when category tab is clicked', () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <DagQuickInsertPopover
        position={{ x: 200, y: 200 }}
        onSelectNodeType={handleSelect}
        onClose={handleClose}
      />
    );

    // Click 'AI' category
    const aiTab = screen.getByText('AI');
    fireEvent.click(aiTab);

    expect(screen.getByText('LLM Prompt')).toBeDefined();
    expect(screen.queryByText('Simple Task')).toBeNull();
  });

  it('selects item on click and triggers onSelectNodeType', () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <DagQuickInsertPopover
        position={{ x: 200, y: 200 }}
        onSelectNodeType={handleSelect}
        onClose={handleClose}
      />
    );

    const item = screen.getByTestId('dag-quick-insert-item-SIMPLE');
    fireEvent.click(item);

    expect(handleSelect).toHaveBeenCalledWith('SIMPLE', expect.objectContaining({ taskType: 'SIMPLE' }));
  });

  it('navigates with keyboard and selects with Enter, or closes with Escape', () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <DagQuickInsertPopover
        position={{ x: 200, y: 200 }}
        onSelectNodeType={handleSelect}
        onClose={handleClose}
      />
    );

    // Arrow down
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    // Enter
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(handleSelect).toHaveBeenCalled();

    // Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalled();
  });

  it('supports onSelect callback prop as well for backward compatibility', () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    render(
      <DagQuickInsertPopover
        position={{ x: 200, y: 200 }}
        onSelect={handleSelect}
        onClose={handleClose}
      />
    );

    const item = screen.getByTestId('dag-quick-insert-item-SIMPLE');
    fireEvent.click(item);

    expect(handleSelect).toHaveBeenCalledWith(
      'SIMPLE',
      'Simple Task',
      expect.objectContaining({ taskType: 'SIMPLE' })
    );
  });
});
