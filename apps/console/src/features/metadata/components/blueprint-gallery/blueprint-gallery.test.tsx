import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BlueprintCard } from '../../components/blueprint-gallery/blueprint-card';
import { BlueprintGraphCanvas } from '../../components/blueprint-gallery/blueprint-graph-canvas';
import { BlueprintTableView } from '../../components/blueprint-gallery/blueprint-table-view';
import { DialogResizeHandles } from '@/components/dialog-resize-handles';
import { LayoutModeSwitcher } from '@/components/layout-switcher';
import type { BlueprintSummaryDto, BlueprintEntityType, BlueprintRelationship } from '../../api/types';

describe('BlueprintCard Component', () => {
  const sampleSummary: BlueprintSummaryDto = {
    id: 'bp_cms_publishing_v1',
    name: 'Headless CMS & Digital Publishing',
    category: 'MEDIA_PUBLISHING',
    description: 'Multi-channel content authoring and articles.',
    icon: 'Newspaper',
    entityTypesCount: 3,
    relationshipTypesCount: 2,
  };

  it('renders title, description, and model/edge count badges', () => {
    const handlePreview = vi.fn();
    const handleSelect = vi.fn();

    render(
      <BlueprintCard
        blueprint={sampleSummary}
        onPreview={handlePreview}
        onSelect={handleSelect}
      />
    );

    expect(screen.getByText('Headless CMS & Digital Publishing')).toBeDefined();
    expect(screen.getByText('Multi-channel content authoring and articles.')).toBeDefined();
    expect(screen.getByText('3 Models')).toBeDefined();
    expect(screen.getByText('2 Edges')).toBeDefined();
  });

  it('triggers onPreview and onSelect callbacks', () => {
    const handlePreview = vi.fn();
    const handleSelect = vi.fn();

    render(
      <BlueprintCard
        blueprint={sampleSummary}
        onPreview={handlePreview}
        onSelect={handleSelect}
      />
    );

    fireEvent.click(screen.getByText('Preview'));
    expect(handlePreview).toHaveBeenCalledWith('bp_cms_publishing_v1');

    fireEvent.click(screen.getByText('Use Blueprint'));
    expect(handleSelect).toHaveBeenCalledWith('bp_cms_publishing_v1');
  });
});

describe('BlueprintGraphCanvas Component', () => {
  const sampleEntityTypes: BlueprintEntityType[] = [
    {
      systemName: 'ent_article',
      name: 'Article',
      attributes: [
        { systemName: 'title', name: 'Title', dataType: 'STRING', uiComponent: 'text' },
      ],
    },
    {
      systemName: 'ent_category',
      name: 'Category',
      attributes: [
        { systemName: 'name', name: 'Name', dataType: 'STRING', uiComponent: 'text' },
      ],
    },
  ];

  const sampleRelationships: BlueprintRelationship[] = [
    {
      systemName: 'rel_article_category',
      name: 'Belongs to Category',
      sourceEntityType: 'ent_article',
      targetEntityType: 'ent_category',
      cardinality: 'MANY_TO_ONE',
    },
  ];

  it('renders SVG graph with nodes and cardinality badge', () => {
    const { container } = render(
      <BlueprintGraphCanvas
        entityTypes={sampleEntityTypes}
        relationshipTypes={sampleRelationships}
      />
    );

    expect(screen.getByText('Article')).toBeDefined();
    expect(screen.getByText('Category')).toBeDefined();
    expect(screen.getByText('N : 1')).toBeDefined();
    expect(container.querySelector('svg')).toBeDefined();
  });
});

