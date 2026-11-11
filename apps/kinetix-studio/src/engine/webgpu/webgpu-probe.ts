// ============================================================================
// KINETIX STUDIO v6.0 - WEBGPU HARDWARE CAPABILITY PROBE (ECMA-429)
// Non-throwing capability probe detecting WebGPU, WebGL2, or fail-safe Canvas2D.
// ============================================================================

import type { RenderBackendCapabilities } from '@/core/ports/driven/render-backend.port';

const FALLBACK_CANVAS2D: RenderBackendCapabilities = {
  backend: 'canvas2d',
  maxTextureSize: 4096,
  computeShadersSupported: false,
  floatTexturesSupported: false,
  pbrShadingSupported: false,
  vendorName: 'Software Canvas2D',
  rendererName: 'CPU Analytical Rasterizer',
};

/**
 * Safely probes browser hardware capabilities for WebGPU, WebGL2, or Canvas2D.
 * Conforms to WinterTC / ECMA-429 and never throws.
 */
export async function probeRenderBackendCapabilities(): Promise<RenderBackendCapabilities> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return FALLBACK_CANVAS2D;
  }

  // 1. Probe Modern WebGPU API
  try {
    const nav = navigator as unknown as { gpu?: { requestAdapter: () => Promise<any> } };
    if (nav?.gpu && typeof nav.gpu.requestAdapter === 'function') {
      const adapter = await nav.gpu.requestAdapter();
      if (adapter) {
        const limits = adapter.limits || {};
        return {
          backend: 'webgpu',
          maxTextureSize: limits.maxTextureDimension2D ?? 8192,
          computeShadersSupported: true,
          floatTexturesSupported: true,
          pbrShadingSupported: true,
          vendorName: 'WebGPU Device Adapter',
          rendererName: 'Next-Gen Compute Pipeline',
        };
      }
    }
  } catch {
    // Continue to WebGL2 fallback
  }

  // 2. Probe Universal WebGL2 Hardware Fragment Pipeline
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    if (gl) {
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const vendorName = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : 'WebGL2 Vendor';
      const rendererName = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'Hardware Rasterizer';

      return {
        backend: 'webgl2',
        maxTextureSize,
        computeShadersSupported: false,
        floatTexturesSupported: true,
        pbrShadingSupported: true,
        vendorName: String(vendorName),
        rendererName: String(rendererName),
      };
    }
  } catch {
    // Fall back to Canvas2D
  }

  return FALLBACK_CANVAS2D;
}
