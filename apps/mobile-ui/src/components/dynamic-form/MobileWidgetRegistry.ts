import type { AttributeDefinition } from '@acc/client';

export interface MobileWidgetProps<T = any> {
  attribute: AttributeDefinition;
  value: T;
  onChange: (value: T) => void;
  error?: string;
  disabled?: boolean;
}

export type MobileWidgetComponent = React.ComponentType<MobileWidgetProps<any>>;

/**
 * Mobile-Specific Open/Closed Dynamic Widget Registry.
 * Allows pluggable React Native widgets (e.g. Signature, GeoLocation, Barcode)
 * to be dynamically loaded without modifying DynamicFieldRenderer.
 */
export class MobileWidgetRegistry {
  private static widgets = new Map<string, MobileWidgetComponent>();

  static register(uiComponent: string, component: MobileWidgetComponent): void {
    MobileWidgetRegistry.widgets.set(uiComponent.toLowerCase(), component);
  }

  static get(uiComponent: string | undefined): MobileWidgetComponent | undefined {
    if (!uiComponent) return undefined;
    return MobileWidgetRegistry.widgets.get(uiComponent.toLowerCase());
  }

  static has(uiComponent: string | undefined): boolean {
    if (!uiComponent) return false;
    return MobileWidgetRegistry.widgets.has(uiComponent.toLowerCase());
  }

  static clear(): void {
    MobileWidgetRegistry.widgets.clear();
  }
}
