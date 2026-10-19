import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as React from 'react'
import { ThemeProvider } from '@/context/theme-provider'
import { FontProvider } from '@/context/font-provider'
import { AppearanceForm } from '../appearance-form'

describe('AppearanceForm Component', () => {
  beforeEach(() => {
    document.cookie = ''
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-accent')
    document.documentElement.removeAttribute('data-glass-fallback')
    document.documentElement.style.cssText = ''
  })

  const renderWithProviders = () => {
    return render(
      <FontProvider>
        <ThemeProvider>
          <AppearanceForm />
        </ThemeProvider>
      </FontProvider>
    )
  }

  it('renders theme presets including flagship Acrylic Glass and Dark Obsidian', () => {
    renderWithProviders()

    expect(screen.getByText('Theme Presets')).toBeDefined()
    expect(screen.getByText('Light')).toBeDefined()
    expect(screen.getByText('Acrylic Glass')).toBeDefined()
    expect(screen.getByText('Dark')).toBeDefined()
    expect(screen.getByText('Dark Obsidian')).toBeDefined()
  })

  it('renders all 5 ambient accent options', () => {
    renderWithProviders()

    expect(screen.getByText('Ambient Accent Color')).toBeDefined()
    expect(screen.getByText('Aurora')).toBeDefined()
    expect(screen.getByText('Sky')).toBeDefined()
    expect(screen.getByText('Jade')).toBeDefined()
    expect(screen.getByText('Quartz')).toBeDefined()
    expect(screen.getByText('Sovereign')).toBeDefined()
  })

  it('renders High-Contrast Solid Fallback switch and Live Glass Preview card', () => {
    renderWithProviders()

    expect(screen.getByText('High-Contrast Solid Fallback')).toBeDefined()
    expect(screen.getByText('Live Glass Preview')).toBeDefined()
    expect(screen.getByText('Blur')).toBeDefined()
    expect(screen.getByText('Opacity')).toBeDefined()
    expect(screen.getByText('Refraction')).toBeDefined()
  })

  it('toggles High-Contrast Solid Fallback via switch', async () => {
    renderWithProviders()

    const switchToggle = screen.getByRole('switch', {
      name: /Toggle High-Contrast Solid Fallback/i,
    })
    expect(switchToggle).toBeDefined()
    expect(switchToggle.getAttribute('data-state')).toBe('unchecked')

    fireEvent.click(switchToggle)

    expect(document.documentElement.getAttribute('data-glass-fallback')).toBe('true')
  })
})
