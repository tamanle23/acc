import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DatePicker } from '../date-picker'

describe('DatePicker', () => {
  it('renders with placeholder aria-label when no date is selected', () => {
    const handleSelect = vi.fn()
    render(<DatePicker selected={undefined} onSelect={handleSelect} placeholder="Select date of birth" />)

    const button = screen.getByRole('button', { name: 'Select date of birth' })
    expect(button).toBeDefined()
  })

  it('renders with selected date aria-label when date is selected', () => {
    const handleSelect = vi.fn()
    const testDate = new Date(2025, 4, 20) // May 20, 2025
    render(<DatePicker selected={testDate} onSelect={handleSelect} />)

    const button = screen.getByRole('button', { name: 'Selected date: May 20, 2025' })
    expect(button).toBeDefined()
  })
})
