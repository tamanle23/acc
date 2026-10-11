import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DynamicFieldRenderer } from '../dynamic-field-renderer';
import type { AttributeDefinition } from '../../../api/types';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('DynamicFieldRenderer UI Component Unit Tests', () => {
  it('renders text input and triggers onChange', () => {
    const attr: AttributeDefinition = {
      id: '1',
      entityTypeId: '1',
      name: 'Legal Name',
      systemName: 'legal_name',
      dataType: 'STRING',
      uiComponent: 'text',
      isRequired: true,
      displayOrder: 1,
      version: 1,
    };

    const handleChange = vi.fn();
    render(
      <DynamicFieldRenderer
        attribute={attr}
        value="Acme Corp"
        onChange={handleChange}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Legal Name')).toBeDefined();
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('Acme Corp');

    fireEvent.change(input, { target: { value: 'Acme Corporation' } });
    expect(handleChange).toHaveBeenCalledWith('Acme Corporation');
  });

  it('renders switch toggle and handles boolean change', () => {
    const attr: AttributeDefinition = {
      id: '2',
      entityTypeId: '1',
      name: 'Active Status',
      systemName: 'is_active',
      dataType: 'BOOLEAN',
      uiComponent: 'switch',
      isRequired: false,
      displayOrder: 2,
      version: 1,
    };

    const handleChange = vi.fn();
    render(
      <DynamicFieldRenderer
        attribute={attr}
        value={false}
        onChange={handleChange}
      />,
      { wrapper: createWrapper() }
    );

    const switchBtn = screen.getByRole('switch');
    expect(switchBtn).toBeDefined();
    fireEvent.click(switchBtn);
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('displays structured validation error message and applies error styling', () => {
    const attr: AttributeDefinition = {
      id: '3',
      entityTypeId: '1',
      name: 'Credit Limit',
      systemName: 'credit_limit',
      dataType: 'DECIMAL',
      uiComponent: 'number',
      isRequired: true,
      displayOrder: 3,
      version: 1,
    };

    render(
      <DynamicFieldRenderer
        attribute={attr}
        value=""
        onChange={vi.fn()}
        error="Credit Limit must be a positive number"
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText('Credit Limit must be a positive number')).toBeDefined();
  });

  it('renders Entity Reference combobox with placeholder when value is empty', () => {
    const attr: AttributeDefinition = {
      id: '4',
      entityTypeId: '1',
      name: 'Default Policy',
      systemName: 'default_policy_id',
      dataType: 'RELATIONSHIP',
      uiComponent: 'relation_picker',
      isRequired: false,
      displayOrder: 4,
      version: 1,
      options: { targetEntityTypeId: '3' },
    };

    render(
      <DynamicFieldRenderer
        attribute={attr}
        value=""
        onChange={vi.fn()}
      />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByRole('combobox')).toBeDefined();
    expect(
      screen.getByText(/Select or enter Target Entity Record ID|Search target entity/i)
    ).toBeDefined();
  });

  describe('Phase 16 Pluggable Widget Registry (OCP)', () => {
    it('renders SignaturePadWidget when uiComponent is signature_pad', () => {
      const attr: AttributeDefinition = {
        id: '10',
        entityTypeId: '1',
        name: 'Inspector Signature',
        systemName: 'inspector_sig',
        dataType: 'STRING',
        uiComponent: 'signature_pad',
        isRequired: true,
      };

      render(
        <DynamicFieldRenderer
          attribute={attr}
          value=""
          onChange={vi.fn()}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('signature-pad-container')).toBeDefined();
      expect(screen.getByText('Sign here with cursor or touch')).toBeDefined();
    });

    it('renders GeoLocationWidget when uiComponent is geo_location', () => {
      const attr: AttributeDefinition = {
        id: '11',
        entityTypeId: '1',
        name: 'Warehouse Location',
        systemName: 'warehouse_geo',
        dataType: 'JSON',
        uiComponent: 'geo_location',
        isRequired: true,
      };

      const handleChange = vi.fn();
      render(
        <DynamicFieldRenderer
          attribute={attr}
          value=""
          onChange={handleChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('geo-location-container')).toBeDefined();
      expect(screen.getByText('Reverse Geocoded Address')).toBeDefined();

      const gpsBtn = screen.getByText(/Acquire GPS/i);
      fireEvent.click(gpsBtn);
      expect(handleChange).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 10.7769,
          longitude: 106.7009,
          address: 'Ho Chi Minh City, District 1',
        })
      );
    });

    it('renders BarcodeScannerWidget and simulates scanning code', () => {
      const attr: AttributeDefinition = {
        id: '12',
        entityTypeId: '1',
        name: 'Asset Barcode',
        systemName: 'asset_barcode',
        dataType: 'STRING',
        uiComponent: 'barcode_scanner',
        isRequired: true,
      };

      const handleChange = vi.fn();
      render(
        <DynamicFieldRenderer
          attribute={attr}
          value=""
          onChange={handleChange}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByTestId('barcode-scanner-container')).toBeDefined();

      // Open camera simulation chamber
      const scanBtn = screen.getByText(/Scan Code/i);
      fireEvent.click(scanBtn);

      const simBtn = screen.getByText('Simulate QR Code');
      fireEvent.click(simBtn);

      expect(handleChange).toHaveBeenCalledWith('UNIPOST-QR-DOC-99214');
    });
  });
});
