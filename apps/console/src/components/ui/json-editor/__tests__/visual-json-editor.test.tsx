import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisualJsonEditor } from '../visual-json-editor';
import { JsonCellPopover } from '../json-cell-popover';

describe('VisualJsonEditor Component', () => {
  it('renders default tree mode with parsed JSON object', () => {
    const data = { name: 'Acme Corp', count: 42, active: true };
    render(<VisualJsonEditor value={data} onChange={vi.fn()} />);

    expect(screen.getByText('Tree')).toBeDefined();
    expect(screen.getByText('Form')).toBeDefined();
    expect(screen.getByText('Code')).toBeDefined();
    expect(screen.getByText('name:')).toBeDefined();
    expect(screen.getByText('count:')).toBeDefined();
  });

  it('allows switching to code mode and displays raw formatted JSON', () => {
    const data = { key: 'value' };
    render(<VisualJsonEditor value={data} onChange={vi.fn()} />);

    const codeBtn = screen.getByText('Code');
    fireEvent.click(codeBtn);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toContain('"key": "value"');
  });

  it('displays syntax error badge when invalid JSON is entered in code mode', () => {
    render(<VisualJsonEditor value={{}} onChange={vi.fn()} defaultMode="code" />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '{ invalid: json' } });

    expect(screen.getByText(/Syntax Error/i)).toBeDefined();
  });

  it('renders JsonCellPopover with key count badge and opens popover on click', () => {
    const data = { alpha: 1, beta: 2, gamma: 3 };
    render(<JsonCellPopover value={data} attributeName="Telemetry" />);

    const badgeBtn = screen.getByText('{ 3 keys }');
    expect(badgeBtn).toBeDefined();

    fireEvent.click(badgeBtn);
    expect(screen.getByText('Telemetry')).toBeDefined();
  });
});