describe('LayoutModeSwitcher & BlueprintTableView Components', () => {
  const sampleSummaries: BlueprintSummaryDto[] = [
    {
      id: 'bp_cms_publishing_v1',
      name: 'Headless CMS',
      category: 'MEDIA_PUBLISHING',
      description: 'Articles and taxonomy.',
      icon: 'Newspaper',
      entityTypesCount: 3,
      relationshipTypesCount: 2,
    },
    {
      id: 'bp_ecommerce_v1',
      name: 'E-Commerce Retail',
      category: 'COMMERCE',
      description: 'Catalogs and orders.',
      icon: 'Briefcase',
      entityTypesCount: 4,
      relationshipTypesCount: 3,
    },
  ];

  it('renders BlueprintTableView with tabular rows and triggers actions', () => {
    const handlePreview = vi.fn();
    const handleSelect = vi.fn();

    render(
      <BlueprintTableView
        blueprints={sampleSummaries}
        onPreview={handlePreview}
        onSelect={handleSelect}
      />
    );

    expect(screen.getByText('Headless CMS')).toBeDefined();
    expect(screen.getByText('E-Commerce Retail')).toBeDefined();
    expect(screen.getByText('MEDIA_PUBLISHING')).toBeDefined();
    expect(screen.getByText('COMMERCE')).toBeDefined();

    // Trigger actions in table (alphabetical by name: 'E-Commerce Retail' is first)
    const previewButtons = screen.getAllByTitle('Preview Blueprint Graph');
    fireEvent.click(previewButtons[0]);
    expect(handlePreview).toHaveBeenCalledWith('bp_ecommerce_v1');

    const useButtons = screen.getAllByRole('button', { name: /Use/i });
    fireEvent.click(useButtons[0]);
    expect(handleSelect).toHaveBeenCalledWith('bp_ecommerce_v1');
  });
});

describe('useResizableDialog & DialogResizeHandles', () => {
  it('renders resize handles and supports dragging to resize', () => {
    const handleStartResize = vi.fn();
    const { getByTestId } = render(
      <div style={{ position: 'relative', width: 400, height: 300 }}>
        <DialogResizeHandles onStartResize={handleStartResize} isMaximized={false} />
      </div>
    );

    const cornerHandle = getByTestId('resize-handle-bottom-right');
    expect(cornerHandle).toBeDefined();

    fireEvent.mouseDown(cornerHandle, { clientX: 100, clientY: 100 });
    expect(handleStartResize).toHaveBeenCalledWith('bottom-right', expect.anything());
  });

  it('hides resize handles when maximized', () => {
    const handleStartResize = vi.fn();
    const { queryByTestId } = render(
      <div style={{ position: 'relative', width: 400, height: 300 }}>
        <DialogResizeHandles onStartResize={handleStartResize} isMaximized={true} />
      </div>
    );

    expect(queryByTestId('resize-handle-bottom-right')).toBeNull();
  });

  it('computes top-anchored dialogStyle with margin 0 and responsive constraints', async () => {
    const { useResizableDialog } = await import('@/hooks/use-resizable-dialog');
    const { renderHook, act } = await import('@testing-library/react');

    const { result } = renderHook(() =>
      useResizableDialog({
        storageKey: 'test:dialog:centering',
        defaultWidth: 1000,
        defaultHeight: 700,
      })
    );

    expect(result.current.dialogStyle.margin).toBe(0);
    expect(result.current.dialogStyle.position).toBe('fixed');
    expect(result.current.dialogStyle.top).toBe('max(1rem, 3.5rem)');
    expect(result.current.dialogStyle.left).toContain('max(1rem,');
    expect(result.current.dialogStyle.transform).toBe('none');
    expect(result.current.dialogStyle.width).toBeDefined();
    expect(result.current.dialogStyle.height).toBeDefined();

    // Toggle maximize
    act(() => {
      result.current.toggleMaximize();
    });

    expect(result.current.isMaximized).toBe(true);
    expect(result.current.dialogStyle.width).toBe('98vw');
    expect(result.current.dialogStyle.height).toBe('97vh');
    expect(result.current.dialogStyle.top).toBe('1.5vh');
    expect(result.current.dialogStyle.transform).toBe('none');
    expect(result.current.dialogStyle.margin).toBe(0);

    // Reset to default
    act(() => {
      result.current.resetToDefault();
    });
    expect(result.current.isMaximized).toBe(false);
    expect(result.current.dialogStyle.top).toBe('max(1rem, 3.5rem)');
    expect(result.current.dialogStyle.left).toContain('max(1rem,');
    expect(result.current.dialogStyle.transform).toBe('none');
    expect(result.current.dialogStyle.margin).toBe(0);
  });
});


