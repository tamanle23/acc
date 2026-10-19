import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AttributePalette } from './attribute-palette';
import { AttributePropertyInspector } from './attribute-property-inspector';
import { FsmWorkflowDesigner } from './fsm-workflow-designer';
import type { AttributeDefinition } from '../../api/types';

describe('Phase 22: Visual Schema & State Machine (FSM) Workflow Studio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Attribute Palette', () => {
    it('renders all palette element categories (Primitive, Complex, Extended)', () => {
      const handleSelect = vi.fn();
      render(<AttributePalette onSelectFieldType={handleSelect} />);

      expect(screen.getByText(/Attribute Palette/i)).toBeDefined();
      expect(screen.getByText('Single-line Text')).toBeDefined();
      expect(screen.getByText('Numeric Value')).toBeDefined();
      expect(screen.getByText('Boolean Toggle')).toBeDefined();
      expect(screen.getByText('Digital Signature')).toBeDefined();
      expect(screen.getByText('Barcode / QR Reader')).toBeDefined();
      expect(screen.getByText('GPS Coordinates')).toBeDefined();
    });

    it('triggers callback on palette item click', () => {
      const handleSelect = vi.fn();
      render(<AttributePalette onSelectFieldType={handleSelect} />);

      const textBtn = screen.getByText('Single-line Text');
      fireEvent.click(textBtn);

      expect(handleSelect).toHaveBeenCalledTimes(1);
      expect(handleSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'text',
          uiComponent: 'text',
          defaultDataType: 'STRING',
        })
      );
    });
  });

  describe('2. Attribute Property Inspector', () => {
    it('renders placeholder state when no attribute is selected', () => {
      render(
        <AttributePropertyInspector
          attribute={null}
          onUpdateAttribute={vi.fn()}
        />
      );

      expect(screen.getByText('No Attribute Selected')).toBeDefined();
    });

    it('renders and updates JSON Schema constraints (mandatory, min, max, pattern)', () => {
      const mockAttribute: AttributeDefinition = {
        id: 'attr-101',
        name: 'Order Amount',
        systemName: 'total_amount',
        dataType: 'DECIMAL',
        uiComponent: 'number',
        isRequired: true,
        options: {
          min: 10,
          max: 50000,
        },
      };

      const handleUpdate = vi.fn();
      const handleSave = vi.fn();

      render(
        <AttributePropertyInspector
          attribute={mockAttribute}
          onUpdateAttribute={handleUpdate}
          onSave={handleSave}
        />
      );

      expect(screen.getByDisplayValue('Order Amount')).toBeDefined();
      expect(screen.getByDisplayValue('total_amount')).toBeDefined();
      expect(screen.getByText('Mandatory Field')).toBeDefined();
      expect(screen.getByDisplayValue('10')).toBeDefined();
      expect(screen.getByDisplayValue('50000')).toBeDefined();

      const applyBtn = screen.getByText('Apply Constraints');
      fireEvent.click(applyBtn);
      expect(handleSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. FSM State Machine Workflow Designer', () => {
    it('renders all default lifecycle states (DRAFT -> SUBMITTED -> APPROVED -> PUBLISHED -> ARCHIVED)', () => {
      render(<FsmWorkflowDesigner entityTypeName="PurchaseOrder" />);

      expect(screen.getByText(/FSM Workflow: PurchaseOrder/i)).toBeDefined();
      expect(screen.getByText('Draft')).toBeDefined();
      expect(screen.getByText('Submitted')).toBeDefined();
      expect(screen.getByText('Approved')).toBeDefined();
      expect(screen.getByText('Published')).toBeDefined();
      expect(screen.getByText('Archived')).toBeDefined();
    });

    it('displays SpEL guard expression and Transactional Outbox action for selected transition', () => {
      render(<FsmWorkflowDesigner entityTypeName="PurchaseOrder" />);

      // First transition: SUBMIT
      expect(screen.getByText('SUBMIT')).toBeDefined();
      expect(screen.getByText(/Transition Rule: DRAFT → SUBMITTED/i)).toBeDefined();
      expect(screen.getByDisplayValue("attributes['total_amount'] != null")).toBeDefined();
      expect(screen.getByDisplayValue('AUDIT_LOG')).toBeDefined();
    });

    it('switches transition inspector when clicking another event badge', () => {
      render(<FsmWorkflowDesigner entityTypeName="PurchaseOrder" />);

      const approveBadge = screen.getByText('APPROVE');
      fireEvent.click(approveBadge);

      expect(screen.getByText(/Transition Rule: SUBMITTED → APPROVED/i)).toBeDefined();
      expect(screen.getByDisplayValue("attributes['total_amount'] < 50000")).toBeDefined();
      expect(screen.getByDisplayValue('NOTIFICATION_DISPATCH')).toBeDefined();
    });

    it('renders Auto Layout controls and responds to Force Refresh button click', () => {
      render(<FsmWorkflowDesigner entityTypeName="PurchaseOrder" />);

      // Verify layout controls rendered
      expect(screen.getByText('Staggered')).toBeDefined();
      expect(screen.getByText('Linear DAG')).toBeDefined();
      expect(screen.getByText('Compact')).toBeDefined();
      const autoLayoutBtn = screen.getByRole('button', { name: /Auto Layout/i });
      expect(autoLayoutBtn).toBeDefined();

      // Trigger force auto layout
      fireEvent.click(autoLayoutBtn);

      // Switch to Linear DAG layout mode
      const dagBtn = screen.getByText('Linear DAG');
      fireEvent.click(dagBtn);
    });
  });
});
