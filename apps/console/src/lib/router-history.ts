import {
  createBrowserHistory,
  createHashHistory,
  createMemoryHistory,
  type RouterHistory,
} from '@tanstack/react-router'

export type RouterMode = 'browser' | 'hash' | 'memory' | 'auto'

export function isDesktopEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  return (
    Boolean(import.meta.env.ELECTRON) ||
    Boolean(window.electron) ||
    window.location.protocol === 'file:'
  )
}

/**
 * Returns the appropriate TanStack Router history strategy based on environment
 * and optional VITE_ROUTER_MODE / VITE_DESKTOP_ROUTER_MODE configuration flags.
 *
 * Defaults:
 * - Web Browser: URL-based Browser History (createBrowserHistory)
 * - Desktop (Electron): URL-based Hash History (createHashHistory) or Browser History
 * - Overrides: Configurable via VITE_ROUTER_MODE=('browser' | 'hash' | 'memory')
 */
export function getRouterHistory(): RouterHistory {
  const explicitMode = import.meta.env.VITE_ROUTER_MODE as RouterMode | undefined

  if (explicitMode && explicitMode !== 'auto') {
    switch (explicitMode) {
      case 'hash':
        return createHashHistory()
      case 'memory':
        return createMemoryHistory({ initialEntries: ['/'] })
      case 'browser':
      default:
        return createBrowserHistory()
    }
  }

  // Auto-detect based on environment
  const isDesktop = isDesktopEnvironment()
  if (isDesktop) {
    const desktopMode = import.meta.env.VITE_DESKTOP_ROUTER_MODE as RouterMode | undefined
    if (desktopMode === 'browser') {
      return createBrowserHistory()
    }
    if (desktopMode === 'memory') {
      return createMemoryHistory({ initialEntries: ['/'] })
    }
    // Default desktop router mode: URL-based Hash history for compatibility with file:// and local protocols
    return createHashHistory()
  }

  // Default web router mode: URL-based HTML5 Browser history
  return createBrowserHistory()
}
