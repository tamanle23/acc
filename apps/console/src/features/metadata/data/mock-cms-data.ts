// High-Volume CMS & Publishing Mock Data Specification & Generator
// Provides client-side data parity with the backend sandbox CMS scaffolding:
// - 1,000 Articles (ent_cms_article) with rich Markdown bodies, SEO tags, and statuses
// - 50 Categories (ent_cms_category) with slugs and descriptions
// - 200 Media Assets (ent_cms_media_asset) with CDN URLs and formats
// - 2,000 Relational Graph Edges (rel_article_to_category, rel_article_featured_media)
import type { AttributeDefinition, EntityRecord, EntityRelationship, EntityType, RelationshipType } from '../api/types';

export const cmsEntityTypes: EntityType[] = [
  {
    id: 'cms-article',
    name: 'Article & Editorial Post',
    systemName: 'ent_cms_article',
    description: 'Long-form editorial articles, news items, and blog posts with SEO metadata',
    schemaVersion: 1,
    version: 1,
    lifecycleConfig: {
      state_field: 'status',
      initial_state: 'DRAFT',
      states: ['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'],
      transitions: [
        { from: 'DRAFT', to: 'IN_REVIEW', action: 'SUBMIT_REVIEW' },
        { from: 'IN_REVIEW', to: 'SCHEDULED', action: 'SCHEDULE' },
        { from: 'IN_REVIEW', to: 'PUBLISHED', action: 'PUBLISH' },
        { from: 'SCHEDULED', to: 'PUBLISHED', action: 'AUTO_PUBLISH' },
        { from: 'PUBLISHED', to: 'ARCHIVED', action: 'ARCHIVE' },
      ],
    },
    createdDate: '2026-01-10T00:00:00.000Z',
    updatedDate: '2026-03-25T00:00:00.000Z',
  },
  {
    id: 'cms-category',
    name: 'Content Category',
    systemName: 'ent_cms_category',
    description: 'Hierarchical taxonomy topics and editorial sections',
    schemaVersion: 1,
    version: 1,
    createdDate: '2026-01-10T00:00:00.000Z',
    updatedDate: '2026-03-25T00:00:00.000Z',
  },
  {
    id: 'cms-media',
    name: 'Media Asset',
    systemName: 'ent_cms_media_asset',
    description: 'Image attachments, illustrations, and featured hero photography',
    schemaVersion: 1,
    version: 1,
    createdDate: '2026-01-10T00:00:00.000Z',
    updatedDate: '2026-03-25T00:00:00.000Z',
  },
];

