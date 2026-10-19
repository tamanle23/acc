import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import * as React from 'react'
import { ThemeProvider, useTheme } from '../theme-provider'

describe('ThemeProvider & Liquid Glass Invariants', () => {
  beforeEach(() => {
    // Clear cookies & attributes
    document.cookie = ''
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-accent')
    document.documentElement.removeAttribute('data-glass-fallback')
    document.documentElement.style.cssText = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('provides default theme state and applies default CSS variables', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    )

    const { result } = renderHook(() => useTheme(), { wrapper })

    expect(result.current.theme).toBe('system')
    expect(result.current.resolvedTheme).toBe('light')
    expect(result.current.accentColor).toBe('violet')
    expect(result.current.glassFallback).toBe(false)
    expect(document.documentElement.getAttribute('data-accent')).toBe('violet')
  })

  it('supports switching to flagship Light Frosted Acrylic preset', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultTheme='light'>{children}</ThemeProvider>
    )

    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.setTheme('acrylic')
    })

    expect(result.current.theme).toBe('acrylic')
    expect(result.current.resolvedTheme).toBe('acrylic')
    expect(document.documentElement.classList.contains('acrylic')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.classList.contains('obsidian')).toBe(false)
  })

  it('supports switching to flagship Dark Obsidian preset', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultTheme='light'>{children}</ThemeProvider>
    )

    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.setTheme('obsidian')
    })

    expect(result.current.theme).toBe('obsidian')
    expect(result.current.resolvedTheme).toBe('obsidian')
    expect(document.documentElement.classList.contains('obsidian')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.classList.contains('acrylic')).toBe(false)
  })

  it('propagates selectable ambient accent colors to document attribute and cookies', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    )

    const { result } = renderHook(() => useTheme(), { wrapper })

    act(() => {
      result.current.setAccentColor('emerald')
    })

    expect(result.current.accentColor).toBe('emerald')
    expect(document.documentElement.getAttribute('data-accent')).toBe('emerald')
    expect(document.cookie).toContain('vite-ui-accent=emerald')

    act(() => {
      result.current.setAccentColor('rose')
    })

    expect(result.current.accentColor).toBe('rose')
    expect(document.documentElement.getAttribute('data-accent')).toBe('rose')
  })

  it('enforces WCAG 2.2 AA solid fallback: zeroes blur/specular and sets data attribute', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider defaultGlassIntensity={50}>{children}</ThemeProvider>
    )

    const { result } = renderHook(() => useTheme(), { wrapper })

    // Initially glass is active
    expect(document.documentElement.style.getPropertyValue('--glass-blur')).not.toBe('0px')

    // Enable accessibility solid fallback
    act(() => {
      result.current.setGlassFallback(true)
    })

    expect(result.current.glassFallback).toBe(true)
    expect(document.documentElement.getAttribute('data-glass-fallback')).toBe('true')
    expect(document.documentElement.style.getPropertyValue('--glass-blur')).toBe('0px')
    expect(document.documentElement.style.getPropertyValue('--glass-specular-alpha')).toBe('0')
    expect(document.cookie).toContain('vite-ui-glass-fallback=true')

    // Disabling fallback restores optical glass properties
    act(() => {
      result.current.setGlassFallback(false)
    })

    expect(result.current.glassFallback).toBe(false)
    expect(document.documentElement.getAttribute('data-glass-fallback')).toBe('false')
    expect(document.documentElement.style.getPropertyValue('--glass-blur')).toBe('18px')
  })
})
