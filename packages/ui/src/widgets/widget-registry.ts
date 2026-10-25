import React from 'react';
import type { AttributeDefinition } from '@acc/client';

export interface DynamicWidgetProps<T = unknown> {
  value: T;
  onChange: (value: T) => void;
  attribute: AttributeDefinition;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
  errorClass?: string;
  placeholder?: string;
}

export type WidgetComponent = React.ComponentType<DynamicWidgetProps<any>>;

/**
 * Open/Closed Dynamic Widget Registry (OCP).
 * Allows client applications, plugins, and custom verticals to register
 * custom input components without modifying dynamic form renderers.
 */
export class WidgetRegistry {
  private static widgets = new Map<string, WidgetComponent>();

  /**
   * Register a custom widget for a given uiComponent type.
   */
  static register(uiComponent: string, component: WidgetComponent): void {
    WidgetRegistry.widgets.set(uiComponent.toLowerCase(), component);
  }

  /**
   * Retrieve a registered widget component.
   */
  static get(uiComponent: string | undefined): WidgetComponent | undefined {
    if (!uiComponent) return undefined;
    return WidgetRegistry.widgets.get(uiComponent.toLowerCase());
  }

  /**
   * Check if a widget is registered for a given uiComponent type.
   */
  static has(uiComponent: string | undefined): boolean {
    if (!uiComponent) return false;
    return WidgetRegistry.widgets.has(uiComponent.toLowerCase());
  }

  /**
   * Remove a registered widget (primarily for test cleanup).
   */
  static unregister(uiComponent: string): void {
    WidgetRegistry.widgets.delete(uiComponent.toLowerCase());
  }

  /**
   * Reset the registry (clears all registered custom widgets).
   */
  static clear(): void {
    WidgetRegistry.widgets.clear();
  }

  /**
   * List all registered uiComponent types.
   */
  static list(): string[] {
    return Array.from(WidgetRegistry.widgets.keys());
  }
}
