import type React from 'react';
import { StudioColorGradingInspector } from './StudioColorGradingInspector';

export interface CustomModifierInspectorProps {
  params: Record<string, unknown>;
  onChange: (nextParams: Record<string, unknown>) => void;
  disabled?: boolean;
}

export type CustomModifierInspectorComponent = React.ComponentType<CustomModifierInspectorProps>;

const customModifierInspectors = new Map<string, CustomModifierInspectorComponent>();

/**
 * Registers a specialized custom UI inspector for a given modifier type.
 * Allows rich studio-grade UIs (e.g., 3-way color wheels, audio graphs) to seamlessly
 * override generic schema-based control strategies.
 */
export function registerCustomModifierInspector(
  modifierType: string,
  component: CustomModifierInspectorComponent
): void {
  customModifierInspectors.set(modifierType, component);
}

/**
 * Retrieves the custom inspector for a modifier type, if registered.
 */
export function getCustomModifierInspector(
  modifierType: string
): CustomModifierInspectorComponent | undefined {
  return customModifierInspectors.get(modifierType);
}

/**
 * Checks whether a modifier type has a specialized inspector registered.
 */
export function hasCustomModifierInspector(modifierType: string): boolean {
  return customModifierInspectors.has(modifierType);
}

// Built-in studio inspector registrations
registerCustomModifierInspector('vfx/color_grading', StudioColorGradingInspector);
