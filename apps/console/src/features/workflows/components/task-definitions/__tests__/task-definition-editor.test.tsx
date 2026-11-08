import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SchemaPropertyGrid,
  schemaToRows,
  rowsToSchema,
  type SchemaPropertyRow,
} from '../schema-property-grid';
import {
  SchemaTestSandbox,
  validatePayloadAgainstSchema,
  generateSampleFromSchema,
} from '../schema-test-sandbox';

describe('SchemaPropertyGrid & AST Converters', () => {
  const sampleSchema = {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    title: 'CustomerOrder',
    properties: {
      orderId: { type: 'string', description: 'Order ID' },
      amount: { type: 'number', description: 'Payment amount', default: 99.5 },
      isExpress: { type: 'boolean', description: 'Express delivery' },
    },
    required: ['orderId', 'amount'],
    additionalProperties: false,
  };

  it('converts JSON Schema properties into property grid rows accurately', () => {
    const rows = schemaToRows(sampleSchema);
    expect(rows).toHaveLength(3);

    const orderIdRow = rows.find((r) => r.name === 'orderId');
    expect(orderIdRow).toBeDefined();
    expect(orderIdRow?.type).toBe('string');
    expect(orderIdRow?.required).toBe(true);

    const amountRow = rows.find((r) => r.name === 'amount');
    expect(amountRow?.type).toBe('number');
    expect(amountRow?.required).toBe(true);
    expect(amountRow?.defaultValue).toBe('99.5');

    const expressRow = rows.find((r) => r.name === 'isExpress');
    expect(expressRow?.type).toBe('boolean');
    expect(expressRow?.required).toBe(false);
  });

  it('converts property grid rows back into valid JSON Schema with required array', () => {
    const inputRows: SchemaPropertyRow[] = [
      {
        id: '1',
        name: 'userId',
        type: 'string',
        required: true,
        description: 'User identifier',
      },
      {
        id: '2',
        name: 'tierCount',
        type: 'integer',
        required: false,
        description: 'Tier level',
        defaultValue: '3',
      },
    ];

    const result = rowsToSchema(inputRows);
    expect(result.type).toBe('object');
    expect(result.additionalProperties).toBe(false);
    expect(result.required).toEqual(['userId']);

    const props = result.properties as Record<string, any>;
    expect(props.userId).toEqual({
      type: 'string',
      description: 'User identifier',
    });
    expect(props.tierCount).toEqual({
      type: 'integer',
      description: 'Tier level',
      default: 3,
    });
  });

  it('renders property grid in visual mode and triggers onChange on addition', () => {
    const onChange = vi.fn();
    render(<SchemaPropertyGrid value={sampleSchema} onChange={onChange} />);

    expect(screen.getByText('3 fields')).toBeDefined();
    expect(screen.getByText('2 required')).toBeDefined();

    const addBtn = screen.getByRole('button', { name: /add property/i });
    fireEvent.click(addBtn);

    // Form inputs should now include a new empty field row
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThan(3);
  });
});

describe('SchemaTestSandbox & Payload Validation', () => {
  const testSchema = {
    type: 'object',
    properties: {
      orderId: { type: 'string' },
      quantity: { type: 'number' },
    },
    required: ['orderId'],
    additionalProperties: false,
  };

  it('validates conforming payload successfully', () => {
    const validPayload = { orderId: 'ORD-123', quantity: 5 };
    const errors = validatePayloadAgainstSchema(validPayload, testSchema);
    expect(errors).toHaveLength(0);
  });

  it('flags missing required property and unexpected additional properties', () => {
    const invalidPayload = { quantity: 10, rogueProp: 'bad' };
    const errors = validatePayloadAgainstSchema(invalidPayload, testSchema);
    expect(errors.length).toBeGreaterThanOrEqual(2);

    const requiredError = errors.find((e) => e.path === '$.orderId');
    expect(requiredError).toBeDefined();

    const additionalError = errors.find((e) => e.path === '$.rogueProp');
    expect(additionalError).toBeDefined();
  });

  it('generates sample payload conforming to defined schema', () => {
    const sample = generateSampleFromSchema(testSchema);
    expect(sample.orderId).toBe('sample_orderId');
    expect(sample.quantity).toBe(100);
  });
});
