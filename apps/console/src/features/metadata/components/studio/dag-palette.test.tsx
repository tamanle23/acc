import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DagPalette, PALETTE_ITEMS } from './dag-palette';

describe('DagPalette Component Unit Tests', () => {
  it('renders all workflow DAG node items', () => {
    render(<DagPalette />);

    expect(screen.getByText('Node Palette')).toBeDefined();
    expect(screen.getByText('Drag & Drop')).toBeDefined();
    expect(screen.getByText('Simple Task')).toBeDefined();
    expect(screen.getByText('Switch Node')).toBeDefined();
    expect(screen.getByText('Fork / Join')).toBeDefined();
    expect(screen.getByText('Dynamic Fork')).toBeDefined();
    expect(screen.getByText('Wait / Timer')).toBeDefined();
    expect(screen.getByText('Do-While Loop')).toBeDefined();
  });

  it('contains expected item types in PALETTE_ITEMS catalog', () => {
    const types = PALETTE_ITEMS.map((item) => item.type);
    expect(types).toContain('SIMPLE');
    expect(types).toContain('SWITCH');
    expect(types).toContain('FORK_JOIN');
    expect(types).toContain('DYNAMIC_FORK');
    expect(types).toContain('WAIT');
    expect(types).toContain('DO_WHILE');
  });
});
