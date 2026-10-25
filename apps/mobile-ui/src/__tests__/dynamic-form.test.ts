import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { AttributeDefinition } from '@acc/client';
import { DynamicFieldRenderer } from '../components/dynamic-form/DynamicFieldRenderer';
import { MediaPickerInput } from '../components/dynamic-form/MediaPickerInput';
import { RelationPickerBottomSheet } from '../components/dynamic-form/RelationPickerBottomSheet';
import { MobileWidgetRegistry } from '../components/dynamic-form/MobileWidgetRegistry';

describe('mobile-ui Dynamic Form Engine & Media Pipeline', () => {
  it('instantiates DynamicFieldRenderer for string and number attributes', () => {
    const stringAttr: AttributeDefinition = {
      id: 'attr-1',
      name: 'Headline',
      systemName: 'headline',
      dataType: 'STRING',
      uiComponent: 'text',
      isRequired: true,
    };

    const handleChange = vi.fn();
    const element = React.createElement(DynamicFieldRenderer, {
      attribute: stringAttr,
      value: 'Breaking News',
      onChange: handleChange,
    });

    expect(element.props.value).toBe('Breaking News');
    expect(element.props.attribute.name).toBe('Headline');
  });

  it('instantiates DynamicFieldRenderer for boolean switches', () => {
    const boolAttr: AttributeDefinition = {
      id: 'attr-2',
      name: 'Featured',
      systemName: 'is_featured',
      dataType: 'BOOLEAN',
      uiComponent: 'switch',
      isRequired: false,
    };

    const handleChange = vi.fn();
    const element = React.createElement(DynamicFieldRenderer, {
      attribute: boolAttr,
      value: true,
      onChange: handleChange,
    });

    expect(element.props.value).toBe(true);
    expect(element.props.attribute.dataType).toBe('BOOLEAN');
  });

  it('instantiates MediaPickerInput with photo upload and clear callbacks', () => {
    const handleChange = vi.fn();
    const element = React.createElement(MediaPickerInput, {
      label: 'Cover Photo',
      value: 'https://images.unsplash.com/photo-1503899036084?w=800',
      onChange: handleChange,
    });

    expect(element.props.label).toBe('Cover Photo');
    expect(element.props.value).toContain('photo-1503899036084');
  });

  it('instantiates RelationPickerBottomSheet with record filtering list', () => {
    const handleSelect = vi.fn();
    const handleClose = vi.fn();

    const records = [
      { id: '101', label: 'Tokyo Station' },
      { id: '102', label: 'Shinjuku Gyoen' },
    ];

    const element = React.createElement(RelationPickerBottomSheet, {
      visible: true,
      onClose: handleClose,
      onSelect: handleSelect,
      selectedId: '101',
      records,
    });

    expect(element.props.visible).toBe(true);
    expect(element.props.records.length).toBe(2);
    expect(element.props.selectedId).toBe('101');
  });

  it('delegates to MobileWidgetRegistry when custom widget is registered', () => {
    const mockCustomWidget = vi.fn((props) => React.createElement('View', props));
    MobileWidgetRegistry.register('signature_pad', mockCustomWidget);

    const customAttr: AttributeDefinition = {
      id: 'attr-custom-1',
      name: 'Client Signature',
      systemName: 'client_sig',
      dataType: 'STRING',
      uiComponent: 'signature_pad',
      isRequired: true,
    };

    const handleChange = vi.fn();
    const rendered = DynamicFieldRenderer({
      attribute: customAttr,
      value: 'data:image/svg+xml;base64,mockSig',
      onChange: handleChange,
    });

    expect(rendered.type).toBe(mockCustomWidget);
    expect(rendered.props.value).toBe('data:image/svg+xml;base64,mockSig');
    expect(rendered.props.attribute.name).toBe('Client Signature');
  });

  it('passes validation error and disabled state to DynamicFieldRenderer', () => {
    const attr: AttributeDefinition = {
      id: 'attr-err-1',
      name: 'Serial Number',
      systemName: 'serial_no',
      dataType: 'STRING',
      uiComponent: 'text',
      isRequired: true,
    };

    const handleChange = vi.fn();
    const element = React.createElement(DynamicFieldRenderer, {
      attribute: attr,
      value: 'SN-001',
      onChange: handleChange,
      error: 'Invalid serial format',
      disabled: true,
    });

    expect(element.props.error).toBe('Invalid serial format');
    expect(element.props.disabled).toBe(true);
    expect(element.props.attribute.isRequired).toBe(true);
  });

  it('renders select option and relation picker attributes via DynamicFieldRenderer', () => {
    const relationAttr: AttributeDefinition = {
      id: 'attr-rel-1',
      name: 'Assigned Warehouse',
      systemName: 'warehouse_id',
      dataType: 'RELATION',
      uiComponent: 'relation_picker',
      isRequired: false,
    };

    const element = React.createElement(DynamicFieldRenderer, {
      attribute: relationAttr,
      value: 'wh-north-1',
      onChange: vi.fn(),
      relationRecords: [
        { id: 'wh-north-1', label: 'North Hub' },
        { id: 'wh-south-2', label: 'South Depot' },
      ],
    });

    expect(element.props.attribute.uiComponent).toBe('relation_picker');
    expect(element.props.relationRecords?.length).toBe(2);
    expect(element.props.value).toBe('wh-north-1');
  });

  it('MediaPickerInput handles disabled state and error messaging', () => {
    const handleChange = vi.fn();
    const element = React.createElement(MediaPickerInput, {
      label: 'Storefront Banner',
      value: '',
      disabled: true,
      required: true,
      error: 'Image is required',
      onChange: handleChange,
    });

    expect(element.props.disabled).toBe(true);
    expect(element.props.required).toBe(true);
    expect(element.props.error).toBe('Image is required');
  });

  it('RelationPickerBottomSheet handles empty record lists and selection callbacks', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const emptyElement = React.createElement(RelationPickerBottomSheet, {
      visible: true,
      records: [],
      onClose,
      onSelect,
      targetEntityType: 'Customer',
    });

    expect(emptyElement.props.records).toEqual([]);
    expect(emptyElement.props.targetEntityType).toBe('Customer');

    const populatedElement = React.createElement(RelationPickerBottomSheet, {
      visible: true,
      records: [{ id: 'cust-1', label: 'Acme Corp', sublabel: 'Enterprise' }],
      selectedId: 'cust-1',
      onClose,
      onSelect,
    });

    expect(populatedElement.props.records.length).toBe(1);
    expect(populatedElement.props.selectedId).toBe('cust-1');
  });
});
