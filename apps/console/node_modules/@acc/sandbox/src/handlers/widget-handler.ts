import type { SandboxRouteHandler } from '../types';

/**
 * Phase 16: Pluggable Widgets Simulation Handler.
 * Intercepts optical scanning, signature rendering validation, and geocoding queries
 * so browser and mobile integration suites execute seamlessly without physical sensors.
 */
export const widgetSandboxHandler: SandboxRouteHandler = {
  id: 'widgets-sandbox-handler',
  name: 'Pluggable Dynamic Widgets Simulation Handler',
  priority: 25,
  matcher: (ctx) => ctx.pathname.startsWith('/api/v1/widgets/'),
  handler: (req, context) => {
    const { pathname } = context;
    const method = req.method.toUpperCase();

    // 1. Barcode / QR Code Lookup Simulation
    if (pathname.startsWith('/api/v1/widgets/barcode/lookup') && method === 'GET') {
      const code = req.url.includes('code=')
        ? decodeURIComponent(req.url.split('code=')[1].split('&')[0])
        : 'UNKNOWN';

      return {
        status: 200,
        data: {
          code,
          format: code.startsWith('VN-EAN13') ? 'EAN_13' : 'QR_CODE',
          valid: true,
          product: {
            title: 'Acc Verified Enterprise Package',
            sku: 'SKU-' + code.slice(-6),
            category: 'Logistics Documentation',
          },
        },
      };
    }

    // 2. Reverse Geocoding Simulation
    if (pathname.startsWith('/api/v1/widgets/geocode/reverse') && method === 'GET') {
      return {
        status: 200,
        data: {
          formattedAddress: 'Ho Chi Minh City, District 1, Vietnam',
          city: 'Ho Chi Minh City',
          country: 'Vietnam',
          coordinates: {
            latitude: 10.7769,
            longitude: 106.7009,
          },
        },
      };
    }

    // 3. Digital Signature Verification Simulation
    if (pathname.startsWith('/api/v1/widgets/signature/verify') && method === 'POST') {
      const body = req.data as { signatureData?: string } | undefined;
      const isValid = Boolean(body?.signatureData && body.signatureData.length > 50);

      return {
        status: 200,
        data: {
          verified: isValid,
          algorithm: 'SHA256withECDSA',
          fingerprint: 'fp_sim_sig_8829104',
          timestamp: new Date().toISOString(),
        },
      };
    }

    return {
      status: 404,
      data: { error: 'Unknown widget route in sandbox' },
    };
  },
};
