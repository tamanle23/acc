import {
  allBlogs as localBlogs,
  allAuthors as localAuthors,
  sortPosts,
} from '@/lib/content';
import type { Blog, Authors } from '@/lib/types';
import { accCmsClient } from './acc-cms-client';
import type { EntityRecord } from '@acc/client';
import readingTime from 'reading-time';
import GithubSlugger from 'github-slugger';

export function mapRecordToBlog(record: EntityRecord): Blog {
  const attrs = record.attributes || {};
  const title = (attrs.title as string) || 'Untitled Post';
  const date =
    (attrs.publishedDate as string) ||
    (attrs.date as string) ||
    record.createdDate ||
    new Date().toISOString();
  const rawTags = (attrs.tags as string[]) || [];
  const summary = (attrs.summary as string) || (attrs.description as string) || '';
  const slug = (attrs.slug as string) || `${record.id}`;
  const authors = (attrs.authors as string[]) || ['default'];

  let portableTextBody = attrs.portableTextBody || attrs.body;
  if (!portableTextBody) {
    const content = (attrs.content as string) || summary || '';
    portableTextBody = [
      {
        _type: 'block',
        style: 'normal',
        children: [
          {
            _type: 'span',
            marks: [],
            text: content,
            _key: `span-${record.id}`,
          },
        ],
        markDefs: [],
      },
    ];
  }

  const toc: { value: string; url: string; depth: number }[] = [];
  if (Array.isArray(portableTextBody)) {
    const slugger = new GithubSlugger();
    for (const block of portableTextBody) {
      if (
        block._type === 'block' &&
        typeof block.style === 'string' &&
        block.style.match(/^h[1-6]$/)
      ) {
        const depth = parseInt(block.style.substring(1), 10);
        const text = (block.children || []).map((c: any) => c.text || '').join('');
        if (text) {
          toc.push({ value: text, url: `#${slugger.slug(text)}`, depth });
        }
      }
    }
  }

  return {
    title,
    date,
    tags: rawTags,
    lastmod: record.updatedDate,
    draft: attrs.status !== 'PUBLISHED',
    summary,
    images: (attrs.images as string | string[] | undefined) || (attrs.heroImage ? [attrs.heroImage as string] : undefined),
    authors,
    layout: (attrs.layout as string) || 'PostLayout',
    portableTextBody,
    slug,
    path: `blog/${slug}`,
    filePath: `cms/${record.id}.json`,
    readingTime: readingTime(JSON.stringify(portableTextBody)),
    toc,
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      datePublished: date,
      dateModified: record.updatedDate || date,
      description: summary,
      image: attrs.heroImage || '/static/images/twitter-card.png',
      url: `/blog/${slug}`,
    },
  };
}

export class ContentProvider {
  private dataSource: 'cms' | 'local';

  constructor() {
    this.dataSource = (process.env.DATA_SOURCE as 'cms' | 'local') || 'local';
  }

  getDataSource(): 'cms' | 'local' {
    return this.dataSource;
  }

  async getAllBlogs(): Promise<Blog[]> {
    if (this.dataSource === 'cms') {
      try {
        const records = await accCmsClient.getPublishedRecords('article');
        if (records && records.length > 0) {
          const cmsBlogs = records.map(mapRecordToBlog);
          return sortPosts(cmsBlogs);
        }
      } catch (error) {
        console.warn('[ContentProvider] Failed to fetch CMS blogs, falling back to local:', error);
      }
    }
    return sortPosts(localBlogs);
  }

  async getBlogBySlug(slug: string): Promise<Blog | undefined> {
    const all = await this.getAllBlogs();
    return all.find((b) => b.slug === slug);
  }

  async getTagData(): Promise<Record<string, number>> {
    const blogs = await this.getAllBlogs();
    const tagCount: Record<string, number> = {};
    const slugger = new GithubSlugger();

    blogs.forEach((file) => {
      if (file.tags && file.draft !== true) {
        file.tags.forEach((tag) => {
          const formattedTag = slugger.slug(tag);
          tagCount[formattedTag] = (tagCount[formattedTag] || 0) + 1;
        });
      }
    });
    return tagCount;
  }

  async getAllAuthors(): Promise<Authors[]> {
    return localAuthors;
  }
}

export const contentProvider = new ContentProvider();
