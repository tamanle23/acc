import { allBlogs as localBlogs, allAuthors as localAuthors, Blog, Authors, sortPosts } from '@/lib/content'
import { unipostCmsClient } from './unipost-cms-client'
import { EntityRecord } from '@unipost/client'
import readingTime from 'reading-time'
import GithubSlugger from 'github-slugger'

/**
 * Transforms a backend dynamic EntityRecord (type: article) into tekgo-ui's Blog interface.
 */
export function mapRecordToBlog(record: EntityRecord): Blog {
  const attrs = record.attributes || {}
  const title = (attrs.title as string) || 'Untitled Post'
  const date = (attrs.publishedDate as string) || (attrs.date as string) || record.createdDate || new Date().toISOString()
  const rawTags = (attrs.tags as string[]) || []
  const summary = (attrs.summary as string) || (attrs.description as string) || ''
  const slug = (attrs.slug as string) || `${record.id}`
  const authors = (attrs.authors as string[]) || ['default']

  // Handle portableTextBody format or fallback blocks
  let portableTextBody = attrs.portableTextBody || attrs.body
  if (!portableTextBody) {
    const content = (attrs.content as string) || summary || ''
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
    ]
  }

  const toc: { value: string; url: string; depth: number }[] = []
  if (Array.isArray(portableTextBody)) {
    const slugger = new GithubSlugger()
    for (const block of portableTextBody) {
      if (block._type === 'block' && typeof block.style === 'string' && block.style.match(/^h[1-6]$/)) {
        const depth = parseInt(block.style.substring(1), 10)
        const text = (block.children || []).map((c: any) => c.text || '').join('')
        if (text) {
          toc.push({ value: text, url: `#${slugger.slug(text)}`, depth })
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
    images: attrs.images || (attrs.heroImage ? [attrs.heroImage] : undefined),
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
  }
}

/**
 * Unified Content Provider with Dual-Mode Support:
 * - DATA_SOURCE = 'cms' -> Fetches live published articles from Backend Public CMS Gateway
 * - DATA_SOURCE = 'local' -> Reads pre-compiled local JSON files
 */
export class ContentProvider {
  private dataSource: 'cms' | 'local'

  constructor() {
    this.dataSource = (process.env.DATA_SOURCE as 'cms' | 'local') || 'local'
  }

  /**
   * Returns current active data source.
   */
  getDataSource(): 'cms' | 'local' {
    return this.dataSource
  }

  /**
   * Fetches all blogs sorted by date descending.
   */
  async getAllBlogs(): Promise<Blog[]> {
    if (this.dataSource === 'cms') {
      try {
        const records = await unipostCmsClient.getPublishedRecords('article')
        if (records && records.length > 0) {
          const cmsBlogs = records.map(mapRecordToBlog)
          return sortPosts(cmsBlogs)
        }
      } catch (error) {
        console.warn('[ContentProvider] Failed to fetch CMS blogs, falling back to local:', error)
      }
    }
    return sortPosts(localBlogs)
  }

  /**
   * Finds a single blog by slug.
   */
  async getBlogBySlug(slug: string): Promise<Blog | undefined> {
    const all = await this.getAllBlogs()
    return all.find((b) => b.slug === slug)
  }

  /**
   * Computes tag counts across all published blogs.
   */
  async getTagData(): Promise<Record<string, number>> {
    const blogs = await this.getAllBlogs()
    const tagCount: Record<string, number> = {}
    const slugger = new GithubSlugger()

    blogs.forEach((file) => {
      if (file.tags && file.draft !== true) {
        file.tags.forEach((tag) => {
          const formattedTag = slugger.slug(tag)
          tagCount[formattedTag] = (tagCount[formattedTag] || 0) + 1
        })
      }
    })
    return tagCount
  }

  /**
   * Returns authors.
   */
  async getAllAuthors(): Promise<Authors[]> {
    return localAuthors
  }
}

export const contentProvider = new ContentProvider()
