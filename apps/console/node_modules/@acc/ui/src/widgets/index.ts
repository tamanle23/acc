import { WidgetRegistry } from './widget-registry';
import { SignaturePadWidget } from './signature-pad-widget';
import { GeoLocationWidget } from './geo-location-widget';
import { BarcodeScannerWidget } from './barcode-scanner-widget';

export * from './widget-registry';
export * from './signature-pad-widget';
export * from './geo-location-widget';
export * from './barcode-scanner-widget';

/**
 * Register standard built-in dynamic widgets into the central WidgetRegistry.
 */
export function registerStandardWidgets(): void {
  WidgetRegistry.register('signature_pad', SignaturePadWidget);
  WidgetRegistry.register('signature', SignaturePadWidget);

  WidgetRegistry.register('geo_location', GeoLocationWidget);
  WidgetRegistry.register('geolocation', GeoLocationWidget);
  WidgetRegistry.register('map', GeoLocationWidget);

  WidgetRegistry.register('barcode_scanner', BarcodeScannerWidget);
  WidgetRegistry.register('barcode', BarcodeScannerWidget);
  WidgetRegistry.register('qr_code', BarcodeScannerWidget);
}
