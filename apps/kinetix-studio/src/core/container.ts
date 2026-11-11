// ============================================================================
// KINETIX STUDIO - DEPENDENCY INVERSION CONTAINER (ECMA-429)
// Zero-external-dependency, strongly-typed factory container conforming to
// enterprise clean architecture and WinterTC web standards.
// ============================================================================

import type { IRenderTargetPort } from './ports/driven/render-target.port';
import type { IDownloadTransportPort } from './ports/driven/download-transport.port';
import { Canvas2dRenderTargetAdapter } from '@/adapters/driven/canvas2d/canvas2d-target.adapter';
import { BrowserDownloadTransportAdapter } from '@/adapters/driven/download/browser-download.adapter';

export interface StudioContainer {
  createRenderTarget: (width: number, height: number) => IRenderTargetPort;
  downloadTransport: IDownloadTransportPort;
}

let activeContainer: StudioContainer | null = null;

export function createProductionContainer(): StudioContainer {
  return {
    createRenderTarget: (w: number, h: number) => new Canvas2dRenderTargetAdapter(w, h),
    downloadTransport: new BrowserDownloadTransportAdapter(),
  };
}

export function getContainer(): StudioContainer {
  if (!activeContainer) {
    activeContainer = createProductionContainer();
  }
  return activeContainer;
}

export function setContainerOverride(customContainer: Partial<StudioContainer> | null): void {
  if (customContainer === null) {
    activeContainer = null;
    return;
  }
  const base = activeContainer ?? createProductionContainer();
  activeContainer = {
    ...base,
    ...customContainer,
  };
}
