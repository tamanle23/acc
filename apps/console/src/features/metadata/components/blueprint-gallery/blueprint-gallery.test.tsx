import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { BlueprintCard } from '../../components/blueprint-gallery/blueprint-card';
import { BlueprintGraphCanvas } from '../../components/blueprint-gallery/blueprint-graph-canvas';
import { BlueprintTableView } from '../../components/blueprint-gallery/blueprint-table-view';
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


