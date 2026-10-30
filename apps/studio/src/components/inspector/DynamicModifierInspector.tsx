import React from 'react';
import {
  ModifierPluginRegistry,
  registerCoreModifierPlugins,
  type ParamFieldDescriptor,
} from '@acc/ir';
import { resolveParamControlStrategy } from './ModifierControlStrategies';
import { StudioColorGradingInspector } from './StudioColorGradingInspector';

export interface DynamicModifierInspectorProps {
  modifierType: string;
  params: Record<string, unknown>;
  onChange: (nextParams: Record<string, unknown>) => void;
  disabled?: boolean;
}

function ensureRegistryPopulated(registry: ModifierPluginRegistry): ModifierPluginRegistry {
  if (registry.listTypes().length === 0) {
    registerCoreModifierPlugins(registry);
  }
  return registry;
}

/**
 * DynamicModifierInspector:
 * Schema-driven parameter inspector engine powered by ModifierPluginRegistry.
 *
 * Adheres to Open-Closed Principle (OCP) & Strategy Pattern:
 * 1. Queries ModifierPluginRegistry.getInstance().getSchema(modifierType) for declarative field metadata.
 * 2. Resolves each ParamFieldDescriptor to its corresponding UI Control Strategy (Number, Switch, Select, Color, RegionsArray, String).
 * 3. Falls back to automatic reflective type inference for third-party / custom plugins without explicit schema definitions.
 */
export const DynamicModifierInspector: React.FC<DynamicModifierInspectorProps> = ({
  modifierType,
  params = {},
  onChange,
  disabled = false,
}) => {
  const registry = ensureRegistryPopulated(ModifierPluginRegistry.getInstance());
  const schema = registry.getSchema(modifierType);

  // Dedicated Studio-Grade Color Grading & Correction Inspector
  if (modifierType === 'vfx/color_grading') {
    return (
      <StudioColorGradingInspector
        params={params}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }

  const handleFieldChange = (key: string, newVal: unknown) => {
    if (disabled) return;
    onChange({
      ...params,
      [key]: newVal,
    });
  };

  if (schema && schema.fields && Object.keys(schema.fields).length > 0) {
    const schemaEntries = Object.entries(schema.fields).filter(([, descriptor]) => {
      if (typeof descriptor.visibleIf === 'function') {
        return descriptor.visibleIf(params);
      }
      return true;
    });
    const extraRuntimeEntries = Object.entries(params).filter(
      ([k]) => k !== 'enabled' && !(k in schema.fields)
    );

    return (
      <div className={`space-y-2.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        {schemaEntries.map(([fieldKey, descriptor]) => {
          const ControlComponent = resolveParamControlStrategy(descriptor);
          const currentValue =
            descriptor.type === 'sfx_actions'
              ? params
              : params[fieldKey] !== undefined
              ? params[fieldKey]
              : descriptor.defaultValue;

          return (
            <ControlComponent
              key={fieldKey}
              descriptor={descriptor}
              value={currentValue}
              disabled={disabled}
              onChange={(val) => handleFieldChange(fieldKey, val)}
            />
          );
        })}
        {extraRuntimeEntries.map(([key, val]) => {
          const inferredDescriptor = inferFieldDescriptor(key, val);
          const ControlComponent = resolveParamControlStrategy(inferredDescriptor);

          return (
            <ControlComponent
              key={key}
              descriptor={inferredDescriptor}
              value={val}
              disabled={disabled}
              onChange={(newVal) => handleFieldChange(key, newVal)}
            />
          );
        })}
      </div>
    );
  }

  // Reflective Fallback for custom / third-party modifiers without explicit schema
  const paramEntries = Object.entries(params).filter(([k]) => k !== 'enabled');

  if (paramEntries.length === 0) {
    return (
      <p className="text-[10px] text-muted-foreground italic">
        No configurable parameters exposed for {modifierType}.
      </p>
    );
  }

  return (
    <div className={`space-y-2.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {paramEntries.map(([key, val]) => {
        const inferredDescriptor: ParamFieldDescriptor = inferFieldDescriptor(key, val);
        const ControlComponent = resolveParamControlStrategy(inferredDescriptor);

        return (
          <ControlComponent
            key={key}
            descriptor={inferredDescriptor}
            value={val}
            disabled={disabled}
            onChange={(newVal) => handleFieldChange(key, newVal)}
          />
        );
      })}
    </div>
  );
};

/**
 * Resolves either the registered ModifierParameterSchema fields (plus any extra runtime keys)
 * or reflectively infers field descriptors for unknown/third-party plugins.
 */
export function resolveModifierSchemaOrInfer(
  modifierType: string,
  params: Record<string, unknown>,
  registry: ModifierPluginRegistry = ModifierPluginRegistry.getInstance()
): {
  isInferred: boolean;
  displayName: string;
  fields: ParamFieldDescriptor[];
} {
  ensureRegistryPopulated(registry);
  const schema = registry.getSchema(modifierType);
  const rawName = modifierType.split('/').pop() || modifierType;
  const displayName = rawName
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  if (schema && schema.fields && Object.keys(schema.fields).length > 0) {
    const fields: ParamFieldDescriptor[] = Object.values(schema.fields);
    for (const [k, v] of Object.entries(params)) {
      if (k !== 'enabled' && !(k in schema.fields)) {
        fields.push(inferFieldDescriptor(k, v));
      }
    }
    return {
      isInferred: false,
      displayName,
      fields,
    };
  }

  const inferredFields: ParamFieldDescriptor[] = Object.entries(params)
    .filter(([k]) => k !== 'enabled')
    .map(([k, v]) => inferFieldDescriptor(k, v));

  return {
    isInferred: true,
    displayName,
    fields: inferredFields,
  };
}

/**
 * Infers a ParamFieldDescriptor from a raw key/value pair when no schema is registered.
 */
export function inferFieldDescriptor(key: string, val: unknown): ParamFieldDescriptor {
  const label = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());

  if (key === 'regions' && Array.isArray(val)) {
    return {
      key,
      label: 'Localized Regions',
      type: 'regions_array',
    };
  }

  if (
    key === 'animation' ||
    (typeof val === 'object' && val !== null && !Array.isArray(val) && ('preset' in val || 'intro' in val || 'outro' in val))
  ) {
    return {
      key,
      label: 'Motion Lifecycle Animation',
      type: 'motion_lifecycle',
      defaultValue: val as Record<string, unknown>,
    };
  }

  if (typeof val === 'boolean') {
    return {
      key,
      label,
      type: 'boolean',
      defaultValue: val,
    };
  }

  if (typeof val === 'number') {
    const isNormalized = val >= -1 && val <= 1 && !Number.isInteger(val);
    return {
      key,
      label,
      type: 'number',
      min: val < 0 ? (isNormalized ? -1 : -100) : 0,
      max: isNormalized ? 1 : val > 100 ? val * 2 : 100,
      step: isNormalized ? 0.05 : Number.isInteger(val) ? 1 : 0.1,
      defaultValue: val,
    };
  }

  if (typeof val === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(val)) {
    return {
      key,
      label,
      type: 'color',
      defaultValue: val,
    };
  }

  return {
    key,
    label,
    type: 'string',
    defaultValue: String(val ?? ''),
  };
}
