# History Log 054: Pluggable Dynamic Widget Registry & Custom Input Extensibility (Phase 16)

## Problem
In Iteration 1, dynamic forms in `@unipost/console` and `mobile-ui` rendered fields using monolithic hardcoded switch/conditional statements. Introducing custom vertical widgets (such as digital signature pads, GPS coordinates, or optical barcode readers) required modifying internal component renderers, violating the Open/Closed Principle (OCP) and blocking external domain customization.

## Plan
1. **Core Extensibility Architecture (`packages/ui`)**:
   - Create `WidgetRegistry` supporting runtime registration (`register`, `get`, `has`, `unregister`, `clear`, `list`).
   - Implement built-in custom widgets:
     - `SignaturePadWidget`: Canvas vector stroke capture outputting base64 image data URL with clear and redraw capabilities.
     - `GeoLocationWidget`: Spatial coordinates picker (`latitude`, `longitude`, `address`, `zoom`) with simulated GPS acquisition.
     - `BarcodeScannerWidget`: 1D/2D optical code scanner supporting EAN-13, QR codes, and Code-128 with test simulation mode.
   - Provide `registerStandardWidgets()` auto-registering standard aliases (`signature_pad`, `geo_location`, `barcode_scanner`).
2. **Client Schema Extensions (`packages/client`)**:
   - Extend `UiComponentType` in `types.ts` with `'signature_pad'`, `'geo_location'`, `'barcode_scanner'`, and string literal extension `(string & {})`.
3. **Mobile Extensibility Architecture (`apps/mobile-ui`)**:
   - Implement `MobileWidgetRegistry` for React Native dynamic widgets.
   - Wire `MobileWidgetRegistry.get(uiComponent)` into `DynamicFieldRenderer.tsx` before local hooks.
4. **Console Integration (`apps/console`)**:
   - Register standard widgets and delegate to `WidgetRegistry.get(uiComponent)` in `DynamicFieldRenderer.tsx`.
5. **Unified Sandbox Simulation (`packages/sandbox` & `apps/console`)**:
   - Create `widgetSandboxHandler` intercepting `/api/v1/widgets/barcode/lookup`, `/api/v1/widgets/geocode/reverse`, and `/api/v1/widgets/signature/verify`.
   - Register `widgetSandboxHandler` in `apps/console/src/core/sandbox/index.ts`.
6. **Testing & Verification**:
   - Unit tests in `dynamic-field-renderer.test.tsx` verifying SignaturePad, GeoLocation, and BarcodeScanner widgets.
   - Unit tests in `mobile-ui/src/__tests__/dynamic-form.test.ts` verifying `MobileWidgetRegistry` delegation.
   - Execute full verification: `pnpm turbo run check-types`, `pnpm turbo run test`, and `pnpm --filter @unipost/console test:e2e`.

## Changes
- **`packages/ui/src/widgets/widget-registry.ts`**: Created core `WidgetRegistry` class.
- **`packages/ui/src/widgets/signature-pad-widget.tsx`**: Implemented HTML5 canvas digital signature widget.
- **`packages/ui/src/widgets/geo-location-widget.tsx`**: Implemented geographic coordinate & reverse geocode widget.
- **`packages/ui/src/widgets/barcode-scanner-widget.tsx`**: Implemented optical barcode/QR code reader widget.
- **`packages/ui/src/widgets/index.ts`**: Exported widgets and `registerStandardWidgets()`.
- **`packages/ui/src/index.ts`**: Re-exported `widgets`.
- **`packages/client/src/types.ts`**: Extended `UiComponentType`.
- **`apps/console/src/features/metadata/components/dynamic-fields/dynamic-field-renderer.tsx`**: Wired `WidgetRegistry`.
- **`apps/mobile-ui/src/components/dynamic-form/MobileWidgetRegistry.ts`**: Created mobile widget registry.
- **`apps/mobile-ui/src/components/dynamic-form/DynamicFieldRenderer.tsx`**: Wired mobile widget delegation.
- **`packages/sandbox/src/handlers/widget-handler.ts`**: Created `widgetSandboxHandler`.
- **`apps/console/src/core/sandbox/index.ts`**: Registered `widgetSandboxHandler`.

## Verification
- `pnpm turbo run check-types`: **4/4 passed** (0 errors).
- `pnpm turbo run test`: **6/6 passed** (158 console tests, 14 mobile tests, all green).
- `pnpm --filter @unipost/console test:e2e`: **3/3 passed** (Chromium headless with Axe WCAG 2.2 AA audit).
