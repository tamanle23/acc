import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { AttributeDefinition } from '@unipost/client';
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
});
