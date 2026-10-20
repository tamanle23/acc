import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VisualJsonEditor, validateAgainstJsonSchema } from './visual-json-editor';

describe('VisualJsonEditor - Iteration 13 Advanced Capabilities', () => {
  it('supports real-time search & filter with match count badge', () => {
    const sample = {
      orderId: 'ORD-9001',
      customer: {
        name: 'Alice Vance',
        email: 'alice@example.com',
      },
      items: ['laptop', 'mouse'],
    };

    render(<VisualJsonEditor value={sample} onChange={vi.fn()} />);

    const searchInput = screen.getByLabelText('Filter JSON keys or values');
    fireEvent.change(searchInput, { target: { value: 'alice' } });

    expect(screen.getByText('2')).toBeTruthy();
  });

  it('supports array item Move Up and Move Down reordering', () => {
    const onChange = vi.fn();
    const sample = ['first', 'second', 'third'];

    render(<VisualJsonEditor value={sample} onChange={onChange} defaultMode="tree" />);

    const moveDownButtons = screen.getAllByLabelText('Move item down');
    expect(moveDownButtons.length).toBeGreaterThan(0);

    fireEvent.click(moveDownButtons[0]);
    expect(onChange).toHaveBeenCalledWith(['second', 'first', 'third']);
  });

  it('validates against JSON Schema non-blockingly and surfaces inline errors', () => {
    const schema = {
      type: 'object',
      required: ['orderId', 'quantity'],
      properties: {
        orderId: { type: 'string', minLength: 5 },
        quantity: { type: 'number', minimum: 1 },
      },
    };

    const invalidPayload = {
      orderId: 'abc',
      quantity: 0,
    };

    const errors = validateAgainstJsonSchema(invalidPayload, schema);
    expect(errors['orderId']).toContain('Minimum length');
    expect(errors['quantity']).toContain('Minimum value');

    const onValidationChange = vi.fn();
    render(
      <VisualJsonEditor
        value={invalidPayload}
        onChange={vi.fn()}
        jsonSchema={schema}
        onValidationChange={onValidationChange}
      />
    );

    expect(screen.getByText(/2 Schema Issues/i)).toBeTruthy();
    expect(onValidationChange).toHaveBeenCalledWith(false, expect.any(Object));
  });
});

