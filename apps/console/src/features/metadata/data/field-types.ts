import type { DataType, UiComponentType } from '../api/types';
import {
  Type,
  AlignLeft,
  Hash,
  ToggleLeft,
  ListFilter,
  CheckSquare,
  Calendar,
  Code,
  Link2,
  type LucideIcon,
  Barcode,
  LocateIcon,
  Signature,
} from 'lucide-react';

export interface FieldTypeDefinition {
  type: UiComponentType;
  label: string;
  description: string;
  icon: LucideIcon;
  defaultDataType: DataType;
  compatibleDataTypes: DataType[];
  supportsOptions: boolean;
  hasChoices?: boolean;
  hasMinMax?: boolean;
  hasPattern?: boolean;
  hasTargetEntity?: boolean;
}

export const FIELD_TYPE_REGISTRY: Record<UiComponentType, FieldTypeDefinition> = {
  text: {
    type: 'text',
    label: 'Single-line Text',
    description: 'Short textual input such as names, titles, or codes.',
    icon: Type,
    defaultDataType: 'STRING',
    compatibleDataTypes: ['STRING'],
    supportsOptions: true,
    hasPattern: true,
  },
  textarea: {
    type: 'textarea',
    label: 'Multi-line Text',
    description: 'Long-form textual content, documentation, or notes.',
    icon: AlignLeft,
    defaultDataType: 'STRING',
    compatibleDataTypes: ['STRING'],
    supportsOptions: true,
  },
  number: {
    type: 'number',
    label: 'Numeric Value',
    description: 'Integers, floating-point numbers, quantities, or currency.',
    icon: Hash,
    defaultDataType: 'INTEGER',
    compatibleDataTypes: ['INTEGER', 'DECIMAL'],
    supportsOptions: true,
    hasMinMax: true,
  },
  switch: {
    type: 'switch',
    label: 'Boolean Switch',
    description: 'Binary toggle flag representing true or false.',
    icon: ToggleLeft,
    defaultDataType: 'BOOLEAN',
    compatibleDataTypes: ['BOOLEAN'],
    supportsOptions: false,
  },
  select: {
    type: 'select',
    label: 'Single Select',
    description: 'Dropdown selector choosing one option from defined list.',
    icon: ListFilter,
    defaultDataType: 'STRING',
    compatibleDataTypes: ['STRING', 'INTEGER'],
    supportsOptions: true,
    hasChoices: true,
  },
  multiselect: {
    type: 'multiselect',
    label: 'Multi Select',
    description: 'Tag or multi-badge selector choosing multiple options.',
    icon: CheckSquare,
    defaultDataType: 'JSON',
    compatibleDataTypes: ['JSON', 'STRING'],
    supportsOptions: true,
    hasChoices: true,
  },
  datepicker: {
    type: 'datepicker',
    label: 'Date & Time Picker',
    description: 'Calendar date or timestamp value formatted in ISO 8601.',
    icon: Calendar,
    defaultDataType: 'DATE',
    compatibleDataTypes: ['DATE', 'DATETIME'],
    supportsOptions: false,
  },
  json_editor: {
    type: 'json_editor',
    label: 'JSON / Raw Object',
    description: 'Arbitrary structured JSON dictionary or nested array.',
    icon: Code,
    defaultDataType: 'JSON',
    compatibleDataTypes: ['JSON'],
    supportsOptions: false,
  },
  relation_picker: {
    type: 'relation_picker',
    label: 'Entity Reference',
    description: 'Foreign reference field pointing to a target entity record.',
    icon: Link2,
    defaultDataType: 'RELATIONSHIP',
    compatibleDataTypes: ['RELATIONSHIP', 'STRING', 'INTEGER'],
    supportsOptions: true,
    hasTargetEntity: true,
  },
  barcode_scanner: {
    type: 'barcode_scanner',
    label: 'Barcode Scanner',
    description: 'Patterns of bars, spaces, or 2D codes',
    icon: Barcode,
    defaultDataType: 'STRING',
    compatibleDataTypes: ['STRING'],
    supportsOptions: false,
  },
  geo_location: {
    type: 'geo_location',
    label: 'Geo Location',
    description: 'Geo location input field.',
    icon: LocateIcon,
    defaultDataType: 'STRING',
    compatibleDataTypes: ['STRING'],
    supportsOptions: false,
  },
  signature_pad: {
    type: 'signature_pad',
    label: 'Signature Pad',
    description: 'Signature pad input field.',
    icon: Signature,
    defaultDataType: 'STRING',
    compatibleDataTypes: ['STRING'],
    supportsOptions: false,
  },

};

export const FIELD_TYPE_LIST = Object.values(FIELD_TYPE_REGISTRY);
