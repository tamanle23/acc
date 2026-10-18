import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

export type Theme = 'dark' | 'light' | 'acrylic' | 'obsidian' | 'system'
export type ResolvedTheme = Exclude<Theme, 'system'>
export type AccentColor = 'violet' | 'azure' | 'emerald' | 'rose' | 'amber'

const DEFAULT_THEME: Theme = 'system'
const THEME_COOKIE_NAME = 'vite-ui-theme'
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

export const DEFAULT_GLASS_INTENSITY = 20
const GLASS_INTENSITY_COOKIE_NAME = 'vite-ui-glass-intensity'

export type WallpaperStyle = 'liquid' | 'mesh' | 'none'
export const DEFAULT_WALLPAPER: WallpaperStyle = 'liquid'
const WALLPAPER_COOKIE_NAME = 'vite-ui-wallpaper'

export const DEFAULT_ACCENT_COLOR: AccentColor = 'violet'
const ACCENT_COLOR_COOKIE_NAME = 'vite-ui-accent'

const GLASS_FALLBACK_COOKIE_NAME = 'vite-ui-glass-fallback'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  defaultGlassIntensity?: number
  defaultWallpaper?: WallpaperStyle
  defaultAccentColor?: AccentColor
  defaultGlassFallback?: boolean
  storageKey?: string
}

type ThemeProviderState = {
  defaultTheme: Theme
  resolvedTheme: ResolvedTheme
  theme: Theme
  glassIntensity: number
  wallpaper: WallpaperStyle
  accentColor: AccentColor
  glassFallback: boolean
  setTheme: (theme: Theme) => void
  setGlassIntensity: (intensity: number) => void
  previewGlassIntensity: (intensity: number) => void
  setWallpaper: (wallpaper: WallpaperStyle) => void
  setAccentColor: (accent: AccentColor) => void
  setGlassFallback: (fallback: boolean) => void
  resetTheme: () => void
}

const initialState: ThemeProviderState = {
  defaultTheme: DEFAULT_THEME,
  resolvedTheme: 'light',
  theme: DEFAULT_THEME,
  glassIntensity: DEFAULT_GLASS_INTENSITY,
  wallpaper: DEFAULT_WALLPAPER,
  accentColor: DEFAULT_ACCENT_COLOR,
  glassFallback: false,
  setTheme: () => null,
  setGlassIntensity: () => null,
  previewGlassIntensity: () => null,
  setWallpaper: () => null,
  setAccentColor: () => null,
  setGlassFallback: () => null,
  resetTheme: () => null,
}

const ThemeContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  defaultGlassIntensity = DEFAULT_GLASS_INTENSITY,
  defaultWallpaper = DEFAULT_WALLPAPER,
  defaultAccentColor = DEFAULT_ACCENT_COLOR,
  defaultGlassFallback = false,
  storageKey = THEME_COOKIE_NAME,
  ...props
}: ThemeProviderProps) {
  const [theme, _setTheme] = useState<Theme>(
    () => (getCookie(storageKey) as Theme) || defaultTheme
  )
  const [glassIntensity, _setGlassIntensity] = useState<number>(() => {
    const saved = getCookie(GLASS_INTENSITY_COOKIE_NAME)
    return saved !== undefined && saved !== ''
      ? Math.max(0, Math.min(100, Number(saved)))
      : defaultGlassIntensity
  })
  const [wallpaper, _setWallpaper] = useState<WallpaperStyle>(() => {
    const saved = getCookie(WALLPAPER_COOKIE_NAME)
    return (saved as WallpaperStyle) || defaultWallpaper
  })
  const [accentColor, _setAccentColor] = useState<AccentColor>(() => {
    const saved = getCookie(ACCENT_COLOR_COOKIE_NAME)
    return (saved as AccentColor) || defaultAccentColor
  })
  const [glassFallback, _setGlassFallback] = useState<boolean>(() => {
    const saved = getCookie(GLASS_FALLBACK_COOKIE_NAME)
    return saved !== undefined ? saved === 'true' : defaultGlassFallback
  })

  // Optimized: Memoize the resolved theme calculation to prevent unnecessary re-computations
  const resolvedTheme = useMemo((): ResolvedTheme => {
    if (theme === 'system') {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
      }
      return 'light'
    }
    return theme as ResolvedTheme
  }, [theme])

  // Apply theme class to root
  useEffect(() => {
    const root = window.document.documentElement
    const hasMatchMedia = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    const mediaQuery = hasMatchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

    const applyTheme = (currentResolvedTheme: ResolvedTheme) => {
      root.classList.remove('light', 'dark', 'acrylic', 'obsidian')
      if (currentResolvedTheme === 'obsidian') {
        root.classList.add('dark', 'obsidian')
      } else {
        root.classList.add(currentResolvedTheme)
      }
    }

    const handleChange = () => {
      if (theme === 'system' && mediaQuery) {
        const systemTheme = mediaQuery.matches ? 'dark' : 'light'
        applyTheme(systemTheme)
      }
    }

    applyTheme(resolvedTheme)
    if (mediaQuery) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme, resolvedTheme])

  // Apply Glass CSS Variables
  const applyGlassVariables = useCallback((intensity: number, fallback: boolean) => {
    const root = window.document.documentElement
    if (fallback) {
      root.style.setProperty('--glass-blur', '0px')
      root.style.setProperty('--glass-intensity', '0')
      root.style.setProperty('--glass-specular-alpha', '0')
      return
    }

    const clamped = Math.max(0, Math.min(100, intensity))
    const blurPx = Math.round((clamped / 100) * 36)
    const intensityRatio = Number((clamped / 100).toFixed(2))
    const specularAlpha = Math.max(0.15, Number((0.15 + (clamped / 100) * 0.8).toFixed(2)))

    root.style.setProperty('--glass-blur', `${blurPx}px`)
    root.style.setProperty('--glass-intensity', `${intensityRatio}`)
    root.style.setProperty('--glass-specular-alpha', `${specularAlpha}`)
  }, [])

  useEffect(() => {
    applyGlassVariables(glassIntensity, glassFallback)
  }, [glassIntensity, glassFallback, applyGlassVariables])

  // Sync wallpaper and accent color attributes to root element
  useEffect(() => {
    const root = window.document.documentElement
    root.setAttribute('data-wallpaper', wallpaper)
    root.setAttribute('data-accent', accentColor)
    root.setAttribute('data-glass-fallback', glassFallback ? 'true' : 'false')
  }, [wallpaper, accentColor, glassFallback])

  // Native accessibility listener: prefers-reduced-transparency & prefers-contrast
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const transparencyQuery = window.matchMedia('(prefers-reduced-transparency: reduce)')
    const handleTransparencyChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        _setGlassFallback(true)
      }
    }

    if (transparencyQuery?.matches) {
      _setGlassFallback(true)
    }

    transparencyQuery?.addEventListener('change', handleTransparencyChange)
    return () => transparencyQuery?.removeEventListener('change', handleTransparencyChange)
  }, [])

  const setTheme = useCallback((newTheme: Theme) => {
    setCookie(storageKey, newTheme, THEME_COOKIE_MAX_AGE)
    _setTheme(newTheme)
  }, [storageKey])

  const previewGlassIntensity = useCallback((intensity: number) => {
    applyGlassVariables(intensity, glassFallback)
  }, [applyGlassVariables, glassFallback])

  const setGlassIntensity = useCallback((intensity: number) => {
    const clamped = Math.max(0, Math.min(100, intensity))
    previewGlassIntensity(clamped)
    setCookie(GLASS_INTENSITY_COOKIE_NAME, clamped.toString(), THEME_COOKIE_MAX_AGE)
    _setGlassIntensity(clamped)
  }, [previewGlassIntensity])

  const setWallpaper = useCallback((newWallpaper: WallpaperStyle) => {
    setCookie(WALLPAPER_COOKIE_NAME, newWallpaper, THEME_COOKIE_MAX_AGE)
    _setWallpaper(newWallpaper)
  }, [])

  const setAccentColor = useCallback((newAccent: AccentColor) => {
    setCookie(ACCENT_COLOR_COOKIE_NAME, newAccent, THEME_COOKIE_MAX_AGE)
    _setAccentColor(newAccent)
  }, [])

  const setGlassFallback = useCallback((fallback: boolean) => {
    setCookie(GLASS_FALLBACK_COOKIE_NAME, fallback.toString(), THEME_COOKIE_MAX_AGE)
    _setGlassFallback(fallback)
  }, [])

  const resetTheme = useCallback(() => {
    removeCookie(storageKey)
    removeCookie(GLASS_INTENSITY_COOKIE_NAME)
    removeCookie(WALLPAPER_COOKIE_NAME)
    removeCookie(ACCENT_COLOR_COOKIE_NAME)
    removeCookie(GLASS_FALLBACK_COOKIE_NAME)
    _setTheme(DEFAULT_THEME)
    _setGlassIntensity(DEFAULT_GLASS_INTENSITY)
    _setWallpaper(DEFAULT_WALLPAPER)
    _setAccentColor(DEFAULT_ACCENT_COLOR)
    _setGlassFallback(false)
  }, [storageKey])

  const contextValue = useMemo<ThemeProviderState>(
    () => ({
      defaultTheme,
      resolvedTheme,
      resetTheme,
      theme,
      setTheme,
      glassIntensity,
      setGlassIntensity,
      previewGlassIntensity,
      wallpaper,
      setWallpaper,
      accentColor,
      setAccentColor,
      glassFallback,
      setGlassFallback,
    }),
    [
      defaultTheme,
      resolvedTheme,
      resetTheme,
      theme,
      setTheme,
      glassIntensity,
      setGlassIntensity,
      previewGlassIntensity,
      wallpaper,
      setWallpaper,
      accentColor,
      setAccentColor,
      glassFallback,
      setGlassFallback,
    ]
  )

  return (
    <ThemeContext value={contextValue} {...props}>
      {children}
    </ThemeContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext)

  if (!context) throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