export const cmsAttributes: Record<string, AttributeDefinition[]> = {
  'cms-article': [
    { id: 'cms-attr-101', entityTypeId: 'cms-article', name: 'Article Title', systemName: 'title', dataType: 'STRING', uiComponent: 'text', isRequired: true, displayOrder: 1, version: 1 },
    { id: 'cms-attr-102', entityTypeId: 'cms-article', name: 'URL Slug', systemName: 'slug', dataType: 'STRING', uiComponent: 'text', isRequired: true, displayOrder: 2, version: 1 },
    { id: 'cms-attr-103', entityTypeId: 'cms-article', name: 'Excerpt Summary', systemName: 'summary', dataType: 'STRING', uiComponent: 'textarea', isRequired: false, displayOrder: 3, version: 1 },
    { id: 'cms-attr-104', entityTypeId: 'cms-article', name: 'Body Content (Markdown)', systemName: 'body_content', dataType: 'STRING', uiComponent: 'textarea', isRequired: true, displayOrder: 4, version: 1 },
    { id: 'cms-attr-105', entityTypeId: 'cms-article', name: 'Publishing Status', systemName: 'status', dataType: 'STRING', uiComponent: 'select', isRequired: true, displayOrder: 5, version: 1, options: { choices: ['DRAFT', 'IN_REVIEW', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'] }, defaultValue: 'DRAFT' },
    { id: 'cms-attr-106', entityTypeId: 'cms-article', name: 'Featured Headline', systemName: 'featured_flag', dataType: 'BOOLEAN', uiComponent: 'switch', isRequired: false, displayOrder: 6, version: 1, defaultValue: 'false' },
    { id: 'cms-attr-107', entityTypeId: 'cms-article', name: 'Publication Timestamp', systemName: 'published_at', dataType: 'DATETIME', uiComponent: 'datepicker', isRequired: false, displayOrder: 7, version: 1 },
    { id: 'cms-attr-108', entityTypeId: 'cms-article', name: 'SEO Meta Title', systemName: 'meta_title', dataType: 'STRING', uiComponent: 'text', isRequired: false, displayOrder: 8, version: 1 },
    { id: 'cms-attr-109', entityTypeId: 'cms-article', name: 'SEO Meta Description', systemName: 'meta_description', dataType: 'STRING', uiComponent: 'textarea', isRequired: false, displayOrder: 9, version: 1 },
  ],
  'cms-category': [
    { id: 'cms-attr-201', entityTypeId: 'cms-category', name: 'Category Name', systemName: 'category_name', dataType: 'STRING', uiComponent: 'text', isRequired: true, displayOrder: 1, version: 1 },
    { id: 'cms-attr-202', entityTypeId: 'cms-category', name: 'Category Slug', systemName: 'slug', dataType: 'STRING', uiComponent: 'text', isRequired: true, displayOrder: 2, version: 1 },
    { id: 'cms-attr-203', entityTypeId: 'cms-category', name: 'Category Description', systemName: 'description', dataType: 'STRING', uiComponent: 'textarea', isRequired: false, displayOrder: 3, version: 1 },
    { id: 'cms-attr-204', entityTypeId: 'cms-category', name: 'Badge Color Code (Hex)', systemName: 'color_code', dataType: 'STRING', uiComponent: 'text', isRequired: false, displayOrder: 4, version: 1, defaultValue: '#3B82F6' },
  ],
  'cms-media': [
    { id: 'cms-attr-301', entityTypeId: 'cms-media', name: 'Asset Filename', systemName: 'file_name', dataType: 'STRING', uiComponent: 'text', isRequired: true, displayOrder: 1, version: 1 },
    { id: 'cms-attr-302', entityTypeId: 'cms-media', name: 'CDN Public URL', systemName: 'storage_url', dataType: 'STRING', uiComponent: 'text', isRequired: true, displayOrder: 2, version: 1 },
    { id: 'cms-attr-303', entityTypeId: 'cms-media', name: 'MIME Type', systemName: 'mime_type', dataType: 'STRING', uiComponent: 'select', isRequired: true, displayOrder: 3, version: 1, options: { choices: ['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'application/pdf'] }, defaultValue: 'image/webp' },
    { id: 'cms-attr-304', entityTypeId: 'cms-media', name: 'File Size in Bytes', systemName: 'file_size_bytes', dataType: 'INTEGER', uiComponent: 'number', isRequired: true, displayOrder: 4, version: 1 },
    { id: 'cms-attr-305', entityTypeId: 'cms-media', name: 'Accessibility Alt Text', systemName: 'alt_text', dataType: 'STRING', uiComponent: 'text', isRequired: false, displayOrder: 5, version: 1 },
  ],
};

export const cmsRelationshipTypes: RelationshipType[] = [
  {
    id: 'rel-cms-article-category',
    name: 'Article Primary Category',
    systemName: 'rel_article_to_category',
    sourceEntityTypeId: 'cms-article',
    targetEntityTypeId: 'cms-category',
    cardinality: 'MANY_TO_ONE',
    description: 'Associates an article with an editorial taxonomy category',
    version: 1,
    createdDate: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'rel-cms-article-media',
    name: 'Article Cover Media',
    systemName: 'rel_article_featured_media',
    sourceEntityTypeId: 'cms-article',
    targetEntityTypeId: 'cms-media',
    cardinality: 'MANY_TO_ONE',
    description: 'Binds a hero cover photography media asset to an article',
    version: 1,
    createdDate: '2026-01-10T00:00:00.000Z',
  },
];

export const generateCmsRecordsAndRelationships = (
  tenantId = 'tenant-acme'
): {
  records: Record<string, EntityRecord[]>;
  relationships: EntityRelationship[];
} => {
  const categories: EntityRecord[] = [];
  const mediaAssets: EntityRecord[] = [];
  const articles: EntityRecord[] = [];
  const relationships: EntityRelationship[] = [];

  const categoryNames = [
    'Enterprise Architecture', 'Cloud Native & DevOps', 'Distributed Systems',
    'FinTech & VietQR', 'AI Agents & Autonomous Coding', 'Cybersecurity & Sovereign Tenancy',
    'Event-Driven Microservices', 'PostgreSQL & RLS Mechanics', 'Next.js & Frontend Vistas',
    'Mobile UI & Cross-Platform', 'Big Data & Analytics', 'Product Management'
  ];

  // 1. Generate 50 Categories
  for (let i = 1; i <= 50; i++) {
    const id = `cat-${i}`;
    const baseName = categoryNames[(i - 1) % categoryNames.length];
    const name = i > categoryNames.length ? `${baseName} Vol ${Math.floor(i / categoryNames.length) + 1}` : baseName;
    const slug = `category-${i}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

    categories.push({
      id,
      entityTypeId: 'cms-category',
      tenantId,
      version: 1,
      attributes: {
        category_name: name,
        slug,
        description: `High-frequency taxonomy section for ${name} content streams and editorial articles.`,
        color_code: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][i % 5],
      },
      createdDate: new Date(2026, 0, (i % 28) + 1, 10, i % 60).toISOString(),
      updatedDate: new Date(2026, 2, (i % 20) + 1, 14, i % 60).toISOString(),
    });
  }

  // 2. Generate 200 Media Assets
  const formats = ['image/webp', 'image/jpeg', 'image/png', 'video/mp4', 'application/pdf'];
  for (let i = 1; i <= 200; i++) {
    const id = `media-${i}`;
    const mime = formats[i % formats.length];
    const ext = mime === 'image/webp' ? 'webp' : mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : mime === 'video/mp4' ? 'mp4' : 'pdf';
    const fileName = `asset-${String(i).padStart(4, '0')}.${ext}`;
    const url = `https://cdn.sandbox.acc.io/assets/${tenantId}/${fileName}`;

    mediaAssets.push({
      id,
      entityTypeId: 'cms-media',
      tenantId,
      version: 1,
      attributes: {
        file_name: fileName,
        storage_url: url,
        mime_type: mime,
        file_size_bytes: 250000 + ((i * 31337) % 8000000),
        alt_text: `High resolution cover artwork and media illustration #${i}`,
      },
      createdDate: new Date(2026, 0, (i % 28) + 1, 8, i % 60).toISOString(),
      updatedDate: new Date(2026, 2, (i % 20) + 1, 12, i % 60).toISOString(),
    });
  }

  // 3. Generate 1,000 Articles
  const statuses = ['PUBLISHED', 'DRAFT', 'IN_REVIEW', 'SCHEDULED', 'ARCHIVED'];
  const titles = [
    'Architecting High-Throughput PostgreSQL Dynamic Schemas with RLS',
    'Building Liquid Glass Design Systems with Tailwind CSS and Radix UI',
    'Zero-Stub Multi-Tenancy Invariants in Spring Modulith Engines',
    'Decoupled Microservices vs Modular Monoliths: 2026 Production Retrospective',
    'Real-Time Event Streams and Outbox Reliability at Enterprise Scale',
    'VietQR Billing Automation and FinOps Settlement Webhooks',
    'Sovereign Custody Operations and DLQ Poison Pill Quarantine',
    'Autonomous AI Coding Pair-Programming in Complex Monorepos',
    'Deep Child Filtering and Windowed LATERAL Joins in Dynamic SQL Pushdown',
    'WCAG 2.2 AA Accessibility Enforcement Across Reactive UI Pipelines'
  ];

  for (let i = 1; i <= 1000; i++) {
    const id = `art-${i}`;
    const baseTitle = titles[(i - 1) % titles.length];
    const title = `${baseTitle} (Edition ${i})`;
    const slug = `article-${i}-${baseTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const status = statuses[i % statuses.length];
    const featured = (i % 7 === 0);
    const assignedCategory = categories[(i - 1) % categories.length];
    const assignedMedia = mediaAssets[(i - 1) % mediaAssets.length];

    articles.push({
      id,
      entityTypeId: 'cms-article',
      tenantId,
      version: 1,
      attributes: {
        title,
        slug,
        summary: `Executive editorial summary and technical walkthrough for ${title}.`,
        body_content: `# ${title}\n\n## Overview\nThis article details the comprehensive engineering practices implemented for high-throughput enterprise content authoring.\n\n### Key Highlights\n- Authentic PostgreSQL Row-Level Security\n- Zero-stub determinism across all environments\n- Automated WCAG 2.2 AA validation\n`,
        status,
        featured_flag: featured,
        published_at: status === 'PUBLISHED' ? new Date(2026, 1, (i % 28) + 1).toISOString() : undefined,
        meta_title: `${title} | Unipost Media`,
        meta_description: `Learn how ${title} enables reliable multi-channel digital publishing at scale.`,
      },
      createdDate: new Date(2026, 0, (i % 60) + 1, 9, i % 60).toISOString(),
      updatedDate: new Date(2026, 2, (i % 25) + 1, 15, i % 60).toISOString(),
    });

    // Graph Edge: Article -> Category
    relationships.push({
      id: `rel-art-cat-${i}`,
      relationshipTypeId: 'rel-cms-article-category',
      sourceRecordId: id,
      targetRecordId: assignedCategory.id,
      version: 1,
      createdDate: new Date(2026, 1, 1).toISOString(),
    });

    // Graph Edge: Article -> Cover Media
    relationships.push({
      id: `rel-art-med-${i}`,
      relationshipTypeId: 'rel-cms-article-media',
      sourceRecordId: id,
      targetRecordId: assignedMedia.id,
      version: 1,
      createdDate: new Date(2026, 1, 1).toISOString(),
    });
  }

  return {
    records: {
      'cms-article': articles,
      'cms-category': categories,
      'cms-media': mediaAssets,
    },
    relationships,
  };
};
